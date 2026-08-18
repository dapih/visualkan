#!/usr/bin/env node
// Release guard: the checks that only exist once a tag does.
//
// The test suite already asserts that package.json, plugin.json, both metadata
// sidecars, and controls.md carry the same version. It cannot assert anything
// about the tag, because no tag exists when the suite runs. That gap is what
// this file closes, and it runs before the irreversible npm publish.
//
// Usage: node .github/scripts/release-guard.mjs v0.7.0

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const failures = [];
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok    ${label}`);
    return;
  }
  console.log(`  FAIL  ${label}`);
  failures.push(`${label}: ${detail}`);
}

const tag = process.argv[2];
if (!tag) {
  console.error('Usage: release-guard.mjs <tag>, for example v0.7.0');
  process.exit(2);
}

const readJson = (...p) => JSON.parse(readFileSync(join(ROOT, ...p), 'utf8'));
const pkg = readJson('package.json');

console.log(`Release guard for ${tag}`);
console.log('');

// 1. The tag names a stable release.
//
// A prerelease is rejected rather than handled. Supporting it means a second
// path that publishes under a different dist-tag and must skip the fast-forward
// of main, because main is the latest stable release for two Channels. That
// path would run about once a year and break in ways nobody could reproduce,
// which is what ADR 0004 rejects. A release that must not move main is a
// deliberate feature to add later, with its own tests.
const stable = /^v\d+\.\d+\.\d+$/.test(tag);
check('tag is a stable semver tag', stable, `"${tag}" must look like v1.2.3, with no prerelease suffix`);

// 2. The tag agrees with the version that will actually be published.
const tagVersion = tag.replace(/^v/, '');
check(
  'tag version matches package.json',
  tagVersion === pkg.version,
  `tag says ${tagVersion}, package.json says ${pkg.version}`
);

// 3. The changelog documents this release.
//
// The GitHub release notes are extracted from this section, so a missing
// section means a release published with no explanation of what changed.
const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
const hasSection = new RegExp(`^### v${tagVersion.replace(/\./g, '\\.')}(\\s|$)`, 'm').test(changelog);
check(
  'CHANGELOG.md has a section for this version',
  hasSection,
  `no "### v${tagVersion}" heading found`
);

// 4. The plugin manifest agrees with the marketplace entry that encloses it.
//
// This replaces the validation that `claude plugin tag` performs, so that CI
// needs no claude CLI. The marketplace entry carries no version of its own, so
// the agreement that matters is the plugin name.
const plugin = readJson('.claude-plugin', 'plugin.json');
const marketplace = readJson('.claude-plugin', 'marketplace.json');
const entry = marketplace.plugins?.find((p) => p.name === plugin.name);
check(
  'marketplace.json carries an entry for this plugin',
  Boolean(entry),
  `no plugins[] entry named "${plugin.name}" in marketplace.json`
);
check(
  'plugin.json version matches package.json',
  plugin.version === pkg.version,
  `plugin.json says ${plugin.version}, package.json says ${pkg.version}`
);

// 5. The tarball carries the Runtime.
//
// An install with no Runtime is the failure ADR 0006 exists to prevent, and
// `files` is an allowlist that a careless edit can silently narrow.
const runtime = 'skills/visualkan/scripts/visualkan-run.mjs';
check('the Runtime is present to publish', existsSync(join(ROOT, runtime)), `${runtime} is missing`);

console.log('');
if (failures.length) {
  console.error(`Release guard failed with ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('Release guard passed.');
