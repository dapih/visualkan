import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// The Installer owns install, uninstall, status, and sync-version.
import {
  targetDir,
  skillSourceFiles,
  runtimePath,
  skillDocPath,
  substitutions,
  applySubstitutions,
  installedVersion,
  toPosix,
  PLATFORMS,
  SKILLS,
} from '../visualkan.mjs';

// The Runtime owns the Controls and image generation. See ADR 0006.
import {
  parseArgs,
  detectBackend,
  validateModel,
  resolveSize,
  sizeToAspect,
  extractImage,
  imageExtension,
  nextOutputPath,
  availableBackends,
  controlsReport,
  STYLES,
  STYLE_SIZES,
  DRAW_LEVELS,
  COMPLEXITIES,
  DEVICES,
  MODES,
} from '../scripts/visualkan-run.mjs';

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
  assert.deepEqual(
    extractImage('openai', { data: [{ b64_json: 'QUJD' }] }),
    { b64: 'QUJD', mediaType: null }
  );
});

test('extractImage carries the media type OpenRouter reports', () => {
  assert.deepEqual(
    extractImage('openrouter', { data: [{ b64_json: 'QUJD', media_type: 'image/jpeg' }] }),
    { b64: 'QUJD', mediaType: 'image/jpeg' }
  );
});

test('extractImage falls back to a URL when OpenRouter returns one', () => {
  assert.deepEqual(
    extractImage('openrouter', { data: [{ url: 'https://example.test/a.png' }] }),
    { url: 'https://example.test/a.png', mediaType: null }
  );
});

test('extractImage digs inlineData out of a Gemini response', () => {
  const body = {
    candidates: [
      { content: { parts: [{ text: 'here you go' }, { inlineData: { data: 'QUJD', mimeType: 'image/png' } }] } },
    ],
  };
  assert.deepEqual(extractImage('gemini', body), { b64: 'QUJD', mediaType: 'image/png' });
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

// --- output format ---------------------------------------------------------
// OpenRouter answered a live request with JPEG bytes under a .png name. The
// extension must follow the bytes.

test('imageExtension reads the format out of the magic numbers', () => {
  assert.equal(imageExtension(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]), null), 'png');
  assert.equal(imageExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), null), 'jpg');
  assert.equal(imageExtension(Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39]), null), 'gif');
});

test('imageExtension recognises WebP by the tag at offset 8', () => {
  const webp = Buffer.from('RIFF____WEBPVP8 ', 'latin1');
  assert.equal(imageExtension(webp, null), 'webp');
});

test('imageExtension trusts the bytes over a media type that disagrees', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  assert.equal(imageExtension(jpeg, 'image/png'), 'jpg');
});

test('imageExtension falls back to the reported media type when bytes are unknown', () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8');
  assert.equal(imageExtension(svg, 'image/svg+xml'), 'svg');
});

test('imageExtension defaults to png when nothing identifies the format', () => {
  assert.equal(imageExtension(Buffer.from([0x00, 0x01, 0x02, 0x03]), null), 'png');
  assert.equal(imageExtension(null, null), 'png');
});

// --- output naming ---------------------------------------------------------

test('nextOutputPath starts at 1 when nothing exists', () => {
  assert.equal(nextOutputPath('out', 'visualkan', () => false), join('out', 'visualkan-1.png'));
});

test('nextOutputPath skips names already taken', () => {
  const taken = new Set([join('out', 'visualkan-1.png'), join('out', 'visualkan-2.png')]);
  assert.equal(nextOutputPath('out', 'visualkan', (p) => taken.has(p)), join('out', 'visualkan-3.png'));
});

test('nextOutputPath uses the extension it is given', () => {
  assert.equal(nextOutputPath('out', 'visualkan', () => false, 'jpg'), join('out', 'visualkan-1.jpg'));
});

