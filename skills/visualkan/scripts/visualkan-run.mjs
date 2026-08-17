#!/usr/bin/env node
// Visualkan Runtime: the Control catalog and image generation.
//
// This file is reached two ways, and it is the same file both times. The
// Installer imports it so that `visualkan controls` and `visualkan generate`
// keep working from the global command. `visualkan install` also copies it into
// <skill>/scripts/, where an agent runs it by an absolute path that needs no
// PATH lookup. See ADR 0006.
//
// It carries no version of its own. The version that matters is the one in the
// <skill>/metadata.json written beside it at install time, and the Installer
// reads that to report skew.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// This file sits in scripts/, so references/ is its sibling one level up. That
// holds in the package and in an installed skill folder alike, because install
// copies both directories into the same parent.
const HERE = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PREFIX = 'visualkan';

export class UserError extends Error {}

// --- Backend registry ------------------------------------------------------
// `native` is deliberately absent. That backend runs inside the host agent via
// its own generate_image tool, so the Runtime is never involved. See ADR 0004.
export const BACKENDS = {
  openai: { label: 'OpenAI gpt-image-2', env: 'OPENAI_API_KEY', model: 'gpt-image-2' },
  gemini: { label: 'Gemini Nano Banana 2', env: 'GEMINI_API_KEY', model: 'gemini-2.0-flash-preview-image-generation' },
  openrouter: { label: 'OpenRouter', env: 'OPENROUTER_API_KEY', model: 'bytedance-seed/seedream-4.5' },
};

// Auto-detection order, matching the documented priority.
export const DETECT_ORDER = ['openai', 'gemini', 'openrouter'];

// --- Control registry ------------------------------------------------------
// The legal values for every Control, printed by `visualkan controls`. One list
// serves the Installer, the skill, and the Wizard, so a menu cannot drift from
// the code. A list of legal values is policy, which ADR 0004 gives to the CLI.

// `requires` lists the section headers a finished Image Prompt must carry for
// that Style. They are taken from the Style Template itself, and `generate`
// rejects a prompt missing any of them.
//
// This is the gate that makes moving the templates out of the skill body safe.
// Without it, an agent that skipped the template would produce a weaker prompt
// and nothing would notice. See ADR 0007.
export const STYLES = {
  whiteboard: {
    size: '1536x1024',
    blurb: 'Hand-drawn teaching board. Markers, doodles, arrows, one color per Section.',
    requires: ['CANVAS', 'TITLE', 'LAYOUT', 'SECTIONS', 'COLORS', 'TYPOGRAPHY', 'OVERALL FEEL'],
  },
  infographic: {
    size: '1024x1536',
    blurb: 'Numbered editorial layout. Portrait, icon per Section, best for text-heavy Content.',
    requires: ['CANVAS', 'HEADER', 'COLOR PALETTE', 'LAYOUT', 'NUMBERED SECTIONS', 'TYPOGRAPHY', 'OVERALL FEEL'],
  },
  presentation: {
    size: '1536x1024',
    blurb: 'One keynote slide. A single dominant visual and 2 to 5 takeaways.',
    requires: ['CANVAS', 'TITLE', 'VISUAL HIERARCHY', 'PRIMARY VISUAL', 'KEY POINTS', 'TYPOGRAPHY', 'OVERALL FEEL'],
  },
  diagram: {
    size: '1024x1024',
    blurb: 'Technical figure. Boxes, arrows, exact labels, engineering documentation.',
    requires: ['CANVAS', 'TITLE', 'DIAGRAM TYPE', 'NODES/ELEMENTS', 'CONNECTIONS', 'TYPOGRAPHY', 'OVERALL FEEL'],
  },
  mindmap: {
    size: '1536x1024',
    blurb: 'Radial and colorful. Organic branches from a center, vibrant at every Draw Level.',
    requires: ['CANVAS', 'CENTER NODE', 'MAIN BRANCHES', 'COLORS', 'TYPOGRAPHY', 'OVERALL FEEL'],
  },
  'mindmap-structured': {
    size: '1536x1024',
    blurb: 'XMind style. Muted palette, badges and counts, ready for a board pack.',
    requires: ['CANVAS', 'CENTER NODE', 'MAIN BRANCHES', 'COLORS', 'LAYOUT RULES', 'TYPOGRAPHY', 'OVERALL FEEL'],
  },
  mockup: {
    size: '1024x1536',
    blurb: 'UI wireframe inside a device frame. Pair it with --device.',
    requires: ['BACKGROUND', 'DEVICE FRAME', 'SPACING AND LAYOUT', 'COLORS', 'TYPOGRAPHY', 'OVERALL FEEL'],
  },
};

