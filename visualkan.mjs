#!/usr/bin/env node
// Visualkan CLI: installs the skill, and performs image generation for the
// API backends. Zero runtime dependencies — Node only.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRIMARY_SKILL = 'visualkan';

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

// --- Backend registry ------------------------------------------------------
// `native` is deliberately absent. That backend runs inside the host agent via
// its own generate_image tool, so the CLI is never involved. See ADR 0004.
export const BACKENDS = {
  openai: { label: 'OpenAI gpt-image-2', env: 'OPENAI_API_KEY', model: 'gpt-image-2' },
  gemini: { label: 'Gemini Nano Banana 2', env: 'GEMINI_API_KEY', model: 'gemini-2.0-flash-preview-image-generation' },
  openrouter: { label: 'OpenRouter', env: 'OPENROUTER_API_KEY', model: 'bytedance-seed/seedream-4.5' },
};

// Auto-detection order, matching the documented priority.
const DETECT_ORDER = ['openai', 'gemini', 'openrouter'];

// --- Control registry ------------------------------------------------------
// The legal values for every Control, printed by `visualkan controls`. One list
// serves the CLI, the skill, and the Wizard, so a menu cannot drift from the
// code. A list of legal values is policy, which ADR 0004 gives to the CLI.

export const STYLES = {
  whiteboard: { size: '1536x1024', blurb: 'Hand-drawn teaching board. Markers, doodles, arrows, one color per Section.' },
  infographic: { size: '1024x1536', blurb: 'Numbered editorial layout. Portrait, icon per Section, best for text-heavy Content.' },
  presentation: { size: '1536x1024', blurb: 'One keynote slide. A single dominant visual and 2 to 5 takeaways.' },
  diagram: { size: '1024x1024', blurb: 'Technical figure. Boxes, arrows, exact labels, engineering documentation.' },
  mindmap: { size: '1536x1024', blurb: 'Radial and colorful. Organic branches from a center, vibrant at every Draw Level.' },
  'mindmap-structured': { size: '1536x1024', blurb: 'XMind style. Muted palette, badges and counts, ready for a board pack.' },
  mockup: { size: '1024x1536', blurb: 'UI wireframe inside a device frame. Pair it with --device.' },
};

// resolveSize and the test suite read the sizes alone. Derived, never a second copy.
export const STYLE_SIZES = Object.fromEntries(
  Object.entries(STYLES).map(([name, style]) => [name, style.size])
);

export const DRAW_LEVELS = {
  sketch: 'Rough and hand-drawn. Playful, visibly made by a person.',
  normal: 'Balanced. Clean execution that still reads as drawn.',
  polished: 'Precise and professional. Exact geometry and typesetting.',
};

// The Section counts are the Clarification trigger. Content that cannot fill
// `min` Sections forces the agent to invent them. See ADR 0005.
export const COMPLEXITIES = {
  simple: { min: 3, max: 4 },
  moderate: { min: 5, max: 7 },
  detailed: { min: 8, max: 12 },
};

export const DEVICES = {
  mobile: 'Phone frame, portrait.',
  desktop: 'Browser window, landscape.',
  tablet: 'Tablet frame, portrait.',
};

export const MODES = {
  single: 'One Frame. One call to the image API.',
  'multi-frame': 'Three to five Frames that build up. One call for each, so the cost multiplies.',
};

class UserError extends Error {}

// --- Pure helpers (covered by the test suite) ------------------------------

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

export function detectBackend(requested, env) {
  if (requested === 'native') {
    throw new UserError(
      'The native backend does not use this CLI.\n' +
      'Antigravity and Codex generate images with their own generate_image tool.\n' +
      'Use --backend openai, gemini, or openrouter here.'
    );
  }
  if (requested) {
    const backend = BACKENDS[requested];
    if (!backend) {
      throw new UserError(`Unknown backend "${requested}". Choose openai, gemini, or openrouter.`);
    }
    if (!env[backend.env]) {
      throw new UserError(`--backend ${requested} requires ${backend.env}, which is not set.`);
    }
    return requested;
  }
  for (const name of DETECT_ORDER) {
    if (env[BACKENDS[name].env]) return name;
  }
  throw new UserError(
    'No image generation backend found. Set one of:\n' +
    '  OPENAI_API_KEY       # from platform.openai.com\n' +
    '  GEMINI_API_KEY       # from aistudio.google.com/apikey\n' +
    '  OPENROUTER_API_KEY   # from openrouter.ai/keys\n' +
    'In Antigravity or Codex, use the native generate_image tool instead.'
  );
}

