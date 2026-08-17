#!/usr/bin/env node
// Visualkan Installer: installs the skills, and forwards the two Runtime
// commands. Zero runtime dependencies — Node only.
//
// The Installer creates skill folders, so it cannot live inside one. The
// Runtime must live inside one, so an agent can reach it without a PATH
// lookup. That lifecycle seam is why the two are separate files. See ADR 0006.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync, cpSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  UserError,
  parseArgs,
  controlsReport,
  cmdGenerate,
  readTemplate,
  STYLES,
} from './skills/visualkan/scripts/visualkan-run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRIMARY_SKILL = 'visualkan';

// The Runtime file, by its name in this package and its name once installed.
const RUNTIME_FILE = 'visualkan-run.mjs';
const RUNTIME_DIR = 'scripts';

// Style Templates ride along beside the Runtime, which resolves them relative
// to itself. The agent never addresses them directly. See ADR 0007.
const REFERENCE_DIR = 'references';

// --- Skill registry --------------------------------------------------------
// Each skill ships as skills/<name>/SKILL.md plus
// skills/<name>/<name>.metadata.json, and installs into its own directory named
// <name>. The Wizard is a separate skill rather than a mode of the first one,
// because a platform starts a skill by name or by description match, never
// mid-run. See ADR 0005.
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

export function skillSourceFiles(skillName, packageDir = HERE) {
  const md = join(packageDir, 'skills', skillName, 'SKILL.md');
  const meta = join(packageDir, 'skills', skillName, `${skillName}.metadata.json`);
  if (!existsSync(md) || !existsSync(meta)) {
    throw new UserError(`Files for "${skillName}" are missing from the package at ${join(packageDir, 'skills', skillName)}.`);
  }
  return { md, meta };
}

export function targetDir(platformKey, projectRoot, skillName = PRIMARY_SKILL, home = homedir()) {
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
  return join(home, ...platform.global, skillName);
}

// The path written into an installed skill body, decided once at install time.
//
// Global scope gets an absolute path, because there is no project root to be
// relative to, and because cmd.exe does not expand `~`. Project scope gets a
// path relative to the project root, so a committed skill folder still works
// for a teammate whose home directory differs. One literal per install, chosen
// from the --project flag. See ADR 0006.
export function installedPath(platformKey, projectRoot, skillName, parts = [], home = homedir()) {
  const platform = PLATFORMS[platformKey];
  if (!platform) {
    throw new UserError(
      `Unknown platform "${platformKey}". Choose one of: ${Object.keys(PLATFORMS).join(', ')}.`
    );
  }
  if (!SKILLS[skillName]) {
    throw new UserError(`Unknown skill "${skillName}". Choose one of: ${Object.keys(SKILLS).join(', ')}.`);
  }
  const partList = Array.isArray(parts) ? parts : [parts];
  if (projectRoot) {
    if (!platform.project) {
      throw new UserError(`${platform.label} supports global scope only, so --project does not apply.`);
    }
    return toPosix(join(...platform.project, skillName, ...partList));
  }
  return toPosix(join(home, ...platform.global, skillName, ...partList));
}

export function runtimePath(platformKey, projectRoot, skillName = PRIMARY_SKILL, home = homedir()) {
  return installedPath(platformKey, projectRoot, skillName, [RUNTIME_DIR, RUNTIME_FILE], home);
}

export const RUNTIME_ANCHOR_LINE =
  'node "<this skill\'s own directory>/scripts/visualkan-run.mjs" generate --prompt-file <file> ...';

export function rewriteRuntimePath(body, runtimePath) {
  if (!body.includes(RUNTIME_ANCHOR_LINE)) {
    throw new UserError('Could not find the Runtime anchor line in the skill body.');
  }
  return body.replace(
    RUNTIME_ANCHOR_LINE,
    `node "${runtimePath}" generate --prompt-file <file> ...`
  );
}

export const WIZARD_ANCHOR_LINE =
  '<this skill\'s own directory>/../visualkan/SKILL.md';

export function rewriteWizardSiblingPath(body, siblingPath) {
  if (!body.includes(WIZARD_ANCHOR_LINE)) {
    throw new UserError('Could not find the Wizard sibling anchor line in the skill body.');
  }
  return body.replace(WIZARD_ANCHOR_LINE, siblingPath);
}

// Both skills install together. An optional install would mean that the user
// has to know that the Wizard exists, which is the problem the Wizard solves.
export function cmdInstall(flags = {}, positional = [], options = {}) {
  const platformKey = positional[0];
  if (!platformKey) {
    throw new UserError(`Which platform? Choose one of: ${Object.keys(PLATFORMS).join(', ')}.`);
  }
  const home = options.home ?? homedir();
  const projectRoot = typeof flags?.project === 'string' ? flags.project : (options.projectRoot ?? options.project ?? null);
  const packageDir = options.packageDir ?? HERE;
  const log = options.log ?? console.log;

  const runtimeSource = join(packageDir, 'skills', PRIMARY_SKILL, RUNTIME_DIR, RUNTIME_FILE);
  if (!existsSync(runtimeSource)) {
    throw new UserError(`The Runtime is missing from the package at ${runtimeSource}.`);
  }
  for (const style of Object.keys(STYLES)) {
    const source = join(packageDir, 'skills', PRIMARY_SKILL, REFERENCE_DIR, `style-${style}.md`);
    if (!existsSync(source)) {
      throw new UserError(`The Style Template for "${style}" is missing from the package at ${source}.`);
    }
  }

  const runtimeP = runtimePath(platformKey, projectRoot, PRIMARY_SKILL, home);
  const siblingP = installedPath(platformKey, projectRoot, PRIMARY_SKILL, ['SKILL.md'], home);

  for (const skillName of Object.keys(SKILLS)) {
    const { md } = skillSourceFiles(skillName, packageDir);
    const sourceDir = join(packageDir, 'skills', skillName);
    const dir = targetDir(platformKey, projectRoot, skillName, home);
    cpSync(sourceDir, dir, { recursive: true });

    let body = readFileSync(md, 'utf8');
    if (skillName === PRIMARY_SKILL) {
      body = rewriteRuntimePath(body, runtimeP);
    } else if (skillName === 'visualkan-wizard') {
      body = rewriteWizardSiblingPath(body, siblingP);
    }
    writeFileSync(join(dir, 'SKILL.md'), body);
    log(`Installed ${skillName} v${version(packageDir)} to ${join(dir, 'SKILL.md')}`);
  }
  log(`Runtime path written into visualkan: ${runtimeP}`);
}