// The Prompt Quality Checklist in the skill already states this floor. It is
// stated here too, because a number the CLI enforces cannot be prose alone.
export const PROMPT_MIN_WORDS = 300;

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
      'A platform that provides its own generate_image tool generates there.\n' +
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
    'On a platform with its own generate_image tool, use that tool instead.'
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
//
// `native` is never counted, and cannot be. Whether a generate_image tool
// exists is agent-side knowledge that this process never observes, so claiming
// it here would put a guess in a catalog whose value is that it prints facts.
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
  // Described by capability, never by product name. Any platform that gives the
  // agent a generate_image tool qualifies, and only the agent can see one.
  lines.push(`  ${pad('native', 20)}${pad('Any platform with its own', 26)}generate_image tool. Only the agent can detect it.`);
  lines.push(
    available.length
      ? `  Auto-detect chooses: ${available[0]}`
      : '  Auto-detect finds nothing here. Set a key, or use a native generate_image tool.'
  );
  lines.push('');

  lines.push('--model          Applies to --backend openrouter only. See ADR 0003.');
  lines.push(`  ${pad('default', 20)}${BACKENDS.openrouter.model}`);
  lines.push('');

  lines.push('--size, --output, --prefix, --from   See `visualkan help`.');

  return lines.join('\n');
}

// --- Style Templates -------------------------------------------------------
// A Style Template is a markdown file beside this one. The agent obtains it by
// running `template --style <name>`, never by reading a path it guessed, so a
// moved or missing file fails here with a clear message. See ADR 0007.

export function templatePath(style, here = HERE) {
  if (!STYLES[style]) {
    throw new UserError(
      `Unknown style "${style}". Choose one of: ${Object.keys(STYLES).join(', ')}.`
    );
  }
  return join(here, '..', 'references', `style-${style}.md`);
}

export function readTemplate(style, here = HERE, read = readFileSync, exists = existsSync) {
  const path = templatePath(style, here);
  if (!exists(path)) {
    throw new UserError(
      `The Style Template for "${style}" is missing at ${path}.\n` +
      'The install is stale or incomplete. Run: visualkan install <platform>'
    );
  }
  return read(path, 'utf8');
}

// Checks a finished Image Prompt against what its Style requires. Returns the
// missing pieces rather than throwing, so callers choose the wording.
export function promptGaps(prompt, style) {
  const gaps = [];
  const words = prompt.trim().split(/\s+/).filter(Boolean).length;
  if (words < PROMPT_MIN_WORDS) {
    gaps.push(`only ${words} words, and a prompt needs at least ${PROMPT_MIN_WORDS}`);
  }
  const required = STYLES[style]?.requires ?? [];
  const missing = required.filter((header) => !prompt.includes(header));
  if (missing.length) gaps.push(`missing section${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
  return gaps;
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

export async function cmdGenerate(flags) {
  const promptFile = flags['prompt-file'];
  if (typeof promptFile !== 'string') {
    throw new UserError('--prompt-file PATH is required. Write the prompt to a file, do not pass it as an argument.');
  }
  if (!existsSync(promptFile)) throw new UserError(`Prompt file not found: ${promptFile}`);
  const prompt = readFileSync(promptFile, 'utf8').trim();
  if (!prompt) throw new UserError(`Prompt file is empty: ${promptFile}`);

  const style = typeof flags.style === 'string' ? flags.style : 'whiteboard';

  // The gate. A prompt that skipped the Style Template fails here, before any
  // money is spent, instead of quietly producing a weaker image. See ADR 0007.
  const gaps = promptGaps(prompt, style);
  if (gaps.length) {
    throw new UserError(
      `This prompt does not match what the "${style}" style requires:\n` +
      gaps.map((g) => `  - ${g}`).join('\n') + '\n\n' +
      `Read the template and rebuild the prompt from it:\n` +
      `  node "${join(HERE, 'visualkan-run.mjs')}" template --style ${style}`
    );
  }

  const backend = detectBackend(typeof flags.backend === 'string' ? flags.backend : null, process.env);
  const model = validateModel(backend, typeof flags.model === 'string' ? flags.model : null);
  const size = resolveSize({
    size: typeof flags.size === 'string' ? flags.size : null,
    style,
    device: typeof flags.device === 'string' ? flags.device : 'mobile',
  });

  const outDir = typeof flags.output === 'string' ? flags.output : '.';
  const prefix = typeof flags.prefix === 'string' ? flags.prefix : DEFAULT_PREFIX;
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

// --- Entry point -----------------------------------------------------------
// Reached when an agent runs this file directly by absolute path. The Installer
// imports the same functions instead of spawning this.

export const RUNTIME_USAGE = `visualkan runtime

  node <this file> controls
  node <this file> generate --prompt-file PATH [options]

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

export async function runMain(argv) {
  const { flags, positional } = parseArgs(argv);
  switch (positional[0]) {
    case 'controls': return void console.log(controlsReport(process.env));
    case 'generate': return cmdGenerate(flags);
    case undefined:
    case 'help': return void console.log(RUNTIME_USAGE);
    default:
      throw new UserError(`Unknown runtime command "${positional[0]}".\n\n${RUNTIME_USAGE}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runMain(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof UserError ? error.message : error);
    // Set the code and let Node drain. On Windows, process.exit() while fetch
    // sockets are still closing aborts libuv and reports 127, not 1.
    process.exitCode = 1;
  });
}
