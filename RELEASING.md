# Releasing

This document covers how to cut a new release of Visualkan. GitHub Actions performs the release. You decide that one happens, and what version it carries.

The workflow is [.github/workflows/release.yml](.github/workflows/release.yml).

## Branching and Release Policy

- **`main` is always the latest release.** Two of the four Channels (`npx skills add` and manual copy) install directly from the default branch, and neither reads a git tag. A merge to `main` is a release event.
- **All development lands on branches.** Never commit directly to `main` or merge unreleased work to `main`.
- **`npm publish` happens before `main` moves.** Publication to the public npm registry is irreversible. Placing it first ensures that if publication fails, `main` remains untouched and does not advertise a version that is missing on npm.

The workflow enforces all three. It refuses to run if `main` cannot fast-forward to the commit being released, and it moves `main` only after npm accepts the package.

## Versioning

Visualkan follows [Semantic Versioning](https://semver.org/):

- **Patch** (`0.x.y`) — bug fixes, prompt tweaks, typo corrections
- **Minor** (`0.x.0`) — new styles, new flags, new features that stay backward compatible
- **Major** (`x.0.0`) — breaking changes to flags, removed styles, changed output format

`package.json` is the single source of truth for the version. Never edit metadata or manifest version strings by hand. `visualkan sync-version` keeps them synchronized, and `npm version` runs it for you.

Pre-release versions are not supported. The workflow rejects a tag such as `v0.8.0-beta.1`, because publishing one would have to skip the `main` fast-forward, and that is a second code path that would run once a year and fail in ways nobody could reproduce. See [ADR 0004](docs/adr/0004-node-cli-owns-transport-and-policy.md).

## Release Procedure

Work on a branch. Then perform these four steps.

### 1. Write the changelog entry

Add a `### v<version>` section to [CHANGELOG.md](CHANGELOG.md), and add the row to the table at the top.

The workflow reads this section and publishes it as the GitHub release notes. A release with no section fails before anything is published.

### 2. Bump the version

```bash
npm version <patch|minor|major>
```

This runs the tests, writes the four generated files, creates a release commit, and creates the tag `v<version>`.

### 3. Push the branch and the tag

```bash
git push origin HEAD
git push origin refs/tags/v<version>
```

The tag starts the release workflow.

### 4. Approve the publish

The workflow verifies everything, then waits. Open the run, read the checks, and approve the `npm-publish` environment.

Approval is the last reversible moment. Nothing has been published when the workflow asks.

## What the workflow does

| Job | Work |
|---|---|
| `verify` | The test suite on three operating systems and two Node versions |
| `guard` | The tag matches `package.json`, the changelog has an entry, the manifests agree, and `main` can fast-forward |
| `channels` | Installs the packed tarball and runs the Runtime by the path the Installer wrote, then does the same from a plain copy |
| `publish` | Waits for your approval, then publishes to npm |
| `finalize` | Creates the `visualkan--v<version>` tag, fast-forwards `main`, and creates the GitHub release |

Every step after `publish` is safe to run again. If one fails, re-run the job. Nothing needs to be undone.

## Rehearsing

Run the workflow by hand with `dry_run` left at its default of `true`. It performs every check and stops short of publishing, tagging, and pushing.

A rehearsal does not exercise the npm authentication handshake. The first live release is still the first real test of that.

## Authentication

The workflow publishes through npm Trusted Publishing. There is no `NPM_TOKEN`, and there is nothing to rotate. npm accepts the publish because the request comes from this repository, from a workflow file it recognises by name, running in the `npm-publish` environment.

Renaming `release.yml` breaks publishing until the trusted publisher entry on npmjs.com is updated to match.

## One-time setup

These are configured already. Repeat them only when moving the package or the repository.

1. On npmjs.com, under the package settings, add a trusted publisher: owner `dapih`, repository `visualkan`, workflow `release.yml`, environment `npm-publish`.
2. In the repository settings, create an environment named `npm-publish` with yourself as a required reviewer.
3. In the repository settings, add a ruleset on `main` that blocks force-pushes and deletions.

## If the workflow is unavailable

Publish by hand, in this order. The order is the policy above, and it does not change.

```bash
npm test
npm pack --dry-run          # review the contents
npm publish                 # irreversible
git push origin refs/tags/visualkan--v<version>
git push origin HEAD:main
gh release create "v<version>" --notes-file <(node .github/scripts/changelog-section.mjs <version>)
```