test('nextOutputPath counts each extension separately', () => {
  const taken = new Set([join('out', 'visualkan-1.png')]);
  assert.equal(nextOutputPath('out', 'visualkan', (p) => taken.has(p), 'jpg'), join('out', 'visualkan-1.jpg'));
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

// --- two skills, one install (ADR 0005) ------------------------------------

test('targetDir defaults to the primary skill and accepts the wizard', () => {
  assert.equal(targetDir('claude', null), join(homedir(), '.claude', 'skills', 'visualkan'));
  assert.equal(
    targetDir('claude', null, 'visualkan-wizard'),
    join(homedir(), '.claude', 'skills', 'visualkan-wizard')
  );
});

test('the wizard installs beside the skill it hands off to', () => {
  // The wizard reads ../visualkan/SKILL.md, so the two directories must share
  // a parent on every platform.
  for (const key of Object.keys(PLATFORMS)) {
    const skill = targetDir(key, null, 'visualkan');
    const wizard = targetDir(key, null, 'visualkan-wizard');
    assert.equal(join(wizard, '..'), join(skill, '..'), `${key} must place both skills together`);
  }
});

test('targetDir rejects an unknown skill and lists the valid ones', () => {
  assert.throws(() => targetDir('claude', null, 'visualkan-helper'), /Unknown skill "visualkan-helper"/);
});

test('every registered skill ships both of its source files', () => {
  for (const name of Object.keys(SKILLS)) {
    const { md, meta } = skillSourceFiles(name);
    assert.ok(md.endsWith(`${name}.md`), `${name} needs skill/${name}.md`);
    assert.ok(meta.endsWith(`${name}.metadata.json`), `${name} needs skill/${name}.metadata.json`);
  }
});

test('the npm version hook stages every file that sync-version writes', () => {
  // The hook named skill/metadata.json after that file was renamed, so
  // `npm version minor` died with git exit 128 part way through the bump.
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const staged = pkg.scripts.version.match(/git add (\S+)/)?.[1];
  assert.equal(staged, 'skill/', 'stage the directory, not one file name that can go stale');
});

test('every skill metadata file carries the package version', () => {
  // sync-version writes each one. A skill left behind ships a stale version.
  const expected = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  for (const name of Object.keys(SKILLS)) {
    const { meta } = skillSourceFiles(name);
    const parsed = JSON.parse(readFileSync(meta, 'utf8'));
    assert.equal(parsed.version, expected, `${name}.metadata.json is out of step with package.json`);
  }
});

test('the wizard description keeps the guard that stops it matching a plain request', () => {
  // ADR 0005: a description that drifts wide reopens the coin flip between the
  // two skills.
  const body = readFileSync(new URL('../skill/visualkan-wizard.md', import.meta.url), 'utf8');
  assert.match(body, /ONLY when the user names this skill/);
  assert.match(body, /Do NOT use this for a request to visualize/);
});

// --- the Control catalog (ADR 0004) ----------------------------------------

test('STYLE_SIZES derives from STYLES rather than repeating it', () => {
  assert.deepEqual(Object.keys(STYLE_SIZES), Object.keys(STYLES));
  for (const [name, style] of Object.entries(STYLES)) {
    assert.equal(STYLE_SIZES[name], style.size);
    assert.ok(style.blurb.length > 20, `${name} needs a description the wizard can show`);
  }
});

test('the section floors match the documented complexity ranges', () => {
  assert.deepEqual(COMPLEXITIES.simple, { min: 3, max: 4 });
  assert.deepEqual(COMPLEXITIES.moderate, { min: 5, max: 7 });
  assert.deepEqual(COMPLEXITIES.detailed, { min: 8, max: 12 });
});

test('availableBackends reports presence in the detection order', () => {
  assert.deepEqual(availableBackends({}), []);
  assert.deepEqual(availableBackends({ OPENROUTER_API_KEY: 'c' }), ['openrouter']);
  assert.deepEqual(
    availableBackends({ OPENROUTER_API_KEY: 'c', OPENAI_API_KEY: 'a' }),
    ['openai', 'openrouter']
  );
});

test('controlsReport lists every legal value of every control', () => {
  const report = controlsReport({});
  for (const name of Object.keys(STYLES)) assert.ok(report.includes(name), `missing style ${name}`);
  for (const name of Object.keys(DRAW_LEVELS)) assert.ok(report.includes(name), `missing draw level ${name}`);
  for (const name of Object.keys(COMPLEXITIES)) assert.ok(report.includes(name), `missing complexity ${name}`);
  for (const name of Object.keys(DEVICES)) assert.ok(report.includes(name), `missing device ${name}`);
  for (const name of Object.keys(MODES)) assert.ok(report.includes(name), `missing mode ${name}`);
});

test('controlsReport states the section floor the clarification step tests', () => {
  assert.match(controlsReport({}), /moderate\s+5 to 7 Sections/);
});

test('controlsReport names the backend that auto-detection will choose', () => {
  assert.match(controlsReport({ GEMINI_API_KEY: 'x' }), /Auto-detect chooses: gemini/);
  assert.match(controlsReport({}), /Auto-detect finds nothing/);
});

test('controlsReport reports key presence without printing a key', () => {
  const report = controlsReport({ OPENAI_API_KEY: 'sk-do-not-print-me' });
  assert.ok(!report.includes('sk-do-not-print-me'), 'a key value must never reach stdout');
  assert.match(report, /openai\s+OpenAI gpt-image-2\s+available/);
  assert.match(report, /gemini\s+Gemini Nano Banana 2\s+set GEMINI_API_KEY/);
});

test('controlsReport describes native by capability, not by product name', () => {
  // Naming two platforms taught the agent to stop looking for a tool it might
  // actually have. Only the agent can detect one, so the catalog must not guess.
  const report = controlsReport({});
  assert.match(report, /generate_image tool/);
  assert.ok(!/native\s+Antigravity and Codex/.test(report), 'native must not be a product list');
});

// --- installed paths (ADR 0006) --------------------------------------------

test('runtimePath is absolute for global scope and needs no PATH lookup', () => {
  const p = runtimePath('claude', null, 'visualkan');
  assert.ok(p.endsWith('/.claude/skills/visualkan/scripts/visualkan-run.mjs'), p);
  assert.ok(/^([A-Za-z]:)?\//.test(p), `global scope must be absolute, got ${p}`);
});

test('runtimePath is project-relative for project scope so a commit stays portable', () => {
  // An absolute path here would name one developer's home directory and break
  // for every teammate who clones the project.
  const p = runtimePath('claude', '/srv/app', 'visualkan');
  assert.equal(p, '.claude/skills/visualkan/scripts/visualkan-run.mjs');
  assert.ok(!p.includes('srv/app'), 'project scope must not embed the project root');
});

test('every written path uses forward slashes on every platform', () => {
  // Verified by running: forward slashes work in bash, cmd.exe, and PowerShell,
  // including paths containing a space. A backslash does not.
  for (const key of Object.keys(PLATFORMS)) {
    for (const name of Object.keys(SKILLS)) {
      assert.ok(!runtimePath(key, null, name).includes('\\'), `${key}/${name} global`);
      assert.ok(!skillDocPath(key, null, name).includes('\\'), `${key}/${name} doc`);
    }
  }
});

test('a home directory containing a space survives the written path', () => {
  // The 0.1.0 bug, in its new location.
  assert.equal(toPosix('C:\\Users\\Davi Muammar\\x'), 'C:/Users/Davi Muammar/x');
  const p = runtimePath('claude', '/c/Users/Davi Muammar/proj', 'visualkan');
  assert.ok(!p.includes('\\'));
});

test('runtimePath rejects an unknown platform and an unknown skill', () => {
  assert.throws(() => runtimePath('emacs', null, 'visualkan'), /Unknown platform "emacs"/);
  assert.throws(() => runtimePath('claude', null, 'nope'), /Unknown skill "nope"/);
});

test('runtimePath refuses --project for a global-only platform', () => {
  assert.throws(() => runtimePath('openclaw', '/srv/app', 'visualkan'), /supports global scope only/);
});

// --- placeholder substitution ----------------------------------------------

test('substitution leaves no placeholder behind in either skill body', () => {
  // A leftover {{...}} reaches the agent as literal text and breaks the run.
  const values = substitutions('claude', null);
  for (const name of Object.keys(SKILLS)) {
    const { md } = skillSourceFiles(name);
    const out = applySubstitutions(readFileSync(md, 'utf8'), values);
    assert.ok(!out.includes('{{'), `${name}.md still holds a placeholder after substitution`);
  }
});

test('every placeholder used by a skill body has a substitution rule', () => {
  // Adding a placeholder without wiring it must fail here, not in the field.
  const values = substitutions('claude', null);
  for (const name of Object.keys(SKILLS)) {
    const { md } = skillSourceFiles(name);
    for (const [, key] of readFileSync(md, 'utf8').matchAll(/\{\{([A-Z_]+)\}\}/g)) {
      assert.ok(key in values, `${name}.md uses {{${key}}}, which install cannot fill`);
    }
  }
});

test('applySubstitutions throws rather than writing an unfilled placeholder', () => {
  assert.throws(() => applySubstitutions('run {{NO_SUCH_KEY}}', {}), /has no value for/);
});

test('the substituted body carries a runnable absolute path', () => {
  const values = substitutions('claude', null);
  const { md } = skillSourceFiles('visualkan');
  const out = applySubstitutions(readFileSync(md, 'utf8'), values);
  assert.ok(out.includes(`node "${values.RUNTIME_PATH}"`), 'the body must quote the written path');
});

// --- version skew (ADR 0006) -----------------------------------------------

test('installedVersion reads the version an install wrote', () => {
  const read = () => JSON.stringify({ version: '0.4.1' });
  assert.equal(installedVersion('/anywhere', read, () => true), '0.4.1');
});

test('installedVersion returns null rather than throwing on a missing or broken file', () => {
  assert.equal(installedVersion('/anywhere', () => '{}', () => false), null);
  assert.equal(installedVersion('/anywhere', () => 'not json', () => true), null);
  assert.equal(installedVersion('/anywhere', () => '{}', () => true), null);
});
