#!/usr/bin/env node
// Visualkan Installer: installs the skills, and forwards the two Runtime
// commands. Zero runtime dependencies — Node only.
//
// The Installer creates skill folders, so it cannot live inside one. The
// Runtime must live inside one, so an agent can reach it without a PATH
// lookup. That lifecycle seam is why the two are separate files. See ADR 0006.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  UserError,
  parseArgs,
  controlsReport,
  cmdGenerate,
  readTemplate,
  STYLES,
} from './scripts/visualkan-run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRIMARY_SKILL = 'visualkan';

// The Runtime file, by its name in this package and its name once installed.
const RUNTIME_FILE = 'visualkan-run.mjs';
const RUNTIME_DIR = 'scripts';

// Style Templates ride along beside the Runtime, which resolves them relative
// to itself. The agent never addresses them directly. See ADR 0007.
const REFERENCE_DIR = 'references';

// --- Skill registry --------------------------------------------------------
// Each skill ships as skill/<name>.md plus skill/<name>.metadata.json, and
// installs into its own directory named <name>. The Wizard is a separate skill
// rather than a mode of the first one, because a platform starts a skill by
// name or by description match, never mid-run. See ADR 0005.
export const SKILLS = {
  visualkan: 'Turns Content into a Visual Explanation',
  'visualkan-wizard': 'Guided selection of Controls',
};

// --- Platform registry -----------------------------------------------------
// `global` is relative to the home directory. `project` is relative to a
// project root. A platform without a `project` entry supports global scope only.
export const PLATFORMS = {
  claude: {
    label: 'Claude Code',
    global: ['.claude', 'skills'],
    project: ['.claude', 'skills'],
  },
  antigravity: {
    label: 'Antigravity',
    global: ['.gemini', 'config', 'skills'],
    project: ['.agents', 'skills'],
  },
  gemini: {
    label: 'Gemini CLI',
    global: ['.gemini', 'skills'],
    project: ['.gemini', 'skills'],
  },
  codex: {
    label: 'Codex CLI',
    global: ['.codex', 'skills'],
    project: ['.codex', 'skills'],
  },
  agents: {
    label: 'Open Agent Standard',
    global: ['.agents', 'skills'],
    project: ['.agents', 'skills'],
  },
  openclaw: {
    label: 'OpenClaw',
    global: ['clawd', 'skills'],
  },
};

// --- Install ---------------------------------------------------------------

// Forward slashes work in bash, cmd.exe, and PowerShell alike, including paths
// that contain a space. A backslash does not survive every one of them, so a
// written path never carries one. Verified by running, not by reading.
export function toPosix(path) {
  return path.replaceAll('\\', '/');
}

export function skillSourceFiles(skillName) {
  const md = join(HERE, 'skill', `${skillName}.md`);
  const meta = join(HERE, 'skill', `${skillName}.metadata.json`);
  if (!existsSync(md) || !existsSync(meta)) {
    throw new UserError(`Files for "${skillName}" are missing from the package at ${join(HERE, 'skill')}.`);
  }
  return { md, meta };
}

export function targetDir(platformKey, projectRoot, skillName = PRIMARY_SKILL) {
  const platform = PLATFORMS[platformKey];
  if (!platform) {
    throw new UserError(
      `Unknown platform "${platformKey}". Choose one of: ${Object.keys(PLATFORMS).join(', ')}.`
    );
  }
  if (!SKILLS[skillName]) {
    throw new UserError(`Unknown skill "${skillName}". Choose one of: ${Object.keys(SKILLS).join(', ')}.`);
  }
  if (projectRoot) {
    if (!platform.project) {
      throw new UserError(`${platform.label} supports global scope only, so --project does not apply.`);
    }
    return join(resolve(projectRoot), ...platform.project, skillName);
  }
  return join(homedir(), ...platform.global, skillName);
}

