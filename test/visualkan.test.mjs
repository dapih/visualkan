import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  targetDir,
  installedPath,
  skillSourceFiles,
  runtimePath,
  RUNTIME_ANCHOR_LINE,
  rewriteRuntimePath,
  WIZARD_ANCHOR_LINE,
  rewriteWizardSiblingPath,
  findPluginCacheCopies,
  installedVersion,
  cmdSyncVersion,
  toPosix,
  PLATFORMS,
  SKILLS,
  cmdInstall,
  cmdUninstall,
  cmdStatus,
} from '../visualkan.mjs';

// The Runtime owns the Controls and image generation. See ADR 0006.
import {
  UserError,
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
  cmdGenerate,
  templatePath,
  readTemplate,
  promptGaps,
  PROMPT_MIN_WORDS,
  STYLES,
  STYLE_SIZES,
  DRAW_LEVELS,
  COMPLEXITIES,
  DEVICES,
  MODES,
  RUNTIME_USAGE,
} from '../skills/visualkan/scripts/visualkan-run.mjs';

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

test('every platform declares a label, a global path, and cites the research file', () => {
  assert.deepEqual(PLATFORMS.openclaw.global, ['.openclaw', 'skills'], 'openclaw must target .openclaw/skills');
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    assert.ok(platform.label, `${key} needs a label`);
    assert.ok(Array.isArray(platform.global) && platform.global.length, `${key} needs a global path`);
    assert.equal(platform.citation, 'docs/research/platform-install-targets.md', `${key} must cite the research file`);
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

test('every registered skill ships its source files', () => {
  for (const name of Object.keys(SKILLS)) {
    const { md, meta } = skillSourceFiles(name);
    assert.ok(md.endsWith(join('skills', name, 'SKILL.md')), `${name} needs skills/${name}/SKILL.md`);
    assert.ok(meta.endsWith(join('skills', name, `${name}.metadata.json`)), `${name} needs skills/${name}/${name}.metadata.json`);
  }
});

test('the package declares no dependencies of any kind', () => {
  // AGENTS.md: zero dependencies, runtime and development alike. A stray
  // `npm install` once wrote a dependency on this very package into
  // package.json, so every install pulled a second, older copy of itself.
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.deepEqual(pkg[field] ?? {}, {}, `${field} must stay empty`);
  }
});

// A package directory holding only what sync-version reads and writes.
function syncFixture(t, { withPlugin = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vk-test-sync-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  if (withPlugin) {
    mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
    writeFileSync(
      join(dir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'visualkan', version: '0.0.0' })
    );
  }
  for (const skillName of Object.keys(SKILLS)) {
    const skillDir = join(dir, 'skills', skillName);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'body');
    writeFileSync(join(skillDir, `${skillName}.metadata.json`), JSON.stringify({ version: '0.0.0' }));
  }
  return dir;
}

