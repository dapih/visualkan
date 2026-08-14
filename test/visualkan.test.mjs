import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  parseArgs,
  detectBackend,
  validateModel,
  resolveSize,
  sizeToAspect,
  extractImage,
  nextOutputPath,
  targetDir,
  PLATFORMS,
  STYLE_SIZES,
} from '../visualkan.mjs';

// --- parseArgs -------------------------------------------------------------

test('parseArgs separates flags from positional arguments', () => {
  const { flags, positional } = parseArgs(['install', 'claude', '--project', '/tmp/x']);
  assert.deepEqual(positional, ['install', 'claude']);
  assert.equal(flags.project, '/tmp/x');
});

test('parseArgs treats a flag followed by a flag as boolean', () => {
  const { flags } = parseArgs(['generate', '--verbose', '--backend', 'openai']);
  assert.equal(flags.verbose, true);
  assert.equal(flags.backend, 'openai');
});

// --- detectBackend ---------------------------------------------------------

test('detectBackend refuses native, which never uses this CLI', () => {
  assert.throws(() => detectBackend('native', {}), /native backend does not use this CLI/);
});

test('detectBackend rejects an unknown backend name', () => {
  assert.throws(() => detectBackend('midjourney', {}), /Unknown backend "midjourney"/);
});

test('detectBackend requires the matching key for an explicit backend', () => {
  assert.throws(() => detectBackend('gemini', { OPENAI_API_KEY: 'x' }), /requires GEMINI_API_KEY/);
  assert.equal(detectBackend('gemini', { GEMINI_API_KEY: 'x' }), 'gemini');
});

test('detectBackend auto-detects in the documented priority order', () => {
  assert.equal(detectBackend(null, { OPENROUTER_API_KEY: 'c' }), 'openrouter');
  assert.equal(detectBackend(null, { GEMINI_API_KEY: 'b', OPENROUTER_API_KEY: 'c' }), 'gemini');
  assert.equal(
    detectBackend(null, { OPENAI_API_KEY: 'a', GEMINI_API_KEY: 'b', OPENROUTER_API_KEY: 'c' }),
    'openai'
  );
});

test('detectBackend explains itself when no key is present', () => {
  assert.throws(() => detectBackend(null, {}), /No image generation backend found/);
});

// --- validateModel (ADR 0003) ----------------------------------------------

test('validateModel rejects --model on backends that cannot honour it', () => {
  assert.throws(() => validateModel('openai', 'flux'), /--model applies to --backend openrouter only/);
  assert.throws(() => validateModel('gemini', 'flux'), /--model applies to --backend openrouter only/);
});

test('validateModel accepts --model on openrouter', () => {
  assert.equal(validateModel('openrouter', 'krea/krea-image'), 'krea/krea-image');
});

test('validateModel falls back to the fixed model per backend', () => {
  assert.equal(validateModel('openai', null), 'gpt-image-2');
  assert.equal(validateModel('openrouter', null), 'bytedance-seed/seedream-4.5');
});

// --- sizing ----------------------------------------------------------------

test('resolveSize uses the documented default for every style', () => {
  for (const [style, expected] of Object.entries(STYLE_SIZES)) {
    assert.equal(resolveSize({ size: null, style, device: 'mobile' }), expected);
  }
});

test('resolveSize turns a desktop mockup landscape', () => {
  assert.equal(resolveSize({ size: null, style: 'mockup', device: 'mobile' }), '1024x1536');
  assert.equal(resolveSize({ size: null, style: 'mockup', device: 'desktop' }), '1536x1024');
});

test('resolveSize honours an explicit size and rejects a malformed one', () => {
  assert.equal(resolveSize({ size: '800x600', style: 'diagram' }), '800x600');
  assert.throws(() => resolveSize({ size: 'huge', style: 'diagram' }), /--size must look like/);
});

test('sizeToAspect maps orientation correctly', () => {
  assert.equal(sizeToAspect('1024x1024'), '1:1');
  assert.equal(sizeToAspect('1536x1024'), '3:2');
  assert.equal(sizeToAspect('1024x1536'), '2:3');
});

// --- response parsing ------------------------------------------------------

test('extractImage reads base64 from an OpenAI-shaped response', () => {
  assert.deepEqual(extractImage('openai', { data: [{ b64_json: 'QUJD' }] }), { b64: 'QUJD' });
});

test('extractImage falls back to a URL when OpenRouter returns one', () => {
  assert.deepEqual(
    extractImage('openrouter', { data: [{ url: 'https://example.test/a.png' }] }),
    { url: 'https://example.test/a.png' }
  );
});

test('extractImage digs inlineData out of a Gemini response', () => {
  const body = {
    candidates: [{ content: { parts: [{ text: 'here you go' }, { inlineData: { data: 'QUJD' } }] } }],
  };
  assert.deepEqual(extractImage('gemini', body), { b64: 'QUJD' });
});

test('extractImage returns null rather than throwing on an empty response', () => {
  assert.equal(extractImage('openai', {}), null);
  assert.equal(extractImage('gemini', { candidates: [] }), null);
  assert.equal(extractImage('openai', { data: [{}] }), null);
});

test('base64 payloads decode to real bytes', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const { b64 } = extractImage('openai', { data: [{ b64_json: png.toString('base64') }] });
  assert.deepEqual(Buffer.from(b64, 'base64'), png);
});

// --- output naming ---------------------------------------------------------

test('nextOutputPath starts at 1 when nothing exists', () => {
  assert.equal(nextOutputPath('out', 'visualkan', () => false), join('out', 'visualkan-1.png'));
});

test('nextOutputPath skips names already taken', () => {
  const taken = new Set([join('out', 'visualkan-1.png'), join('out', 'visualkan-2.png')]);
  assert.equal(nextOutputPath('out', 'visualkan', (p) => taken.has(p)), join('out', 'visualkan-3.png'));
});

// --- install targets -------------------------------------------------------

test('targetDir resolves global scope under the home directory', () => {
  assert.equal(targetDir('claude', null), join(homedir(), '.claude', 'skills', 'visualkan'));
  assert.equal(targetDir('codex', null), join(homedir(), '.codex', 'skills', 'visualkan'));
});

test('targetDir sends Antigravity project scope to .agents, not .gemini', () => {
  const dir = targetDir('antigravity', '/srv/app');
  assert.match(dir.replaceAll('\\', '/'), /\/srv\/app\/\.agents\/skills\/visualkan$/);
});

test('targetDir rejects --project for a global-only platform', () => {
  assert.throws(() => targetDir('openclaw', '/srv/app'), /supports global scope only/);
});

test('targetDir rejects an unknown platform and lists the valid ones', () => {
  assert.throws(() => targetDir('emacs', null), /Unknown platform "emacs"/);
});

test('every platform declares a label and a global path', () => {
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    assert.ok(platform.label, `${key} needs a label`);
    assert.ok(Array.isArray(platform.global) && platform.global.length, `${key} needs a global path`);
  }
});

// --- paths with spaces, the 0.1.0 Makefile bug -----------------------------

test('a home directory containing a space survives path construction', () => {
  const dir = targetDir('claude', '/c/Users/Davi Muammar/proj');
  assert.ok(dir.includes('Davi Muammar'), 'the space must be preserved, not split');
  assert.ok(dir.endsWith(join('.claude', 'skills', 'visualkan')));
});
