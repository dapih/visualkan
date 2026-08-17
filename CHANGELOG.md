# Changelog

| Version | Date | Description |
|---------|------|-------------|
| Unreleased | — | The agent reads Style Templates from files, and `template` command is deleted |
| 0.6.0 | 2026-08-15 | Style templates move to reference files, and `generate` gates the prompt |
| 0.5.0 | 2026-08-15 | The Runtime installs beside the skill, so an agent never needs PATH |
| 0.4.1 | 2026-08-14 | The npm package moved to the `@dapih/visualkan` scope |
| 0.4.0 | 2026-08-14 | A wizard skill, a clarification step, and `visualkan controls` |
| 0.3.0 | 2026-08-14 | Fixes found by the first live generation run, and draw-level for infographic |
| 0.2.0 | 2026-08-14 | Node CLI replaces make, jq, curl, and base64 |
| 0.1.0 | 2026-08-14 | First Visualkan release: fork identity and an independent version line |

### Unreleased

- **The `template` command is deleted (breaking change / public interface change).** The agent reads `references/style-<name>.md` directly from the skill directory on every route, so a `native` user does not need Node installed to fetch a Style Template. The gate inside `generate` continues to reject prompts that miss required sections. (ADR 0009)

### v0.6.0 — Style templates move out, and the prompt is checked

`skill/visualkan.md` was 52 KB, and 60% of it was the seven style templates. Exactly one applies to any run, so about 6,700 tokens were loaded and thrown away every time the skill fired.

- **The seven templates now live in `references/style-<name>.md`.** The skill body fell from about 13,030 tokens to 5,159. A run loads one template of roughly 1,100 instead of seven totalling 7,847
- **`visualkan template --style <name>` serves them.** The agent runs a command rather than reading a path it guessed, the same pattern `controls` already uses. The Runtime resolves `references/` relative to itself, so no new install placeholder was needed
- **`generate` now rejects a prompt that skipped the template.** Each style declares the sections its prompt must carry, and a prompt missing them, or shorter than 300 words, fails before any money is spent. Without this the split would have traded tokens for silently worse images, which is the failure ADR 0006 was written about
- **The Mermaid block stayed in the skill body.** It is also conditional, but nothing can check a Mermaid parse the way `generate` can check a prompt, so moving it would have bought 6% of the file for an invisible failure mode
- **[ADR 0007](docs/adr/0007-the-runtime-serves-templates-and-gates-prompts.md)** records the decision, and narrows ADR 0004: the agent still writes the prompt, but the CLI decides whether it is admissible. **72 tests**, up from 63

### v0.5.0 — The Runtime installs beside the skill

A user installed Visualkan on ChatGPT desktop and it failed. The platform could not resolve the `visualkan` command, even though the npm global bin directory was on the Windows User PATH and held the shims. A spawned shell does not always inherit that PATH.

The skill's answer was to reinstall the npm package. That advice could never be right: `visualkan install` **is** that package, so any machine with a skill folder already has it.

- **`visualkan install` now writes the Runtime into `<skill>/scripts/`**, and writes its resolved path into the skill body. An agent runs `node "<path>" generate`, which needs no PATH lookup and no particular working directory. Verified in a shell where `visualkan` is genuinely not found
- **The path branches on scope.** Global scope gets an absolute path, because `cmd.exe` does not expand `~`. Project scope gets a project-relative path, so a committed skill folder still works for a teammate. Every written path uses forward slashes, which work in bash, `cmd.exe`, and PowerShell alike, including paths containing a space
- **The CLI is now two files.** The **Installer** (`visualkan.mjs`) owns `install`, `uninstall`, `status`, and `sync-version`. The **Runtime** (`scripts/visualkan-run.mjs`) owns every Control and image generation. The Installer imports the Runtime, so `visualkan controls` and `visualkan generate` keep working from the global command
- **`visualkan status` reports version skew.** Upgrading is two commands: `npm install -g @dapih/visualkan@latest`, then `visualkan install <platform>`
- **The Wizard hands over with a literal token**, `VISUALKAN-WIZARD-RUN`. The previous prose contract between the two skill files did not survive its first real run, and the confirmation step never fired
- **The confirmation block now says why a Backend won**, so a user who expected their platform's own image generation can see in one line that none was detected
- **`native` is described by capability, not by product name.** Naming Antigravity and Codex taught the agent that no other platform qualifies
- **The Wizard's first step is renamed** from "Read the Control catalog" to "Run the controls command". The word *catalog* sent one agent hunting through a skill library instead of running the command
- **[ADR 0006](docs/adr/0006-the-runtime-installs-beside-the-skill.md)** records the decision. **62 tests**, up from 49