test('sync-version writes all four outputs that AGENTS.md promises', (t) => {
  const dir = syncFixture(t);
  cmdSyncVersion(dir, () => {});

  const plugin = JSON.parse(readFileSync(join(dir, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(plugin.version, '9.9.9', 'plugin.json');
  for (const skillName of Object.keys(SKILLS)) {
    const metaPath = join(dir, 'skills', skillName, `${skillName}.metadata.json`);
    assert.equal(JSON.parse(readFileSync(metaPath, 'utf8')).version, '9.9.9', `${skillName} sidecar`);
  }
  const controls = readFileSync(join(dir, 'skills', 'visualkan-wizard', 'references', 'controls.md'), 'utf8');
  assert.ok(controls.includes('v9.9.9'), 'controls.md');
});

test('sync-version fails loudly when the plugin manifest is missing', (t) => {
  // It used to skip the write in silence, so a release could ship a plugin
  // cache directory named for the wrong version. See #22.
  const dir = syncFixture(t, { withPlugin: false });
  assert.throws(() => cmdSyncVersion(dir, () => {}), /plugin manifest is missing/);
});

test('skills/ holds exactly the registered skills, and they are siblings', () => {
  // Acceptance criterion on #18. The tree is skills/<name>/, one directory per
  // entry in SKILLS, with no nesting of one skill inside another.
  const skillsDir = fileURLToPath(new URL('../skills/', import.meta.url));
  const entries = readdirSync(skillsDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  assert.deepEqual(dirs, Object.keys(SKILLS).sort(), 'skills/ holds one directory per registered skill');
  assert.ok(!entries.some((e) => e.isFile()), 'skills/ holds no loose files');
  for (const name of dirs) {
    const nested = readdirSync(join(skillsDir, name), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const other of dirs) {
      assert.ok(!nested.includes(other), `${other} must be a sibling of ${name}, not inside it`);
    }
  }
});

test('package.json ships skills/ and none of the directories it replaced', () => {
  // Acceptance criterion on #18. The tree moved to skills/<name>/, so the old
  // top-level names must not ride along and install a second, stale copy.
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.files.includes('skills/'), 'files must list skills/');
  for (const gone of ['scripts/', 'references/', 'skill/', 'scripts', 'references', 'skill']) {
    assert.ok(!pkg.files.includes(gone), `files must not list ${gone}`);
  }
});

test('the npm version hook stages every file that sync-version writes', () => {
  // The hook stages skills/ and .claude-plugin/ so all updated files are staged.
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const staged = pkg.scripts.version.match(/git add (.+)/)?.[1] ?? '';
  assert.ok(staged.includes('skills/'), 'stage skills/');
  assert.ok(staged.includes('.claude-plugin/'), 'stage .claude-plugin/');
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

test('plugin.json carries the package version and declares no skills field', () => {
  const expected = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const plugin = JSON.parse(readFileSync(new URL('../.claude-plugin/plugin.json', import.meta.url), 'utf8'));
  assert.equal(plugin.version, expected, 'plugin.json is out of step with package.json');
  assert.equal(plugin.name, 'visualkan');
  assert.equal(plugin.skills, undefined, 'plugin.json must not declare a skills field');
});

test('marketplace.json declares the three required fields', () => {
  const marketplace = JSON.parse(readFileSync(new URL('../.claude-plugin/marketplace.json', import.meta.url), 'utf8'));
  assert.equal(typeof marketplace.name, 'string', 'name is required');
  assert.equal(typeof marketplace.owner?.name, 'string', 'owner.name is required');
  assert.ok(Array.isArray(marketplace.plugins) && marketplace.plugins.length > 0, 'plugins array is required');
  assert.equal(marketplace.plugins[0].name, 'visualkan');
  assert.equal(marketplace.plugins[0].source, './');
});

test('the generated visualkan-wizard controls.md matches controlsReport and carries version', () => {
  const expected = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const controlsMd = readFileSync(new URL('../skills/visualkan-wizard/references/controls.md', import.meta.url), 'utf8');
  assert.equal(controlsMd.trim(), controlsReport(null, expected).trim());
  assert.match(controlsMd, new RegExp(`Visualkan Controls v${expected}`));
});

test('the generated controls.md states no fact about the machine that generated it', () => {
  // It was generated with an empty env, so it told every reader to set all
  // three keys and that auto-detect found nothing. Those are the maintainer's
  // environment frozen into a file that ships to other people. The assertion
  // above could never catch it, because it compared the file against the same
  // empty env.
  const controlsMd = readFileSync(new URL('../skills/visualkan-wizard/references/controls.md', import.meta.url), 'utf8');
  assert.ok(!controlsMd.includes('set OPENAI_API_KEY'), 'must not claim a key is unset');
  assert.ok(!controlsMd.includes('Auto-detect chooses:'), 'must not claim a key is set');
  assert.ok(!controlsMd.includes('Auto-detect finds nothing here'), 'must not judge the reader machine');
  assert.ok(controlsMd.includes('OPENAI_API_KEY'), 'must still name the key');
});

test('no shipped skill body uses a banned synonym from CONTEXT.md', () => {
  // Only the unambiguous multi-word terms are listed. Single words from the
  // _Avoid_ lists appear honestly all over these files: `references/` is a real
  // directory, and a generate_image tool is really a tool. A blanket scan of
  // every _Avoid_ list would fail on correct text.
  const banned = [
    'catalog file', 'template file', 'style file', 'prompt template',
    'controls list', 'options list', 'catalogue', 'visual-explainer',
  ];
  for (const skillName of Object.keys(SKILLS)) {
    const body = readFileSync(
      new URL(`../skills/${skillName}/SKILL.md`, import.meta.url), 'utf8'
    ).toLowerCase();
    for (const term of banned) {
      assert.ok(!body.includes(term), `${skillName}/SKILL.md uses "${term}", which CONTEXT.md bans`);
    }
  }
});

test('the wizard frontmatter carries disable-model-invocation: true', () => {
  const body = readFileSync(new URL('../skills/visualkan-wizard/SKILL.md', import.meta.url), 'utf8');
  assert.match(body, /disable-model-invocation:\s*true/);
});

test('the wizard description keeps the guard that stops it matching a plain request', () => {
  // ADR 0005: a description that drifts wide reopens the coin flip between the
  // two skills.
  const body = readFileSync(new URL('../skills/visualkan-wizard/SKILL.md', import.meta.url), 'utf8');
  assert.match(body, /ONLY when the user names this skill/);
  assert.match(body, /Do NOT use this for a request to visualize/);
});

test('the Wizard body asks no Backend question', () => {
  const body = readFileSync(new URL('../skills/visualkan-wizard/SKILL.md', import.meta.url), 'utf8');
  assert.ok(!body.includes('5. **Backend'), 'Wizard must not ask Backend question');
});

test('the Wizard body reads references/controls.md and runs no command in Step 1', () => {
  const body = readFileSync(new URL('../skills/visualkan-wizard/SKILL.md', import.meta.url), 'utf8');
  assert.match(body, /Read `references\/controls\.md` from this skill's own directory/);
  assert.ok(!body.includes('node "'), 'Step 1 must not run a node command');
});

test('the Wizard body carries the absent-sibling sentence', () => {
  const body = readFileSync(new URL('../skills/visualkan-wizard/SKILL.md', import.meta.url), 'utf8');
  assert.match(body, /If that file does not exist, the `visualkan` skill was not installed beside this one/);
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

// --- Style Templates and the prompt gate (ADR 0007) ------------------------

test('every style has a template file, and every template file has a style', () => {
  // Adding a style without its template, or the reverse, must fail here.
  const dir = new URL('../skills/visualkan/references/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.startsWith('style-') && f.endsWith('.md'));
  const fromFiles = files.map((f) => f.slice('style-'.length, -'.md'.length)).sort();
  assert.deepEqual(fromFiles, Object.keys(STYLES).sort());
});

test('every style declares the sections its prompt must carry', () => {
  for (const [name, style] of Object.entries(STYLES)) {
    assert.ok(Array.isArray(style.requires) && style.requires.length >= 4,
      `${name} needs a requires list the gate can check`);
  }
});

test('every required section actually appears in that style template', () => {
  // A requirement absent from the template would reject every honest prompt.
  for (const [name, style] of Object.entries(STYLES)) {
    const body = readTemplate(name, fileURLToPath(new URL('../skills/visualkan/scripts/', import.meta.url)));
    for (const header of style.requires) {
      assert.ok(body.includes(header), `${name} template never mentions "${header}"`);
    }
  }
});

test('templatePath rejects an unknown style', () => {
  assert.throws(() => templatePath('cubist'), /Unknown style "cubist"/);
});

test('readTemplate explains a missing file instead of throwing ENOENT', () => {
  assert.throws(
    () => readTemplate('whiteboard', '/nowhere', () => '', () => false),
    /Style Template for "whiteboard" is missing/
  );
});

test('promptGaps rejects a prompt that skipped the template', () => {
  const gaps = promptGaps('Draw a nice whiteboard about DNS.', 'whiteboard');
  assert.ok(gaps.some((g) => /at least 300/.test(g)), 'must catch the word floor');
  assert.ok(gaps.some((g) => /missing sections/.test(g)), 'must catch the missing sections');
});

test('promptGaps catches missing sections even when the prompt is long enough', () => {
  const padded = 'word '.repeat(PROMPT_MIN_WORDS + 50);
  const gaps = promptGaps(padded, 'whiteboard');
  assert.equal(gaps.length, 1);
  assert.match(gaps[0], /missing sections: CANVAS/);
});

test('promptGaps passes a prompt that carries every required section', () => {
  // The false-positive guard. Rejecting honest prompts would be worse than the
  // problem this gate exists to solve.
  const body = STYLES.whiteboard.requires.map((h) => `${h}: something specific here.`).join('\n');
  const prompt = `${body}\n${'detail '.repeat(PROMPT_MIN_WORDS)}`;
  assert.deepEqual(promptGaps(prompt, 'whiteboard'), []);
});

test('each style is gated against its own sections, not a shared list', () => {
  const mockupish = STYLES.mockup.requires.map((h) => `${h}: x.`).join('\n') + ' ' + 'w '.repeat(400);
  assert.deepEqual(promptGaps(mockupish, 'mockup'), []);
  assert.ok(promptGaps(mockupish, 'whiteboard').length, 'a mockup prompt must not satisfy whiteboard');
});

test('the gate sends the agent to the Style Template file, not the deleted command', async (t) => {
  // The remedy the gate prints is the one message an agent sees on the exact
  // failure ADR 0009 exists for. It named `template --style`, deleted in
  // 0701ef3, so it sent the agent to `Unknown runtime command`. The USAGE
  // assertions below never covered the error body, so the suite stayed green.
  const dir = mkdtempSync(join(tmpdir(), 'vk-test-gate-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const promptFile = join(dir, 'prompt.txt');
  writeFileSync(promptFile, 'Draw a nice whiteboard about DNS.');

  await assert.rejects(
    () => cmdGenerate({ 'prompt-file': promptFile, style: 'whiteboard' }),
    (err) => {
      assert.ok(!err.message.includes('template --style'), 'must not name the deleted command');
      assert.ok(
        err.message.includes('references/style-whiteboard.md'),
        'must name the Style Template file'
      );
      assert.ok(!err.message.includes('\\'), 'every written path uses forward slashes');
      return true;
    }
  );
});

test('neither USAGE nor RUNTIME_USAGE names the template command', () => {
  const installerSrc = readFileSync(new URL('../visualkan.mjs', import.meta.url), 'utf8');
  assert.ok(!RUNTIME_USAGE.includes('template --style'), 'RUNTIME_USAGE must not name template');
  assert.ok(!installerSrc.includes('visualkan template --style'), 'Installer USAGE must not name template');
});

test('skills/visualkan/SKILL.md instructs reading style templates from reference files with forward slashes', () => {
  const body = readFileSync(new URL('../skills/visualkan/SKILL.md', import.meta.url), 'utf8');
  assert.match(body, /Read `references\/style-<style>\.md` from this skill's own directory/);
  assert.match(body, /Resolve that relative path against the directory this skill was loaded from/);
  assert.match(body, /write it with forward slashes/);
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

// --- the Anchor Sentence and rewritten path (ADR 0008) ---------------------

test('neither authored skill body carries a placeholder', () => {
  for (const name of Object.keys(SKILLS)) {
    const { md } = skillSourceFiles(name);
    const content = readFileSync(md, 'utf8');
    assert.ok(!content.includes('{{'), `${name}/SKILL.md must not contain {{ placeholders`);
  }
});

test('the Runtime anchor line appears exactly once in the authored visualkan body', () => {
  const body = readFileSync(new URL('../skills/visualkan/SKILL.md', import.meta.url), 'utf8');
  const matches = body.split(RUNTIME_ANCHOR_LINE).length - 1;
  assert.equal(matches, 1, 'Runtime anchor line must appear exactly once in visualkan/SKILL.md');
});

test('the visualkan body carries the forward-slash clause', () => {
  const body = readFileSync(new URL('../skills/visualkan/SKILL.md', import.meta.url), 'utf8');
  assert.match(body, /write it with forward slashes/);
  assert.match(body, /Resolve that relative path against the directory this skill was loaded from/);
});

test('rewriteRuntimePath replaces the anchor line with the given path', () => {
  const body = `header\n${RUNTIME_ANCHOR_LINE}\nfooter`;
  const result = rewriteRuntimePath(body, 'C:/Users/test/runtime.mjs');
  assert.equal(
    result,
    'header\nnode "C:/Users/test/runtime.mjs" generate --prompt-file <file> ...\nfooter'
  );
});

test('rewriteRuntimePath throws when anchor line is missing', () => {
  assert.throws(
    () => rewriteRuntimePath('no anchor here', '/test/path'),
    /Could not find the Runtime anchor line/
  );
});

test('the Wizard sibling anchor line appears exactly once in the authored wizard body', () => {
  const body = readFileSync(new URL('../skills/visualkan-wizard/SKILL.md', import.meta.url), 'utf8');
  const matches = body.split(WIZARD_ANCHOR_LINE).length - 1;
  assert.equal(matches, 1, 'Wizard sibling anchor line must appear exactly once in visualkan-wizard/SKILL.md');
});

test('rewriteWizardSiblingPath replaces the anchor line with the given path', () => {
  const body = `header\n${WIZARD_ANCHOR_LINE}\nfooter`;
  const result = rewriteWizardSiblingPath(body, 'C:/Users/test/SKILL.md');
  assert.equal(
    result,
    'header\nC:/Users/test/SKILL.md\nfooter'
  );
});

test('rewriteWizardSiblingPath throws when anchor line is missing', () => {
  assert.throws(
    () => rewriteWizardSiblingPath('no anchor here', '/test/path'),
    /Could not find the Wizard sibling anchor line/
  );
});

// --- version skew (ADR 0006) -----------------------------------------------

test('installedVersion reads the version an install wrote', () => {
  const read = () => JSON.stringify({ version: '0.4.1' });
  assert.equal(installedVersion('/anywhere', 'visualkan', read, () => true), '0.4.1');
});

test('installedVersion returns null rather than throwing on a missing or broken file', () => {
  assert.equal(installedVersion('/anywhere', 'visualkan', () => '{}', () => false), null);
  assert.equal(installedVersion('/anywhere', 'visualkan', () => 'not json', () => true), null);
  assert.equal(installedVersion('/anywhere', 'visualkan', () => '{}', () => true), null);
});

test('--project without a directory is refused, and never reaches path.resolve', (t) => {
  // parseArgs turns a valueless `--project` into boolean true. That value used
  // to pass through a fallback chain into path.resolve, and `visualkan status
  // --project` died with a raw ERR_INVALID_ARG_TYPE stack. install took the
  // other branch of the same chain and silently installed globally instead.
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-projflag-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));
  const opts = { home: tmpHome, log: () => {} };

  for (const [name, cmd] of [['install', cmdInstall], ['uninstall', cmdUninstall], ['status', cmdStatus]]) {
    assert.throws(
      () => cmd({ project: true }, ['claude'], opts),
      /--project needs a directory/,
      `${name} must refuse a valueless --project`
    );
  }
});

// --- command layer (ticket #17) --------------------------------------------

test('install writes every required file into a temporary home directory', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-home-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  const logs = [];
  cmdInstall({}, ['claude'], { home: tmpHome, log: (msg) => logs.push(msg) });

  for (const skillName of Object.keys(SKILLS)) {
    const dir = targetDir('claude', null, skillName, tmpHome);
    assert.ok(existsSync(join(dir, 'SKILL.md')), `${skillName}/SKILL.md must exist`);
    assert.ok(existsSync(join(dir, `${skillName}.metadata.json`)), `${skillName}/${skillName}.metadata.json must exist`);
  }

  const vkDir = targetDir('claude', null, 'visualkan', tmpHome);
  assert.ok(existsSync(join(vkDir, 'scripts', 'visualkan-run.mjs')), 'visualkan Runtime must exist');
  for (const style of Object.keys(STYLES)) {
    assert.ok(existsSync(join(vkDir, 'references', `style-${style}.md`)), `style-${style}.md must exist`);
  }

  const wizDir = targetDir('claude', null, 'visualkan-wizard', tmpHome);
  assert.ok(!existsSync(join(wizDir, 'scripts')), 'visualkan-wizard does not copy Runtime');
  assert.ok(existsSync(join(wizDir, 'references', 'controls.md')), 'visualkan-wizard carries references/controls.md');
  for (const style of Object.keys(STYLES)) {
    assert.ok(!existsSync(join(wizDir, 'references', `style-${style}.md`)), `wizard must not carry style-${style}.md`);
  }

  const wizBody = readFileSync(join(wizDir, 'SKILL.md'), 'utf8');
  assert.ok(wizBody.includes('.claude/skills/visualkan/SKILL.md'), 'written wizard body carries resolved sibling path');

  assert.ok(logs.some((l) => l.includes('Installed visualkan')), 'logs installation of visualkan');
  assert.ok(logs.some((l) => l.includes('Installed visualkan-wizard')), 'logs installation of visualkan-wizard');
  assert.ok(logs.some((l) => l.includes('Runtime path written into visualkan:')), 'logs written runtime path');
});

test('a home directory containing a space survives install', (t) => {
  const baseTmp = mkdtempSync(join(tmpdir(), 'vk-test-space-'));
  const spaceHome = join(baseTmp, 'User With Spaces');
  t.after(() => rmSync(baseTmp, { recursive: true, force: true }));

  cmdInstall({}, ['claude'], { home: spaceHome, log: () => {} });

  const skillDir = targetDir('claude', null, 'visualkan', spaceHome);
  assert.ok(existsSync(join(skillDir, 'SKILL.md')));

  const body = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  assert.ok(body.includes('User With Spaces'), 'written path must preserve space in home directory');
  assert.ok(!body.includes('\\'), 'written path must use forward slashes');
});

test('--project writes into the project root', (t) => {
  const tmpProj = mkdtempSync(join(tmpdir(), 'vk-test-proj-'));
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-home-'));
  t.after(() => {
    rmSync(tmpProj, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  });

  cmdInstall({ project: tmpProj }, ['claude'], { home: tmpHome, log: () => {} });

  const skillDir = targetDir('claude', tmpProj, 'visualkan', tmpHome);
  assert.ok(existsSync(join(skillDir, 'SKILL.md')), 'writes to project root');

  const body = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  assert.ok(body.includes('.claude/skills/visualkan/scripts/visualkan-run.mjs'), 'path is project-relative');
  assert.ok(!body.includes(toPosix(tmpProj)), 'path must not embed the absolute project root');
  assert.ok(!body.includes(toPosix(tmpHome)), 'path must not embed the home directory');
});

test('status reports a copy that install wrote, with its version', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-status-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const logs = [];
  cmdInstall({}, ['claude'], { home: tmpHome, log: () => {} });
  cmdStatus({}, [], { home: tmpHome, log: (msg) => logs.push(msg) });

  const output = logs.join('\n');
  assert.ok(output.includes('Claude Code') && output.includes('visualkan') && output.includes(`v${pkg.version}`));
  assert.ok(output.includes('Claude Code') && output.includes('visualkan-wizard') && output.includes(`v${pkg.version}`));
});

test('status reports a copy placed by hand in a Platform skill root, and names the command that owns it', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-status-hand-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  const codexDir = targetDir('codex', null, 'visualkan', tmpHome);
  mkdirSync(codexDir, { recursive: true });
  writeFileSync(join(codexDir, 'SKILL.md'), 'hand placed skill');
  writeFileSync(join(codexDir, 'visualkan.metadata.json'), JSON.stringify({ version: '0.6.0' }));

  const logs = [];
  cmdStatus({}, [], { home: tmpHome, log: (msg) => logs.push(msg) });
  const output = logs.join('\n');
  assert.ok(output.includes('Codex CLI'), 'reports Codex CLI platform');
  assert.ok(output.includes('visualkan'), 'reports visualkan skill');
  // This test carried the claim in its name without asserting it, so status
  // shipped naming the Owning Command for plugin-cache rows alone. Issue #23
  // asks for it on every copy found.
  assert.ok(output.includes('visualkan install codex'), 'names the Owning Command');
});

test('status says no-version for a copy that carries no sidecar', (t) => {
  // #23 section 10 asks status to print the version it found and the command
  // that owns the location. A copy with no sidecar has no version, and it used
  // to print a bare dash with no owner beside it, which reads like a missing
  // value rather than a missing file.
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-status-nover-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  const codexDir = targetDir('codex', null, 'visualkan', tmpHome);
  mkdirSync(codexDir, { recursive: true });
  writeFileSync(join(codexDir, 'SKILL.md'), 'hand placed, no sidecar');

  const logs = [];
  cmdStatus({}, [], { home: tmpHome, log: (msg) => logs.push(msg) });
  const output = logs.join('\n');
  assert.ok(output.includes('no-version'), 'says the version is absent');
  assert.ok(output.includes('visualkan install codex'), 'still names the Owning Command');
});

test('status marks STALE only at the Installer target path', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-status-stale-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  const geminiDir = targetDir('gemini', null, 'visualkan', tmpHome);
  mkdirSync(geminiDir, { recursive: true });
  writeFileSync(join(geminiDir, 'SKILL.md'), 'older skill');
  writeFileSync(join(geminiDir, 'visualkan.metadata.json'), JSON.stringify({ version: '0.1.0' }));

  const logs = [];
  cmdStatus({}, [], { home: tmpHome, log: (msg) => logs.push(msg) });
  const output = logs.join('\n');
  assert.ok(output.includes('STALE'), 'marks stale at installer target');
});

test('status reports not checked when the plugin cache glob matches nothing', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-status-empty-cache-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  const logs = [];
  cmdStatus({}, [], { home: tmpHome, log: (msg) => logs.push(msg) });
  const output = logs.join('\n');
  assert.ok(output.includes('Not checked: Claude Code plugin cache (not checked)'));
  // #23: zero matches must never be reported as nothing installed. The path is
  // Claude Code internal layout, so an empty cache and a moved one look alike.
  assert.ok(!output.includes('none found'), 'must not claim that nothing is installed');
  assert.ok(output.includes('Gemini CLI folder-trust state'));
});

test('status reports two hits when the plugin cache holds two versions of the plugin', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-status-cache2-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  const v1Dir = join(tmpHome, '.claude', 'plugins', 'cache', 'visualkan', 'visualkan', '0.5.0', 'skills', 'visualkan');
  const v2Dir = join(tmpHome, '.claude', 'plugins', 'cache', 'visualkan', 'visualkan', '0.6.0', 'skills', 'visualkan');
  mkdirSync(v1Dir, { recursive: true });
  mkdirSync(v2Dir, { recursive: true });
  writeFileSync(join(v1Dir, 'SKILL.md'), 'v0.5.0');
  writeFileSync(join(v1Dir, 'visualkan.metadata.json'), JSON.stringify({ version: '0.5.0' }));
  writeFileSync(join(v2Dir, 'SKILL.md'), 'v0.6.0');
  writeFileSync(join(v2Dir, 'visualkan.metadata.json'), JSON.stringify({ version: '0.6.0' }));

  const logs = [];
  cmdStatus({}, [], { home: tmpHome, log: (msg) => logs.push(msg) });
  const output = logs.join('\n');
  assert.ok(output.includes('Claude Code Plugin'), 'reports plugin cache platform');
  assert.ok(output.includes('v0.5.0') && output.includes('v0.6.0'), 'reports both versions found in cache');
  assert.ok(output.includes('claude plugin update visualkan'), 'names owning command');
});

test('status scans project roots only when --project is given', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-proj-scan-h-'));
  const tmpProj = mkdtempSync(join(tmpdir(), 'vk-test-proj-scan-p-'));
  t.after(() => {
    rmSync(tmpHome, { recursive: true, force: true });
    rmSync(tmpProj, { recursive: true, force: true });
  });

  const projSkill = targetDir('claude', tmpProj, 'visualkan', tmpHome);
  mkdirSync(projSkill, { recursive: true });
  writeFileSync(join(projSkill, 'SKILL.md'), 'project skill');
  writeFileSync(join(projSkill, 'visualkan.metadata.json'), JSON.stringify({ version: '0.6.0' }));

  const logsWithout = [];
  cmdStatus({}, [], { home: tmpHome, log: (msg) => logsWithout.push(msg) });
  assert.ok(!logsWithout.join('\n').includes('Claude Code (project)'), 'must not scan project without flag');

  const logsWith = [];
  cmdStatus({ project: tmpProj }, [], { home: tmpHome, log: (msg) => logsWith.push(msg) });
  assert.ok(logsWith.join('\n').includes('Claude Code (project)'), 'must scan project with flag');
});

test('status warns when a Claude Code global-scope copy shadows a project-scope copy', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-shadow-h-'));
  const tmpProj = mkdtempSync(join(tmpdir(), 'vk-test-shadow-p-'));
  t.after(() => {
    rmSync(tmpHome, { recursive: true, force: true });
    rmSync(tmpProj, { recursive: true, force: true });
  });

  cmdInstall({}, ['claude'], { home: tmpHome, log: () => {} });
  cmdInstall({ project: tmpProj }, ['claude'], { home: tmpHome, log: () => {} });

  const logs = [];
  cmdStatus({ project: tmpProj }, [], { home: tmpHome, log: (msg) => logs.push(msg) });
  const output = logs.join('\n');
  assert.ok(output.includes('Warning: Claude Code global scope') && output.includes('shadows project scope'));
});

test('status reports ~/clawd as residue and deletes nothing', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-clawd-res-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  const clawdDir = join(tmpHome, 'clawd', 'skills');
  mkdirSync(clawdDir, { recursive: true });

  const logs = [];
  cmdStatus({}, [], { home: tmpHome, log: (msg) => logs.push(msg) });
  const output = logs.join('\n');
  assert.ok(output.includes('Residue:'), 'reports residue');
  assert.ok(output.includes('clawd'), 'names clawd');
  assert.ok(existsSync(clawdDir), 'clawd must not be deleted');
});

test('uninstall deletes the directory that install wrote and reports plainly when absent', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-uninst-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  cmdInstall({}, ['claude'], { home: tmpHome, log: () => {} });
  const dir1 = targetDir('claude', null, 'visualkan', tmpHome);
  const dir2 = targetDir('claude', null, 'visualkan-wizard', tmpHome);
  assert.ok(existsSync(dir1));
  assert.ok(existsSync(dir2));

  const logs = [];
  cmdUninstall({}, ['claude'], { home: tmpHome, log: (msg) => logs.push(msg) });

  assert.ok(!existsSync(dir1), 'visualkan directory must be deleted');
  assert.ok(!existsSync(dir2), 'visualkan-wizard directory must be deleted');
  assert.ok(logs.some((l) => l.includes('Uninstalled visualkan')), 'logs uninstall of visualkan');
  assert.ok(logs.some((l) => l.includes('Uninstalled visualkan-wizard')), 'logs uninstall of visualkan-wizard');

  const absentLogs = [];
  cmdUninstall({}, ['claude'], { home: tmpHome, log: (msg) => absentLogs.push(msg) });
  assert.ok(absentLogs.some((l) => l.includes('visualkan is not installed at')), 'reports plainly when target is absent');
});

test('uninstall reports surviving copies in plugin cache and other platform roots with owning commands', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-uninst-other-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  // 1. Install claude target
  cmdInstall({}, ['claude'], { home: tmpHome, log: () => {} });

  // 2. Install codex target
  cmdInstall({}, ['codex'], { home: tmpHome, log: () => {} });

  // 3. Plant plugin cache copy
  const vDir = join(tmpHome, '.claude', 'plugins', 'cache', 'visualkan', 'visualkan', '0.6.0', 'skills', 'visualkan');
  mkdirSync(vDir, { recursive: true });
  writeFileSync(join(vDir, 'SKILL.md'), 'plugin skill');
  writeFileSync(join(vDir, 'visualkan.metadata.json'), JSON.stringify({ version: '0.6.0' }));

  // 4. Plant ~/clawd residue
  const clawdDir = join(tmpHome, 'clawd', 'skills');
  mkdirSync(clawdDir, { recursive: true });

  const logs = [];
  cmdUninstall({}, ['claude'], { home: tmpHome, log: (msg) => logs.push(msg) });

  const output = logs.join('\n');
  assert.ok(output.includes('Uninstalled visualkan from'), 'uninstalled claude target');

  // Plugin cache survived and reported
  assert.ok(existsSync(join(vDir, 'SKILL.md')), 'plugin cache copy must survive');
  assert.ok(output.includes('Claude Code Plugin'), 'reports surviving plugin copy');
  assert.ok(output.includes('claude plugin uninstall visualkan'), 'names plugin uninstall command');

  // Codex copy survived and reported
  const codexDir = targetDir('codex', null, 'visualkan', tmpHome);
  assert.ok(existsSync(join(codexDir, 'SKILL.md')), 'codex copy must survive');
  assert.ok(output.includes('Codex CLI'), 'reports surviving codex copy');
  assert.ok(output.includes('visualkan uninstall codex'), 'names codex uninstall command');

  // Residue reported and survived
  assert.ok(output.includes('Residue:'), 'reports residue');
  assert.ok(existsSync(clawdDir), 'clawd residue must not be deleted');
});

test('install raises a UserError when the Runtime is missing from the package', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'vk-test-missing-rt-home-'));
  const emptyPkgDir = mkdtempSync(join(tmpdir(), 'vk-test-missing-rt-pkg-'));
  t.after(() => {
    rmSync(tmpHome, { recursive: true, force: true });
    rmSync(emptyPkgDir, { recursive: true, force: true });
  });

  assert.throws(
    () => cmdInstall({}, ['claude'], { home: tmpHome, packageDir: emptyPkgDir, log: () => {} }),
    (err) => err instanceof UserError && /The Runtime is missing from the package/.test(err.message)
  );
});