// ADR 0003: --model applies to openrouter only. Reject it elsewhere rather
// than accepting it and silently generating with a different model.
export function validateModel(backend, model) {
  if (model && backend !== 'openrouter') {
    throw new UserError(
      '--model applies to --backend openrouter only.\n' +
      `The ${backend} backend runs a fixed model, so --model would be ignored.\n` +
      'Either drop --model, or pass --backend openrouter to choose a model.'
    );
  }
  return model || (backend === 'openrouter' ? BACKENDS.openrouter.model : BACKENDS[backend].model);
}

// Reports which Backends this environment can reach, without throwing and
// without reading a key value. detectBackend throws when none is present, so
// the catalog cannot reuse it. ADR 0004 keeps key handling inside the CLI.
export function availableBackends(env) {
  return DETECT_ORDER.filter((name) => Boolean(env[BACKENDS[name].env]));
}

// Builds the Control catalog that `visualkan controls` prints. The Wizard reads
// this output instead of carrying its own copy of the value lists.
export function controlsReport(env) {
  const lines = [];
  const pad = (text, width) => String(text).padEnd(width);

  lines.push('Visualkan Controls', '');

  lines.push('--style          Default: whiteboard');
  for (const [name, style] of Object.entries(STYLES)) {
    lines.push(`  ${pad(name, 20)}${pad(style.size, 11)}${style.blurb}`);
  }
  lines.push('');

  lines.push('--draw-level     Default: normal');
  for (const [name, blurb] of Object.entries(DRAW_LEVELS)) {
    lines.push(`  ${pad(name, 20)}${blurb}`);
  }
  lines.push('');

  lines.push('--complexity     Default: moderate');
  for (const [name, range] of Object.entries(COMPLEXITIES)) {
    lines.push(`  ${pad(name, 20)}${range.min} to ${range.max} Sections`);
  }
  lines.push('');

  lines.push('--device         Default: mobile. Applies to --style mockup only.');
  for (const [name, blurb] of Object.entries(DEVICES)) {
    lines.push(`  ${pad(name, 20)}${blurb}`);
  }
  lines.push('');

  lines.push('--mode           Default: single');
  for (const [name, blurb] of Object.entries(MODES)) {
    lines.push(`  ${pad(name, 20)}${blurb}`);
  }
  lines.push('');

  const available = availableBackends(env);
  lines.push('--backend        Default: the first available in this list');
  for (const name of DETECT_ORDER) {
    const state = env[BACKENDS[name].env] ? 'available' : `set ${BACKENDS[name].env}`;
    lines.push(`  ${pad(name, 20)}${pad(BACKENDS[name].label, 24)}${state}`);
  }
  lines.push(`  ${pad('native', 20)}${pad('Antigravity and Codex', 24)}runs in the platform, never this CLI`);
  lines.push(
    available.length
      ? `  Auto-detect chooses: ${available[0]}`
      : '  Auto-detect finds nothing. Set a key, or use the native generate_image tool.'
  );
  lines.push('');

  lines.push('--model          Applies to --backend openrouter only. See ADR 0003.');
  lines.push(`  ${pad('default', 20)}${BACKENDS.openrouter.model}`);
  lines.push('');

  lines.push('--size, --output, --prefix, --from   See `visualkan help`.');

  return lines.join('\n');
}