### v0.4.1 — The package moved to a scope

The npm package is now `@dapih/visualkan`. The unscoped `visualkan` package is deprecated and points here.

- `npm install -g @dapih/visualkan` replaces `npm install -g visualkan` everywhere the docs and the skills state it
- The CLI command stays `visualkan`. Nothing about install targets, flags, or output changes
- `package.json` carries `publishConfig.access: public`, because a scoped package publishes private by default

### v0.4.0 — Guidance for the user who does not know the controls

Visualkan took nine flags and assumed that the user knew all of them. It also generated an image from a two-word request, which produced sections that nobody wrote. Both are now fixed, and each fix is placed by what starts it.

- **New `visualkan-wizard` skill.** It asks for the style, draw level, complexity, and content, one question at a time, with the legal values shown and the default marked. It never carries a copy of the style templates. It hands the run to the `visualkan` skill, so one copy of those templates stays the point
- **New clarification step in the `visualkan` skill.** It runs when no content exists, or when the content cannot fill the section floor for the chosen complexity. It asks at most three questions in one message. It never runs because two styles both fit
- **New confirmation step.** After clarification, or after the wizard, the skill states the style, complexity, core concept, section titles, and cost, then waits. A request that already carries enough content never stops
- **New `visualkan controls` command.** It prints every control and its legal values from the code, and reports which backends this machine can reach. Draw level and complexity moved into `visualkan.mjs` to join the styles, backends, and devices that were already there
- **One install command now installs two skills.** `visualkan status` and `visualkan uninstall` cover both, and `visualkan sync-version` writes both metadata files
- **[ADR 0005](docs/adr/0005-a-helper-flow-is-placed-by-its-trigger.md)** records the rule. A flow that must start mid-run lives inside the skill. A flow that the user starts by name lives in its own skill

### v0.3.0 — What the first live run found

Until now, every test stopped before the network call, so no image had ever been generated by the CLI. The first live run against OpenRouter produced a correct image and exposed three defects.

- **The saved file lied about its format.** OpenRouter returns JPEG, and the CLI wrote those bytes to a `.png` name. Every backend is now asked for PNG through `output_format`, and the extension is chosen from the returned bytes, because a provider can ignore that request. `bytedance-seed/seedream-4.5` still answers with JPEG, and the file is now named `.jpg`
- **A failed generation reported exit code 127, not 1.** On Windows, `process.exit()` during a `fetch` teardown aborts libuv and prints a C-level assertion after the error message. The CLI now sets `process.exitCode` and lets Node drain
- **The reported image size was false for OpenRouter.** That API takes an aspect ratio, and each model sets its own pixel count, so `--size 1536x1024` produced a 3072x2048 image. The CLI now reports `aspect 3:2` for that backend instead of claiming a pixel size
Two older gaps closed in the same pass.

- **The infographic style now honours `--draw-level`.** It had one branch, and the rest of the template hardcoded a polished result: "flat-design icons, NOT hand-drawn" and "this is a polished publication piece". Asking for `--style infographic --draw-level sketch` therefore produced a prompt that argued with itself. The canvas, header, palette, section badges, containers, icons, connectors, callouts, typography, and overall feel now all branch, and the polished-only wording sits inside the polished branch
- **`examples/` is deleted.** All 38 MB came from upstream's `visual-explainer`, predated the CLI, and no file in the repository linked to them
- **35 tests**, up from 27
- **GitHub Actions** runs the tests on Linux and Windows for every push and pull request

### v0.2.0 — The Visualkan CLI

Installing Visualkan required `make` and `jq`. Generating an image required `curl`, `jq`, and `base64`. On Windows that meant four Unix tools to copy two files and decode a PNG. Now it needs Node.

- **New `visualkan` CLI**, published to npm with zero runtime dependencies: `install`, `uninstall`, `status`, and `generate`
- **`make` and `jq` are gone.** The Makefile is deleted. npm owns version, tag, and publish
- **The skill no longer shells out.** It calls `visualkan generate` instead of building `curl` commands and parsing them with `jq`. `SKILL.md` drops from 815 to 684 lines, and the style templates are untouched
- **Prompts are passed by file**, never as command-line arguments. The previous design pasted a 400-800 word prompt into a single-quoted shell string containing JSON, which produced invalid JSON for any prompt containing a double quote. Since the templates instruct that every label be quoted, this affected essentially every generation
- **[ADR 0003](docs/adr/0003-model-flag-is-openrouter-only.md) is enforced in code.** The `--model` rejection was prose asking the agent to refuse; it is now a thrown error
- **27 tests** using the built-in `node:test` runner, with no devDependencies
- Requires Node 24 or later ([ADR 0004](docs/adr/0004-node-cli-owns-transport-and-policy.md))