// The path written into an installed skill body, decided once at install time.
//
// Global scope gets an absolute path, because there is no project root to be
// relative to, and because cmd.exe does not expand `~`. Project scope gets a
// path relative to the project root, so a committed skill folder still works
// for a teammate whose home directory differs. One literal per install, chosen
// from the --project flag. See ADR 0006.
export function installedPath(platformKey, projectRoot, skillName, ...parts) {
  const platform = PLATFORMS[platformKey];
  if (!platform) {
    throw new UserError(
      `Unknown platform "${platformKey}". Choose one of: ${Object.keys(PLATFORMS).join(', ')}.`
    );
  }
  if (!SKILLS[skillName]) {
    throw new UserError(`Unknown skill "${skillName}". Choose one of: ${Object.keys(SKILLS).join(', ')}.`);
  }
  if (projectRoot) {
    if (!platform.project) {
      throw new UserError(`${platform.label} supports global scope only, so --project does not apply.`);
    }
    return toPosix(join(...platform.project, skillName, ...parts));
  }
  return toPosix(join(homedir(), ...platform.global, skillName, ...parts));
}

export function runtimePath(platformKey, projectRoot, skillName = PRIMARY_SKILL) {
  return installedPath(platformKey, projectRoot, skillName, RUNTIME_DIR, RUNTIME_FILE);
}

export function skillDocPath(platformKey, projectRoot, skillName = PRIMARY_SKILL) {
  return installedPath(platformKey, projectRoot, skillName, 'SKILL.md');
}

// Every placeholder a skill body may carry, and what install writes for it.
// A placeholder with no rule here is a bug the test suite catches, because a
// leftover {{...}} reaches the agent as literal text.
export function substitutions(platformKey, projectRoot) {
  return {
    RUNTIME_PATH: runtimePath(platformKey, projectRoot, PRIMARY_SKILL),
    VISUALKAN_SKILL_PATH: skillDocPath(platformKey, projectRoot, PRIMARY_SKILL),
  };
}

export function applySubstitutions(body, values) {
  return body.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) => {
    if (!(key in values)) {
      throw new UserError(`Skill body uses {{${key}}}, which install has no value for.`);
    }
    return values[key];
  });
}

// Both skills install together. An optional install would mean that the user
// has to know that the Wizard exists, which is the problem the Wizard solves.
function cmdInstall(flags, positional) {
  const platformKey = positional[0];
  if (!platformKey) {
    throw new UserError(`Which platform? Choose one of: ${Object.keys(PLATFORMS).join(', ')}.`);
  }
  const projectRoot = typeof flags.project === 'string' ? flags.project : null;
  const values = substitutions(platformKey, projectRoot);
  const runtimeSource = join(HERE, RUNTIME_DIR, RUNTIME_FILE);
  if (!existsSync(runtimeSource)) {
    throw new UserError(`The Runtime is missing from the package at ${runtimeSource}.`);
  }
  for (const style of Object.keys(STYLES)) {
    const source = join(HERE, REFERENCE_DIR, `style-${style}.md`);
    if (!existsSync(source)) {
      throw new UserError(`The Style Template for "${style}" is missing from the package at ${source}.`);
    }
  }

  for (const skillName of Object.keys(SKILLS)) {
    const { md, meta } = skillSourceFiles(skillName);
    const dir = targetDir(platformKey, projectRoot, skillName);
    mkdirSync(join(dir, RUNTIME_DIR), { recursive: true });
    mkdirSync(join(dir, REFERENCE_DIR), { recursive: true });

    // The skill body is templated, not copied. It carries the resolved path.
    writeFileSync(join(dir, 'SKILL.md'), applySubstitutions(readFileSync(md, 'utf8'), values));
    copyFileSync(meta, join(dir, 'metadata.json'));
    copyFileSync(runtimeSource, join(dir, RUNTIME_DIR, RUNTIME_FILE));
    for (const style of Object.keys(STYLES)) {
      const file = `style-${style}.md`;
      copyFileSync(join(HERE, REFERENCE_DIR, file), join(dir, REFERENCE_DIR, file));
    }
    console.log(`Installed ${skillName} v${version()} to ${join(dir, 'SKILL.md')}`);
  }
  console.log(`Runtime path written into both skills: ${values.RUNTIME_PATH}`);
}

