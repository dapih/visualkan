# Releasing

This document covers how to cut a new release of Visualkan. npm owns the version, the git tag, and publication. There is no Makefile.

## Versioning

Visualkan follows [Semantic Versioning](https://semver.org/):

- **Patch** (`0.2.x`) — bug fixes, prompt tweaks, typo corrections
- **Minor** (`0.x.0`) — new styles, new flags, new features that stay backward compatible
- **Major** (`x.0.0`) — breaking changes to flags, removed styles, changed output format

Visualkan restarted its version line at 0.1.0 and does not track upstream `visual-explainer` numbers. See [ADR 0001](docs/adr/0001-fork-visual-explainer-as-visualkan.md).

`package.json` holds the version. `skill/metadata.json` is written from it automatically, so never edit that version by hand.

## Release process

### 1. Verify the tree is clean

```bash
git status              # no uncommitted changes
npm test                # all tests pass
npm pack --dry-run      # review what will ship
```

`npm pack --dry-run` must list only `visualkan.mjs`, `skill/`, `README.md`, `LICENSE`, and `package.json`. Anything else means the `files` field in `package.json` is broken.

### 2. Bump the version

```bash
npm version patch       # 0.2.0 -> 0.2.1
npm version minor       # 0.2.0 -> 0.3.0
npm version major       # 0.2.0 -> 1.0.0
```

One command does four things:

1. Runs `npm test` through the `preversion` hook. A failing test stops the release.
2. Writes the new version into `package.json`.
3. Runs `visualkan sync-version` through the `version` hook, which copies the version and today's date into `skill/metadata.json` and stages it.
4. Creates the commit and an annotated git tag.

### 3. Update the changelog

Add an entry to the Version History table in [README.md](README.md), and a section describing what changed.

### 4. Test the install

```bash
npm pack                                       # produces dapih-visualkan-<version>.tgz
npm install -g ./dapih-visualkan-<version>.tgz
visualkan status
visualkan install claude
```

Open a new session on that platform and confirm that the skill loads and generates.

### 5. Push and publish

```bash
git push && git push --tags
npm publish
```

Publication is public and permanent. Verify step 1 and step 4 before you run `npm publish`.

### 6. Create a GitHub release (optional)

```bash
gh release create "v$(node -p "require('./package.json').version")" \
  --title "v$(node -p "require('./package.json').version")" \
  --notes "Description of changes"
```

## Quick reference

| Task | Command |
|------|---------|
| Show current version | `node -p "require('./package.json').version"` |
| Run tests | `npm test` |
| Review package contents | `npm pack --dry-run` |
| Bump patch | `npm version patch` |
| Bump minor | `npm version minor` |
| Bump major | `npm version major` |
| Publish | `npm publish` |
| Sync metadata.json by hand | `node visualkan.mjs sync-version` |
