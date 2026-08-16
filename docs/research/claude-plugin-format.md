# What the Claude Code Plugin Format Requires, and What It Gives Back

Research for [issue #4](https://github.com/dapih/visualkan/issues/4). Decides whether the plugin Channel needs its own path answer, and what the repo must carry to become a marketplace.

Investigated 2026-08-17. Experiments run against `claude` 2.1.229 on Windows 11. Implementation strings read from the VS Code extension's 2.1.233 binary. The two agree wherever both were checked.

## The deciding answer

**`${CLAUDE_PLUGIN_ROOT}` does expand inside a `SKILL.md` body.** It is not restricted to hook and MCP command strings. The plugin Channel therefore does **not** need the `{{RUNTIME_PATH}}` substitution that ADR 0006 built for the npm Channel.

Three independent sources agree.

**Documented** — [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills):

> Claude Code substitutes `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}` in two places: the skill's markdown content, and Bash rules in the `allowed-tools` frontmatter. In a plugin skill, Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in the same two places.

**Implementation** — the shipped binary carries the substitution function and applies it to the loaded prompt body, not only to manifest strings. Reconstructed from the bundle:

```js
function uPe(e, t) {
  let r = (o) => o.replace(/\\/g, "/"),
      n = e.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, () => r(t.path));
  // ...
}
// and, in getPromptForCommand for a plugin skill:
W = uPe(W, { path: o, source: r });
if (s.isSkillMode) W = W.replace(/\$\{CLAUDE_SKILL_DIR\}/g, p);
```

**Observed** — a fixture plugin was loaded from disk with `claude --plugin-dir` (nothing installed, no user configuration touched). Its `SKILL.md` body read:

```
Runtime at ${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs and skill dir ${CLAUDE_SKILL_DIR}.
```

The text delivered to the agent was:

```
Base directory for this skill: C:\Users\DAVIMU~1\...\testplug\skills\flat-skill

Runtime at C:/Users/DAVIMU~1/.../testplug/scripts/run.mjs and skill dir C:/Users/DAVIMU~1/.../testplug/skills/flat-skill.
```

### Three details that matter

**The substituted path uses forward slashes on every OS.** The normalizer runs before insertion, and the observed output confirms it on Windows. This is the same portability rule ADR 0006 arrived at by experiment. Claude Code already emits the form the ADR requires.

> **Extended by the research for issue #10.** This file inferred that only `${CLAUDE_PLUGIN_ROOT}` was normalised, because the replace site shows a bare variable. That variable is already normalised upstream, so `${CLAUDE_SKILL_DIR}` receives the same treatment, including for a plain non-plugin skill. See `skill-directory-token-shells.md`.

**It is a string substitution, not an environment variable.** `CLAUDE_PLUGIN_ROOT` is empty in the agent's `Bash` environment — verified in this session, matching the sibling finding in `platform-skill-directory.md`. The binary sets it in the process environment of *hook* commands only, and rejects it elsewhere with `Hook command references ${...} but the hook is not associated with a plugin`. The agent must use the literal path it was handed. It must never write `${CLAUDE_PLUGIN_ROOT}` into a shell command of its own, because that expands to nothing.

**Substitution reaches the skill body only, never a file read later.** Reading a plugin's `SKILL.md` with the `Read` tool returns the raw token, unexpanded — observed repeatedly while reading Anthropic's own `plugin-dev` skill during this research. So a `references/style-*.md` file must not rely on the placeholder. ADR 0007 already avoids this by having the Runtime resolve `references/` relative to itself, so nothing changes.

## Required manifest shape

Both schema URLs are dead. `https://anthropic.com/claude-code/marketplace.schema.json` and `.../plugin.schema.json` each return **HTTP 404** (Anthropic's website 404 page). The `$schema` key in real manifests, including Anthropic's own, is a dangling reference. The requirements below were established by running `claude plugin validate` against deliberately broken manifests.

`.claude-plugin/plugin.json` — **`name` is the only required field.** `version`, `description` and `author` produce warnings, not errors.

`.claude-plugin/marketplace.json` — required: `name`, `owner` (object, and `owner.name` must be a string), and `plugins` (array). Each entry requires `name` and `source`. A missing `description` is a warning.

Minimum that passes for this repo:

```json
{
  "name": "visualkan",
  "owner": { "name": "dapih" },
  "plugins": [{ "name": "visualkan", "source": "./" }]
}
```

Both files live in the same `.claude-plugin/` directory when one repo is both marketplace and plugin, with `"source": "./"`. Observed working in `caveman` on this machine.

## How skills are discovered

**Auto-discovery scans `skills/` exactly one level deep.** Proven with a fixture holding both `skills/flat-skill/SKILL.md` and `skills/category/nested-skill/SKILL.md` and no `skills` field:

```
Skills (2)  flat-skill, testcmd     <- nested-skill absent
```

Adding `"skills": ["./skills/category/nested-skill"]` produced `Skills (3)  flat-skill, nested-skill, testcmd`. A declared entry may name either the skill directory itself or a parent directory whose children are then scanned — both forms were tested, and both work.

This corrects the premise in the ticket. `obra/superpowers` declares no skills because its layout is flat (`skills/<name>/SKILL.md`), not because nesting is discovered. `mattpocock-skills` uses `skills/engineering/<name>/` and must therefore list all 25 paths explicitly — and its undeclared `skills/in-progress/` and `skills/misc/` directories do not load, which is the same result seen from the other side.

**One exception matters for Visualkan.** Documented in [plugins-reference](https://code.claude.com/docs/en/plugins-reference):

> Adds to the default: `skills`. The default `skills/` directory is always scanned, and directories listed in `skills` are loaded alongside it. Exception: for a marketplace entry whose source resolves to the **marketplace root**, declaring specific subdirectories **replaces** the default `skills/` scan.

Visualkan's entry would use `"source": "./"`, which is the marketplace root. Declaring a `skills` field would therefore switch off the default scan. The safe shape is a flat `skills/` and **no** `skills` field.

Also documented: with no `skills/` directory and no `skills` field, a single `SKILL.md` at the plugin root loads as one skill, named from frontmatter — and without a `name` it falls back to the install directory name, which is a version string that changes on every update. Visualkan ships two skills, so the flat directory layout is the right one regardless.

## Arbitrary files, and where everything lands

A plugin ships **the entire repository tree**, not a whitelist. Observed in the cache for `mattpocock-skills`, which holds `docs/`, `.changeset/`, `.github/`, `node_modules/` and `package.json` alongside its components. `scripts/` and `references/` need no declaration and no special handling.

Installed plugins land at:

```
~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/
```

Observed on this machine, for example `cache/claude-plugins-official/mattpocock-skills/1.2.3/` and `cache/caveman/caveman/0d95a81d35a9/`.

**That path is not stable, and must never be written into a skill body.** It is version-scoped, and two versions of the same plugin coexist when scopes differ (`mattpocock-skills` is present at both `1.2.0` and `1.2.3`). The documentation is explicit:

> `${CLAUDE_PLUGIN_ROOT}` changes when the plugin updates. The previous version's directory remains on disk for a grace period after an update, but treat it as ephemeral and don't write state there.

The placeholder is what makes the instability irrelevant: it is resolved at load time, every time.

`${CLAUDE_PLUGIN_DATA}` is the documented companion — a directory that *survives* updates, intended for installed dependencies and caches. Visualkan has zero dependencies and writes no state, so it has no use for it today.

## Version, and the sync step

The `version` in `plugin.json` names the cache directory. When it is absent, Claude Code falls back to the git commit SHA — observed in `caveman`, whose manifest carries no `version` and whose cache directory is `0d95a81d35a9`, matching its recorded `gitCommitSha`.

`obra/superpowers` and `mattpocock-skills` both carry matching versions in `package.json` and `plugin.json`, and the ticket's inference of a sync step is correct: `mattpocock-skills` runs `changeset version && node scripts/sync-plugin-version.mjs`. Visualkan already owns this shape — `visualkan sync-version` writes every `skill/<name>.metadata.json` from `npm version`, and `.claude-plugin/plugin.json` would be one more target for the same command.

First-party support exists for the release check: `claude plugin tag` creates a `{name}--v{version}` git tag, "validating that plugin.json and any enclosing marketplace entry agree".

## Slash commands, and the Wizard

A plugin can expose slash commands from `commands/*.md`. Confirmed with the fixture: `commands/testcmd.md` was discovered and listed. `${CLAUDE_PLUGIN_ROOT}` is substituted in command bodies by the same code path as skill bodies.

A command is a third way to start a flow, and it is deterministic — the user types `/name`, and no description matching occurs. That speaks directly to the risk ADR 0005 recorded, where a Wizard description could drift wide enough to match a plain visualize request and win a coin flip.

But there is a cheaper answer inside the skill format itself. Skill frontmatter supports `disable-model-invocation: true`, documented as preventing Claude from auto-loading a skill and reserving it for manual `/name` invocation. That removes the coin flip without adding a component type or a second copy of the Wizard.

Either option is **Claude-Code-only**. The Wizard must stay a skill for every other Platform, so this is an addition available to one Channel, never a replacement for ADR 0005's decision.

Note one documented inconsistency: [plugins-reference](https://code.claude.com/docs/en/plugins-reference) says the `commands` field *replaces* the default `commands/` scan, while the `plugin-dev` skill Anthropic ships says custom paths *supplement* defaults. The reference is newer and more specific. Untested here, and irrelevant while Visualkan declares no custom paths.

## What the plugin Channel gives that a plain skill does not

- Path resolution for free. No Installer run, no placeholder rewriting, no copy of the Runtime — `${CLAUDE_PLUGIN_ROOT}` resolves at load time.
- One-command install and update from a git URL, with the version recorded and `claude plugin update` handling refresh.
- The whole repo travels, so `scripts/` and `references/` arrive without install logic.
- Slash commands and `disable-model-invocation`, neither available to a plain skill directory.
- `claude plugin validate`, `details` and `tag` as a release check.

The cost is that the two on-disk artifacts ADR 0006 warned about collapse into one, but only on this Channel — Visualkan still needs the Installer everywhere else.

## Unverified

- **The published schemas.** Both URLs 404, so no field list was confirmed against a schema. The requirements above come from `claude plugin validate`, which is the validator the CLI itself uses, but a future published schema could be stricter. Confirmed by the URLs returning JSON.
- **End-to-end marketplace install of this repo.** Everything here was tested with `claude --plugin-dir` against fixtures, deliberately, to avoid touching the user's plugin configuration. A real `claude plugin marketplace add` followed by an install remains untested. Confirmed by doing it against a throwaway `CLAUDE_CONFIG_DIR`.
- **`commands` replace-versus-supplement.** Two first-party sources disagree, and neither was tested.
- **Behaviour on non-Windows.** All observations are Windows 11. The forward-slash normalization sits in the code path for every OS, so the risk is low.
