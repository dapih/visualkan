# Releasing
 
This document covers how to cut a new release of Visualkan. npm owns the version, the git tag, and publication.
 
## Branching and Release Policy
 
- **`main` is always the latest release.** Two of the four Channels (`npx skills add` and manual copy) install directly from the default branch, and neither reads a git tag. A merge to `main` is a release event.
- **All development lands on branches.** Never commit directly to `main` or merge unreleased work to `main`.
- **`npm publish` happens before merging to `main`.** Publication to the public npm registry is irreversible. Placing it before the merge ensures that if publication fails, `main` remains untouched and does not advertise a version that is missing on npm.
 
## Versioning
 
Visualkan follows [Semantic Versioning](https://semver.org/):
 
- **Patch** (`0.x.y`) — bug fixes, prompt tweaks, typo corrections
- **Minor** (`0.x.0`) — new styles, new flags, new features that stay backward compatible
- **Major** (`x.0.0`) — breaking changes to flags, removed styles, changed output format
 
`package.json` is the single source of truth for the version. Never edit metadata or manifest version strings by hand; `visualkan sync-version` keeps them synchronized.
 
## Release Procedure
 
Follow these seven ordered steps to cut a release:
 
### 1. Verify on a feature branch
 
Ensure you are on a branch, the working tree is clean, all tests pass, and the package contents are verified:
 
```bash
git status              # no uncommitted changes
npm test                # all tests pass
npm pack --dry-run      # review package tarball contents
```
 
`npm pack --dry-run` must list only:
- `visualkan.mjs`
- `skills/` (the entire skills subtree)
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `package.json`
 
### 2. Bump the version
 
```bash
npm version <patch|minor|major>
```
 
This command executes:
1. `preversion`: runs `npm test`.
2. Bumps the version in `package.json`.
3. `version`: runs `node visualkan.mjs sync-version` which synchronizes four outputs from `package.json` and stages them (`skills/` and `.claude-plugin/`):
   - `.claude-plugin/plugin.json`
   - `skills/visualkan/visualkan.metadata.json`
   - `skills/visualkan-wizard/visualkan-wizard.metadata.json`
   - The version line in `skills/visualkan-wizard/references/controls.md`
4. Creates a release commit and git tag `v<version>`.
 
### 3. Create the plugin tag
 
```bash
claude plugin tag
```
 
This creates the `{name}--v{version}` tag for the Claude Code plugin marketplace (e.g. `visualkan--v0.7.0`), ensuring `plugin.json` and `marketplace.json` agree.
 
### 4. Update the changelog
 
Add the release entry in [CHANGELOG.md](CHANGELOG.md) documenting changes, breaking interface updates, and upgrade guidance.
 
### 5. Verify the three Channels
 
Test each of the three path resolution mechanisms:
 
1. **npm Channel (Installer rewrite):**
   ```bash
   npm pack
   npm install -g ./dapih-visualkan-<version>.tgz
   visualkan install claude
   node "<home>/.claude/skills/visualkan/scripts/visualkan-run.mjs" controls
   ```
2. **Claude Code Plugin Channel (plugin cache):**
   ```bash
   claude plugin install visualkan
   # Verify controls command runs from ~/.claude/plugins/cache/...
   ```
3. **`npx skills add` / Manual copy (platform-stated skill root):**
   ```bash
   # Copy skills/visualkan to a test location and execute:
   node "<test-dir>/skills/visualkan/scripts/visualkan-run.mjs" controls
   ```
 
All checks run the Runtime by the path carried in the installed body and verify that it prints the Control Catalog. No image API calls are made, so release verification costs nothing.
 
### 6. Publish to npm
 
```bash
npm publish
```
 
Publication is public and permanent.
 
### 7. Merge to main and push
 
```bash
git checkout main
git merge <branch> --ff-only
git push origin main && git push --tags
```
 
`main` now carries the release for direct-from-git channels (`npx skills add` and manual copy).
 
### 8. Create a GitHub release (optional)
 
```bash
gh release create "v$(node -p "require('./package.json').version")" \
  --title "v$(node -p "require('./package.json').version")" \
  --notes-file release-notes.md
```