### v0.1.0 — Fork and Identity

- Renamed the skill, the command, and the documentation from `visual-explainer` to `visualkan`
- Reset the version line to 0.1.0, independent of upstream ([ADR 0001](docs/adr/0001-fork-visual-explainer-as-visualkan.md))
- Claude Code now installs a skill to `~/.claude/skills/`, matching every other supported platform
- Adopted one term per concept across the documents. `Section` replaces `concept`, `sub-topic`, and `Central Topic` (see [CONTEXT.md](CONTEXT.md))
- Corrected the `--draw-level` coverage note, which named `presentation` (which had no branches) and omitted `infographic` and `mockup` (which had them)
- Removed the dead `generate-images` dependency from `metadata.json`
- `--draw-level` now applies to every style. `presentation`, `diagram`, `mindmap`, and `mindmap-structured` previously ignored it
- `--model` is now rejected with any backend other than `openrouter`, instead of being accepted and silently discarded ([ADR 0003](docs/adr/0003-model-flag-is-openrouter-only.md))
- Every install and uninstall target now quotes its paths, so the Makefile works when the home directory contains a space. This affected all seven platforms on Windows

## Upstream Release History

The releases below belong to `visual-explainer`, not to Visualkan. They are kept for provenance. See [Credits](README.md#credits).

### v1.4.0 — Antigravity, Codex & OpenRouter Support

- Support for installation and use in **Antigravity** (`make antigravity-install`) and **Codex** (`make codex-install`) alongside Claude Code and OpenClaw
- **Keyless Native Subscription Image Generation**: Antigravity and Codex users use native subscription capabilities (`generate_image`) with zero API key requirement
- **OpenRouter API Key Support**: Non-Antigravity/Codex users or users wanting alternative image models can pass `OPENROUTER_API_KEY` and `--backend openrouter`
- `--model` flag to select any image generation model available on OpenRouter (Flux, Krea, SeeDream, RiverFlow, QwenImage, etc.)
- Updated auto-detection priority: Native Subscription (Antigravity/Codex) → OpenAI → Gemini → OpenRouter

### v1.3.0 — Mockup/Wireframe Style

- New `mockup` style for generating UI wireframes and screen mockups
- `--device` flag to select device frame: `mobile` (phone), `desktop` (browser window), `tablet` (iPad-style)
- Three fidelity levels via `--draw-level`: sketch (hand-drawn), normal (mid-fi), polished (Figma-quality)
- Comprehensive prompt template with support for navigation, input fields, buttons, cards, tables, charts, and all standard UI components
- Annotation support for wireframe callouts and specifications
- Ideal for rapid wireframing from PRDs, brainstorming UI layouts, and visualizing modernized interfaces

### v1.2.0 — Gemini Backend Support

- `--backend` flag to choose between `openai` (gpt-image-1.5) and `gemini` (Nano Banana 2)
- Auto-detection: uses whichever API key is available; defaults to OpenAI if both are set
- Backend reported before generation and in structured output summary
- Gemini API integration via `generativelanguage.googleapis.com`
- Size handling adapted for Gemini (dimensions included in prompt text)
- Updated prerequisites to support either `OPENAI_API_KEY` or `GEMINI_API_KEY`

### v1.1.0 — Mermaid Diagram Conversion

- `--from mermaid` flag for inline Mermaid input
- `--from mermaid-file PATH` for reading `.mmd` or `.md` files
- Auto-detection of Mermaid syntax in content
- Full parsing of all Mermaid diagram types: flowchart, sequence, class, state, ER, gantt, pie, mindmap, timeline
- Extracts nodes, edges, subgraphs, participants, attributes, and labels for precise prompt construction
- Any Mermaid diagram type can be rendered in any visual style

### v1.0.0 — Initial Release

- 6 visual styles at launch: whiteboard, infographic, presentation, diagram, mindmap, mindmap-structured
- `--draw-level` parameter (sketch, normal, polished) for hand-drawn vs professional spectrum
- `--complexity` parameter (simple, moderate, detailed) for content density control
- `--mode multi-frame` for progressive build-up explanations
- Deep content analysis pipeline with concept extraction, visual metaphors, and layout strategy
- Style-specific prompt templates (400-800 words) for each visual style
- Integration with OpenAI gpt-image-1.5 via generate-images skill
- YAML frontmatter with official Claude Code skill metadata
- Makefile with install, uninstall, version management, and release targets
- 8 example images across all styles