function cmdUninstall(flags, positional) {
  const platformKey = positional[0];
  if (!platformKey) {
    throw new UserError(`Which platform? Choose one of: ${Object.keys(PLATFORMS).join(', ')}.`);
  }
  const projectRoot = typeof flags.project === 'string' ? flags.project : null;
  for (const skillName of Object.keys(SKILLS)) {
    const dir = targetDir(platformKey, projectRoot, skillName);
    if (!existsSync(dir)) {
      console.log(`${skillName} is not installed at ${dir}`);
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
    console.log(`Uninstalled ${skillName} from ${dir}`);
  }
}

// Reads the version an installed skill folder was written with. That number
// also dates the Runtime beside it, because install writes both together.
export function installedVersion(dir, read = readFileSync, exists = existsSync) {
  const meta = join(dir, 'metadata.json');
  if (!exists(meta)) return null;
  try {
    return JSON.parse(read(meta, 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

function cmdStatus() {
  const current = version();
  console.log(`${PRIMARY_SKILL} v${current}`);
  let skew = false;
  for (const key of Object.keys(PLATFORMS)) {
    for (const skillName of Object.keys(SKILLS)) {
      const dir = targetDir(key, null, skillName);
      const installed = existsSync(join(dir, 'SKILL.md')) ? installedVersion(dir) : null;
      const runtime = existsSync(join(dir, RUNTIME_DIR, RUNTIME_FILE));
      let mark = '-';
      if (installed) {
        mark = installed === current ? `v${installed}` : `v${installed} STALE`;
        if (installed !== current) skew = true;
        if (!runtime) {
          mark += ' no-runtime';
          skew = true;
        }
      }
      console.log(`  ${key.padEnd(12)} ${skillName.padEnd(17)} ${mark.padEnd(16)} ${dir}`);
    }
  }
  if (skew) {
    console.log('');
    console.log(`A skill above was installed by an older version, or is missing its Runtime.`);
    console.log(`Re-run: visualkan install <platform>`);
  }
}

// --- Version ---------------------------------------------------------------

function version() {
  return JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8')).version;
}

// Keeps every skill metadata file in step with package.json. Run by `npm
// version`. It writes each skill, because a skill left behind ships a stale
// version that no test would catch.
function cmdSyncVersion() {
  const today = new Date().toISOString().slice(0, 10);
  for (const skillName of Object.keys(SKILLS)) {
    const { meta: target } = skillSourceFiles(skillName);
    const meta = JSON.parse(readFileSync(target, 'utf8'));
    meta.version = version();
    meta.updated = today;
    writeFileSync(target, `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`${skillName}.metadata.json set to v${meta.version} (${meta.updated})`);
  }
}

// --- Entry point -----------------------------------------------------------

const USAGE = `visualkan v__VERSION__

  visualkan install <platform> [--project DIR]
  visualkan uninstall <platform> [--project DIR]
  visualkan status
  visualkan controls
  visualkan template --style NAME
  visualkan generate --prompt-file PATH [options]

Platforms: ${Object.keys(PLATFORMS).join(', ')}
Skills installed together: ${Object.keys(SKILLS).join(', ')}

generate options:
  --prompt-file PATH   File holding the prompt (required)
  --backend NAME       openai | gemini | openrouter (default: auto-detect)
  --model NAME         openrouter only (see ADR 0003)
  --style NAME         Sets the default size
  --device NAME        mobile | desktop | tablet (mockup style)
  --size WxH           Override the size
  --output DIR         Output directory (default: .)
  --prefix NAME        Filename prefix (default: visualkan)
  --out PATH           Exact output path, overrides --output and --prefix

install writes the Runtime into <skill>/scripts/, and writes its resolved path
into each skill body, so an agent never needs this command on PATH.
`;

async function main(argv) {
  const { flags, positional } = parseArgs(argv);
  const command = positional[0];
  const rest = positional.slice(1);

  switch (command) {
    case 'install': return cmdInstall(flags, rest);
    case 'uninstall': return cmdUninstall(flags, rest);
    case 'status': return cmdStatus();
    // Forwarded to the Runtime, which is the one place these live.
    case 'controls': return void console.log(controlsReport(process.env));
    case 'template': return void console.log(readTemplate(
      typeof flags.style === 'string' ? flags.style : 'whiteboard'
    ));
    case 'generate': return cmdGenerate(flags);
    case 'sync-version': return cmdSyncVersion();
    case 'version': return void console.log(version());
    case undefined:
    case 'help': return void console.log(USAGE.replace('__VERSION__', version()));
    default:
      throw new UserError(`Unknown command "${command}".\n\n${USAGE.replace('__VERSION__', version())}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof UserError ? error.message : error);
    // Set the code and let Node drain. On Windows, process.exit() while fetch
    // sockets are still closing aborts libuv and reports 127, not 1.
    process.exitCode = 1;
  });
}