export function cmdUninstall(flags = {}, positional = [], options = {}) {
  const platformKey = positional[0];
  if (!platformKey) {
    throw new UserError(`Which platform? Choose one of: ${Object.keys(PLATFORMS).join(', ')}.`);
  }
  const home = options.home ?? homedir();
  const projectRoot = typeof flags?.project === 'string' ? flags.project : (options.projectRoot ?? options.project ?? null);
  const log = options.log ?? console.log;

  for (const skillName of Object.keys(SKILLS)) {
    const dir = targetDir(platformKey, projectRoot, skillName, home);
    if (!existsSync(dir)) {
      log(`${skillName} is not installed at ${dir}`);
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
    log(`Uninstalled ${skillName} from ${dir}`);
  }
}

// Reads the version an installed skill folder was written with. That number
// also dates the Runtime beside it, because install writes both together.
export function installedVersion(dir, skillNameOrRead = basename(dir), read = readFileSync, exists = existsSync) {
  let skillName = basename(dir);
  let readFn = read;
  let existsFn = exists;
  if (typeof skillNameOrRead === 'function') {
    readFn = skillNameOrRead;
    existsFn = typeof read === 'function' ? read : existsSync;
  } else if (typeof skillNameOrRead === 'string') {
    skillName = skillNameOrRead;
  }
  const meta = join(dir, `${skillName}.metadata.json`);
  if (!existsFn(meta)) return null;
  try {
    return JSON.parse(readFn(meta, 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

export function cmdStatus(flags = {}, positional = [], options = {}) {
  const opts = (flags && (flags.home || flags.log || flags.packageDir)) ? flags : options;
  const home = opts.home ?? homedir();
  const packageDir = opts.packageDir ?? HERE;
  const log = opts.log ?? console.log;

  const current = version(packageDir);
  log(`${PRIMARY_SKILL} v${current}`);
  let skew = false;
  for (const key of Object.keys(PLATFORMS)) {
    for (const skillName of Object.keys(SKILLS)) {
      const dir = targetDir(key, null, skillName, home);
      const installed = existsSync(join(dir, 'SKILL.md')) ? installedVersion(dir, skillName) : null;
      const runtime = skillName === PRIMARY_SKILL ? existsSync(join(dir, RUNTIME_DIR, RUNTIME_FILE)) : true;
      let mark = '-';
      if (installed) {
        mark = installed === current ? `v${installed}` : `v${installed} STALE`;
        if (installed !== current) skew = true;
        if (!runtime) {
          mark += ' no-runtime';
          skew = true;
        }
      }
      log(`  ${key.padEnd(12)} ${skillName.padEnd(17)} ${mark.padEnd(16)} ${dir}`);
    }
  }
  if (skew) {
    log('');
    log(`A skill above was installed by an older version, or is missing its Runtime.`);
    log(`Re-run: visualkan install <platform>`);
  }
}

// --- Version ---------------------------------------------------------------

function version(packageDir = HERE) {
  return JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')).version;
}

// Keeps every skill metadata file, plugin.json, and controls.md in step with
// package.json. Run by `npm version`.
export function cmdSyncVersion(packageDir = HERE, log = console.log) {
  const today = new Date().toISOString().slice(0, 10);
  const ver = version(packageDir);

  const pluginPath = join(packageDir, '.claude-plugin', 'plugin.json');
  if (existsSync(pluginPath)) {
    const plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));
    plugin.version = ver;
    writeFileSync(pluginPath, `${JSON.stringify(plugin, null, 2)}\n`);
    log(`plugin.json set to v${plugin.version}`);
  }

  for (const skillName of Object.keys(SKILLS)) {
    const { meta: target } = skillSourceFiles(skillName, packageDir);
    const meta = JSON.parse(readFileSync(target, 'utf8'));
    meta.version = ver;
    meta.updated = today;
    writeFileSync(target, `${JSON.stringify(meta, null, 2)}\n`);
    log(`${skillName}.metadata.json set to v${meta.version} (${meta.updated})`);
  }

  const controlsDir = join(packageDir, 'skills', 'visualkan-wizard', 'references');
  if (!existsSync(controlsDir)) {
    mkdirSync(controlsDir, { recursive: true });
  }
  const controlsTarget = join(controlsDir, 'controls.md');
  writeFileSync(controlsTarget, `${controlsReport({}, ver)}\n`);
  log(`controls.md generated for visualkan-wizard (v${ver})`);
}

// --- Entry point -----------------------------------------------------------

const USAGE = `visualkan v__VERSION__

  visualkan install <platform> [--project DIR]
  visualkan uninstall <platform> [--project DIR]
  visualkan status
  visualkan controls
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
    case 'status': return cmdStatus(flags, rest);
    // Forwarded to the Runtime, which is the one place these live.
    case 'controls': return void console.log(controlsReport(process.env));
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
