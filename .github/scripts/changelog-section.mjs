#!/usr/bin/env node
// Prints the CHANGELOG.md section for one version, for use as GitHub release
// notes.
//
// CHANGELOG.md is the single source. Writing the notes anywhere else means two
// descriptions of one release that drift apart, which is the failure that put a
// frozen environment into controls.md.
//
// Usage: node .github/scripts/changelog-section.mjs 0.7.0

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const version = process.argv[2]?.replace(/^v/, '');
if (!version) {
  console.error('Usage: changelog-section.mjs <version>, for example 0.7.0');
  process.exit(2);
}

const lines = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8').split('\n');
const heading = new RegExp(`^### v${version.replace(/\./g, '\\.')}(\\s|$)`);

const start = lines.findIndex((l) => heading.test(l));
if (start === -1) {
  console.error(`CHANGELOG.md has no "### v${version}" section.`);
  process.exit(1);
}

// Stop at the next heading of the same or higher level. The file ends with an
// "## Upstream Release History" block holding v1.x entries from the project
// this one forked, and those must never leak into these notes.
let end = lines.length;
for (let i = start + 1; i < lines.length; i++) {
  if (/^#{1,3} /.test(lines[i])) {
    end = i;
    break;
  }
}

const body = lines.slice(start + 1, end).join('\n').trim();
if (!body) {
  console.error(`The "### v${version}" section is empty.`);
  process.exit(1);
}
console.log(body);
