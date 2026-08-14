#!/usr/bin/env node
// Visualkan CLI: installs the skill, and performs image generation for the
// API backends. Zero runtime dependencies — Node only.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_NAME = 'visualkan';

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

export const STYLE_SIZES = {
  whiteboard: '1536x1024',
  infographic: '1024x1536',
  presentation: '1536x1024',
  diagram: '1024x1024',
  mindmap: '1536x1024',
  'mindmap-structured': '1536x1024',
  mockup: '1024x1536',
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

function skillFiles() {
  const md = join(HERE, 'skill', `${SKILL_NAME}.md`);
  const meta = join(HERE, 'skill', 'metadata.json');
  if (!existsSync(md) || !existsSync(meta)) {
    throw new UserError(`Skill files are missing from the package at ${join(HERE, 'skill')}.`);
  }
  return { md, meta };
}

export function targetDir(platformKey, projectRoot) {
  const platform = PLATFORMS[platformKey];
  if (!platform) {
    throw new UserError(
      `Unknown platform "${platformKey}". Choose one of: ${Object.keys(PLATFORMS).join(', ')}.`
    );
  }
  if (projectRoot) {
    if (!platform.project) {
      throw new UserError(`${platform.label} supports global scope only, so --project does not apply.`);
    }
    return join(resolve(projectRoot), ...platform.project, SKILL_NAME);
  }
  return join(homedir(), ...platform.global, SKILL_NAME);
}

function cmdInstall(flags, positional) {
  const platformKey = positional[0];
  if (!platformKey) {
    throw new UserError(`Which platform? Choose one of: ${Object.keys(PLATFORMS).join(', ')}.`);
  }
  const { md, meta } = skillFiles();
  const dir = targetDir(platformKey, typeof flags.project === 'string' ? flags.project : null);
  mkdirSync(dir, { recursive: true });
  copyFileSync(md, join(dir, 'SKILL.md'));
  copyFileSync(meta, join(dir, 'metadata.json'));
  console.log(`Installed ${SKILL_NAME} v${version()} to ${join(dir, 'SKILL.md')}`);
}

function cmdUninstall(flags, positional) {
  const platformKey = positional[0];
  if (!platformKey) {
    throw new UserError(`Which platform? Choose one of: ${Object.keys(PLATFORMS).join(', ')}.`);
  }
  const dir = targetDir(platformKey, typeof flags.project === 'string' ? flags.project : null);
  if (!existsSync(dir)) {
    console.log(`${SKILL_NAME} is not installed at ${dir}`);
    return;
  }
  rmSync(dir, { recursive: true, force: true });
  console.log(`Uninstalled ${SKILL_NAME} from ${dir}`);
}

function cmdStatus() {
  console.log(`${SKILL_NAME} v${version()}`);
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    const dir = targetDir(key, null);
    const mark = existsSync(join(dir, 'SKILL.md')) ? 'installed' : '-';
    console.log(`  ${key.padEnd(12)} ${mark.padEnd(10)} ${dir}`);
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
  const prefix = typeof flags.prefix === 'string' ? flags.prefix : SKILL_NAME;
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

// Keeps skill/metadata.json in step with package.json. Run by `npm version`.
function cmdSyncVersion() {
  const target = join(HERE, 'skill', 'metadata.json');
  const meta = JSON.parse(readFileSync(target, 'utf8'));
  meta.version = version();
  meta.updated = new Date().toISOString().slice(0, 10);
  writeFileSync(target, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`metadata.json set to v${meta.version} (${meta.updated})`);
}

// --- Entry point -----------------------------------------------------------

const USAGE = `visualkan v__VERSION__

  visualkan install <platform> [--project DIR]
  visualkan uninstall <platform> [--project DIR]
  visualkan status
  visualkan generate --prompt-file PATH [options]

Platforms: ${Object.keys(PLATFORMS).join(', ')}

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