export function resolveSize({ size, style, device }) {
  if (size) {
    if (!/^\d+x\d+$/.test(size)) throw new UserError(`--size must look like 1536x1024, got "${size}".`);
    return size;
  }
  if (style === 'mockup' && device === 'desktop') return '1536x1024';
  return STYLE_SIZES[style] ?? '1536x1024';
}

// OpenRouter takes a ratio, not pixels. Models set their own pixel floors —
// seedream-4.5 rejects anything under 3.7 megapixels — so sending explicit
// pixels breaks per model, while a ratio works with all of them.
export function sizeToAspect(size) {
  const [w, h] = size.split('x').map(Number);
  if (w === h) return '1:1';
  return w > h ? '3:2' : '2:3';
}

export function extractImage(backend, body) {
  if (backend === 'gemini') {
    const parts = body?.candidates?.[0]?.content?.parts ?? [];
    const part = parts.find((p) => p.inlineData?.data);
    if (!part) return null;
    return { b64: part.inlineData.data, mediaType: part.inlineData.mimeType ?? null };
  }
  const first = body?.data?.[0];
  if (!first) return null;
  const mediaType = first.media_type ?? null;
  if (first.b64_json) return { b64: first.b64_json, mediaType };
  if (first.url) return { url: first.url, mediaType };
  return null;
}

// --- Output format ---------------------------------------------------------
// The file name must state the truth about the bytes. Every backend is asked
// for PNG, but a provider can answer with something else, so the extension is
// decided after the bytes arrive, not before.

