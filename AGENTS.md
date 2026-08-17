# AGENTS.md

Visualkan turns content into a visual explanation, and installs as a skill into AI coding assistants. The CLI is two files: `visualkan.mjs` is the Installer, and `scripts/visualkan-run.mjs` is the Runtime that owns the controls and image generation. Install copies the Runtime into `<skill>/scripts/` and writes its path into the skill body, so an agent never needs PATH (ADR 0006). `skill/visualkan.md` is the skill body the assistant reads. The style templates live in `references/style-<name>.md`, one per style, and the Runtime serves them through `template --style <name>` (ADR 0007). `skill/visualkan-wizard.md` is a second skill that collects the controls and then hands the run to the first one. Both install together.

## Read these before you change things

| Document | Authority over |
|---|---|
| `CONTEXT.md` | Naming. One term per concept. Check it before you add or rename a term. |
| `docs/adr/` | Architecture, and the consequences each decision carries. Seven decisions, numbered 0001 to 0007. |
| `RELEASING.md` | Versioning and publishing. |

## Verify by executing

Five real bugs in this project were found by running the code. None were found by reading it. Every one lived in a path that the tests stopped short of, so the tests stayed green while the code was wrong.

Run what you change. Report what you did not run, and why.

- `npm test` runs the suite on `node:test`.
- `visualkan generate` calls a paid image API. One image costs roughly four cents. Ask before you spend.
- A request naming a model that does not exist returns 404 and costs nothing. Use it to check transport without generating an image.

## Constraints

- Zero dependencies, runtime and development alike. Keep it that way. Adding a test framework means adding the first dependency.
- One code path per job. ADR 0004 rejects fallback chains, because they multiply the paths that need testing and produce failures that are rare and hard to reproduce.
- Every style template in `references/` branches on `--draw-level`. Keep the branches when you edit a template.
- Each style declares `requires` in the `STYLES` object, listing the sections its prompt must carry. `generate` rejects a prompt that misses them. Renaming a section in a template means updating `requires` in the same commit, or every honest prompt starts failing.
- The list of legal control values lives in `visualkan.mjs` and prints through `visualkan controls`. Do not copy that list into a skill file. ADR 0004 gives policy to the CLI.
- Each skill ships as `skill/<name>.md` plus `skill/<name>.metadata.json`, and the `SKILLS` registry in `visualkan.mjs` drives install, uninstall, status, and sync-version. Adding a skill means adding one entry and two files.
- `skill/<name>.metadata.json` carries a generated version. `npm version` writes every one through `visualkan sync-version`.
- Commit messages follow conventional commits, and the body carries the reasoning for the change.
