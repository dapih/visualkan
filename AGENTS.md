# AGENTS.md

Visualkan turns content into a visual explanation, and installs as a skill into AI coding assistants. The CLI is two files: `visualkan.mjs` is the Installer, and `skills/visualkan/scripts/visualkan-run.mjs` is the Runtime that owns the controls and image generation. Install copies the skill subtree into `<skill>` and writes its path into the skill body, so an agent never needs PATH (ADR 0006). `skills/visualkan/SKILL.md` is the skill body the assistant reads. The style templates live in `skills/visualkan/references/style-<name>.md`, one per style, and the agent reads them directly (ADR 0009). `skills/visualkan-wizard/SKILL.md` is a second skill that collects the controls and then hands the run to the first one. Both install together.

## Read these before you change things

| Document | Authority over |
|---|---|
| `CONTEXT.md` | Naming. One term per concept. Check it before you add or rename a term. |
| `docs/adr/` | Architecture, and the consequences each decision carries. Nine decisions, numbered 0001 to 0009. |
| `RELEASING.md` | Versioning and publishing. |

## Verify by executing

Seven real bugs in this project were found by running the code. None were found by reading it. Every one lived in a path that the tests stopped short of, so the tests stayed green while the code was wrong.

The two most recent are the shape to expect. `visualkan install <platform>` did nothing at all on Linux and macOS, in every release from 0.2.0 to 0.7.0, because npm installs a global command as a symlink and the entry-point guard compared the link against the file it points at. The test suite could not reach it, because the suite imports these modules and the fault appears only when one is executed through a link. Separately, the suite failed on any fresh clone on Windows for months, and passed everywhere it was actually run, because a generated file is committed and git rewrote its line endings on checkout.

Run what you change. Report what you did not run, and why.

- `npm test` runs the suite on `node:test`.
- `visualkan generate` calls a paid image API. One image costs roughly four cents. Ask before you spend.
- A request naming a model that does not exist returns 404 and costs nothing. Use it to check transport without generating an image.

## Constraints

- Zero dependencies, runtime and development alike. Keep it that way. Adding a test framework means adding the first dependency.
- One code path per job. ADR 0004 rejects fallback chains, because they multiply the paths that need testing and produce failures that are rare and hard to reproduce.
- Every style template in `references/` branches on `--draw-level`. Keep the branches when you edit a template.
- Each style declares `requires` in the `STYLES` object, listing the sections its prompt must carry. `generate` rejects a prompt that misses them. Renaming a section in a template means updating `requires` in the same commit, or every honest prompt starts failing.
- The list of legal control values lives in `skills/visualkan/scripts/visualkan-run.mjs` and prints through `visualkan controls`. The code remains the single source; a derived file such as `skills/visualkan-wizard/references/controls.md` is permitted only where a test asserts that it matches the code constants.
- Each skill ships as `skills/<name>/SKILL.md`, a `<name>.metadata.json` sidecar, and a subtree. The `SKILLS` registry in `visualkan.mjs` drives install, uninstall, status, and sync-version.
- `npm version` runs `visualkan sync-version` to write four outputs from `package.json`: `.claude-plugin/plugin.json`, `skills/visualkan/visualkan.metadata.json`, `skills/visualkan-wizard/visualkan-wizard.metadata.json`, and the version line in `skills/visualkan-wizard/references/controls.md`.
- Commit messages follow conventional commits, and the body carries the reasoning for the change.