const MEDIA_TYPE_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const MAGIC_NUMBERS = [
  { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  { ext: 'gif', magic: [0x47, 0x49, 0x46, 0x38] },
];

function matchesMagic(bytes, magic, offset = 0) {
  return magic.every((byte, i) => bytes[offset + i] === byte);
}

export function imageExtension(bytes, mediaType) {
  if (bytes?.length) {
    for (const { ext, magic } of MAGIC_NUMBERS) {
      if (matchesMagic(bytes, magic)) return ext;
    }
    // WebP is a RIFF container. The format tag sits at offset 8.
    if (matchesMagic(bytes, [0x52, 0x49, 0x46, 0x46]) && matchesMagic(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
      return 'webp';
    }
  }
  return MEDIA_TYPE_EXTENSIONS[mediaType] ?? 'png';
}

export function nextOutputPath(dir, prefix, exists, ext = 'png') {
  for (let n = 1; n < 1000; n++) {
    const candidate = join(dir, `${prefix}-${n}.${ext}`);
    if (!exists(candidate)) return candidate;
  }
  throw new UserError(`Could not find a free filename for "${prefix}-N.${ext}" in ${dir}.`);
}

// --- Install ---------------------------------------------------------------

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

// Both skills install together. An optional install would mean that the user
// has to know that the Wizard exists, which is the problem the Wizard solves.
function cmdInstall(flags, positional) {
  const platformKey = positional[0];
  if (!platformKey) {
    throw new UserError(`Which platform? Choose one of: ${Object.keys(PLATFORMS).join(', ')}.`);
  }
  const projectRoot = typeof flags.project === 'string' ? flags.project : null;
  for (const skillName of Object.keys(SKILLS)) {
    const { md, meta } = skillSourceFiles(skillName);
    const dir = targetDir(platformKey, projectRoot, skillName);
    mkdirSync(dir, { recursive: true });
    copyFileSync(md, join(dir, 'SKILL.md'));
    copyFileSync(meta, join(dir, 'metadata.json'));
    console.log(`Installed ${skillName} v${version()} to ${join(dir, 'SKILL.md')}`);
  }
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

function cmdStatus() {
  console.log(`${PRIMARY_SKILL} v${version()}`);
  for (const key of Object.keys(PLATFORMS)) {
    for (const skillName of Object.keys(SKILLS)) {
      const dir = targetDir(key, null, skillName);
      const mark = existsSync(join(dir, 'SKILL.md')) ? 'installed' : '-';
      console.log(`  ${key.padEnd(12)} ${skillName.padEnd(17)} ${mark.padEnd(10)} ${dir}`);
    }
  }
}

// --- Generate --------------------------------------------------------------

async function callBackend(backend, model, prompt, size, env) {
  if (backend === 'openai') {
    return postJson('https://api.openai.com/v1/images/generations', {
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: { model, prompt, size, quality: 'high', output_format: 'png' },
    });
  }
  if (backend === 'gemini') {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    return postJson(url, {
      body: {
        contents: [{ parts: [{ text: `${prompt}\n\nRender at approximately ${size} pixels.` }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      },
    });
  }
  return postJson('https://openrouter.ai/api/v1/images', {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
    body: { model, prompt, aspect_ratio: sizeToAspect(size), output_format: 'png' },
  });
}

async function postJson(url, { headers = {}, body }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new UserError(`${new URL(url).host} returned ${response.status}:\n${text.slice(0, 600)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new UserError(`${new URL(url).host} returned a response that is not JSON:\n${text.slice(0, 300)}`);
  }
}

async function cmdGenerate(flags) {
  const promptFile = flags['prompt-file'];
  if (typeof promptFile !== 'string') {
    throw new UserError('--prompt-file PATH is required. Write the prompt to a file, do not pass it as an argument.');
  }
  if (!existsSync(promptFile)) throw new UserError(`Prompt file not found: ${promptFile}`);
  const prompt = readFileSync(promptFile, 'utf8').trim();
  if (!prompt) throw new UserError(`Prompt file is empty: ${promptFile}`);

  const backend = detectBackend(typeof flags.backend === 'string' ? flags.backend : null, process.env);
  const model = validateModel(backend, typeof flags.model === 'string' ? flags.model : null);
  const size = resolveSize({
    size: typeof flags.size === 'string' ? flags.size : null,
    style: typeof flags.style === 'string' ? flags.style : 'whiteboard',
    device: typeof flags.device === 'string' ? flags.device : 'mobile',
  });

  const outDir = typeof flags.output === 'string' ? flags.output : '.';
  const prefix = typeof flags.prefix === 'string' ? flags.prefix : PRIMARY_SKILL;
  mkdirSync(outDir, { recursive: true });

  // Report what the backend was actually asked for. OpenRouter receives a
  // ratio, so claiming a pixel size there would be false.
  const sizing = backend === 'openrouter' ? `aspect ${sizeToAspect(size)}` : size;
  console.error(`Backend: ${BACKENDS[backend].label} (model ${model}, ${sizing})`);

  const body = await callBackend(backend, model, prompt, size, process.env);
  const image = extractImage(backend, body);
  if (!image) {
    throw new UserError(
      `${BACKENDS[backend].label} returned no image data.\n` +
      `Response keys: ${Object.keys(body ?? {}).join(', ') || '(none)'}`
    );
  }

  let bytes;
  if (image.b64) {
    bytes = Buffer.from(image.b64, 'base64');
  } else {
    const res = await fetch(image.url);
    if (!res.ok) throw new UserError(`Could not download the image from ${image.url} (${res.status}).`);
    bytes = Buffer.from(await res.arrayBuffer());
  }

  const ext = imageExtension(bytes, image.mediaType);
  let outPath;
  if (typeof flags.out === 'string') {
    outPath = flags.out;
    // --out is an exact path, so honour it. Say so when the bytes disagree.
    const given = /\.([a-z0-9]+)$/i.exec(outPath)?.[1]?.toLowerCase();
    const normalised = given === 'jpeg' ? 'jpg' : given;
    if (normalised !== ext) {
      console.error(`Warning: the image is ${ext.toUpperCase()}, but --out names ${outPath}.`);
    }
  } else {
    outPath = nextOutputPath(outDir, prefix, existsSync, ext);
  }

  writeFileSync(outPath, bytes);
  console.log(outPath);
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
`;

async function main(argv) {
  const { flags, positional } = parseArgs(argv);
  const command = positional[0];
  const rest = positional.slice(1);

  switch (command) {
    case 'install': return cmdInstall(flags, rest);
    case 'uninstall': return cmdUninstall(flags, rest);
    case 'status': return cmdStatus();
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
