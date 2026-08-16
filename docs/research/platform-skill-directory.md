# Does a Platform Tell a Skill Where It Lives?

Research for [issue #2](https://github.com/dapih/visualkan/issues/2). Decides whether `{{RUNTIME_PATH}}` (ADR 0006) still has a job.

Investigated 2026-08-17. Claude Code 2.1.229 on Windows 11, `claude-vscode` entrypoint.

## Answer

| Platform | Agent learns its skill directory? | Mechanism | Evidence |
|---|---|---|---|
| **Claude Code** | Yes, twice over | `${CLAUDE_SKILL_DIR}` substituted into the body; plus a literal `Base directory for this skill: <abs path>` line prefixed to the loaded body | Documented **and** observed |
| **Antigravity** | Unknown | None documented | **UNVERIFIED** |
| **Gemini CLI** | Yes | `activate_skill` tool result carries `<available_resources>` whose first line is the absolute skill directory | Observed in source; behaviour partly documented |
| **Codex CLI** | Yes | Skills catalog in the system prompt gives each skill a `file:` path locator, plus an explicit rule to resolve relative paths against the `SKILL.md` directory | Documented in the model-facing prompt constants |
| **Open Agent Standard** | No | Spec mandates relative-from-skill-root paths but defines **no** mechanism to learn the root. Left to the implementation | Documented absence |
| **OpenClaw** | Yes | `{baseDir}` token in the `SKILL.md` body, resolved against the skill's own directory | Documented |

Five of six hand over the directory. The one gap is Antigravity, and it is a gap in evidence rather than a confirmed absence.

## The nuance that decides the ADR

On Claude Code, `${CLAUDE_SKILL_DIR}` is **a string substitution into the markdown, not a process environment variable.**

Observed: during this session, with a skill active, a `Bash` tool call reported

```
CLAUDE_SKILL_DIR=[]
CLAUDE_PLUGIN_ROOT=[]
```

`env | grep -i '^CLAUDE'` returned `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_PID`, `CLAUDE_EFFORT` and similar — and neither skill-path variable. A spawned shell cannot expand either one.

The docs agree, and are precise about where substitution happens:

> Claude Code substitutes `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}` in two places: the skill's markdown content, and Bash rules in the `allowed-tools` frontmatter.
>
> — [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)

So the platform mechanism and Visualkan's mechanism are **the same kind of thing**: a literal path written into the skill body before the agent reads it. The only difference is *when*. `{{RUNTIME_PATH}}` is written at install time by the Installer; `${CLAUDE_SKILL_DIR}` is written at read time by the platform.

This matters because the failure ADR 0006 was fixing — a spawned shell that could not resolve `visualkan` from PATH — is **not** fixed by an environment variable, and no platform offers one. It is fixed by a literal path in the body. Both mechanisms deliver that.

---

## Per-platform detail

### Claude Code — documented and observed

**Mechanism 1: `${CLAUDE_SKILL_DIR}`.** Introduced in Claude Code **2.1.69**:

> Added `${CLAUDE_SKILL_DIR}` variable for skills to reference their own directory in SKILL.md content
>
> — Claude Code changelog, 2.1.69 (local copy at `~/.claude/cache/changelog.md`)

The reference table:

> `${CLAUDE_SKILL_DIR}` — The directory containing the skill's `SKILL.md` file. For plugin skills, this is the skill's subdirectory within the plugin, not the plugin root. Use this in bash injection commands to reference scripts or files bundled with the skill, regardless of the current working directory.
>
> `${CLAUDE_PLUGIN_ROOT}` — The plugin's installation directory. **Substituted only in plugin skills.**
>
> — [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)

**Scope-independent.** The docs state this outright, answering the issue's fourth bullet:

> The script path uses `${CLAUDE_SKILL_DIR}` so it resolves correctly whether the skill is installed at the personal, project, or plugin level

And for a plain skill specifically:

> If this skill is installed at `~/.claude/skills/render-chart/`, both occurrences of `${CLAUDE_SKILL_DIR}` expand to that directory.

So a plain skill outside a plugin **does** receive an equivalent to `${CLAUDE_PLUGIN_ROOT}` — it is `${CLAUDE_SKILL_DIR}`, and it is the better of the two, because it works in both cases and points at the skill rather than the plugin root.

The docs also recommend it for exactly Visualkan's problem:

> **Working directory**: Claude Code runs each command in the session shell's current working directory. That directory moves when Claude runs `cd`. Use `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PROJECT_DIR}` in paths that must resolve the same way every time.

A second benefit: the same variable is substituted in `allowed-tools`, so a rule like `Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)` matches the exact command the body tells the agent to run, and the script runs without a permission prompt. Visualkan's install-time substitution cannot get that, because the installer does not write `allowed-tools`.

**Mechanism 2: the base-directory preamble.** Confirmed by direct observation, twice in this session. Exact wording, no trailing punctuation:

```
Base directory for this skill: <absolute path>
```

It appears for **both** kinds of skill. Observed values:

- Plugin skill: `Base directory for this skill: C:\Users\Davi Muammar\.claude\plugins\cache\claude-plugins-official\mattpocock-skills\1.2.3\skills\engineering\research`
- Plain skill in `~/.claude/skills/`: `Base directory for this skill: C:\Users\Davi Muammar\.claude\skills\no-ai-slop`

This answers the issue's specific question: **yes, the line appears for a plain skill as well as a plugin skill**, with identical wording.

**Caveat on the preamble — it uses native separators.** Both observed paths carry Windows backslashes. ADR 0006 established by running that a backslash path does not survive bash, `cmd.exe`, and PowerShell alike, and that every written path must use forward slashes. A path the agent copies out of this preamble is therefore *not* directly safe to paste into a command on Windows. `${CLAUDE_SKILL_DIR}` may or may not share this defect — **UNVERIFIED**; confirming it needs a skill body containing `${CLAUDE_SKILL_DIR}` installed on Windows, then reading the expanded text.

**Caveat on scope of observation.** Both observations were made inside a subagent session. Whether the main-thread session prefixes the same line is **UNVERIFIED**, though there is no reason to expect a difference.

### Antigravity — UNVERIFIED

Google's own documentation covers layout and discovery but is silent on runtime path exposure:

> Antigravity supports two types of skills: `<workspace-root>/.agents/skills/<skill-folder>/` [for] Workspace-specific and `~/.gemini/config/skills/<skill-folder>/` [for] Global (all workspaces).
>
> Note: Antigravity now defaults to `.agents/skills`, but still maintains backward support for `.agent/skills`.
>
> — [antigravity.google/docs/skills](https://antigravity.google/docs/skills)

No environment variable, no placeholder token, no statement about the skill path reaching the agent. Antigravity is closed source, so no source-level check is possible.

Worth noting: those two paths match the `antigravity` entry in the `PLATFORMS` registry exactly (`~/.gemini/config/skills` global, `.agents/skills` project). The install target is right; only the runtime mechanism is unknown.

**What would confirm it:** install a one-line skill on Antigravity whose entire body is *"Reply with the absolute path of the directory containing this SKILL.md, and state how you know it."* Then invoke it at global scope and again at workspace scope. Cheap, and it settles the last cell in the table.

### Gemini CLI — observed in source

The documentation describes the shape without naming the path:

> The `SKILL.md` body and folder structure is added to the conversation history. The skill's directory is added to the agent's allowed file paths, granting it permission to read any bundled assets.
>
> — [gemini-cli/docs/cli/skills.md](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md)

The source settles what "folder structure" contains. In `packages/core/src/tools/activate-skill.ts`, the model-facing `llmContent` is:

```
<activated_skill name="...">
  <instructions>...</instructions>
  <available_resources>
    ${folderStructure}
  </available_resources>
</activated_skill>
```

where `folderStructure` comes from `getFolderStructure(path.dirname(skillLocation))`. And `packages/core/src/utils/getFolderStructure.ts` returns:

```js
return `${summary}\n\n${resolvedPath}${path.sep}\n${structureLines.join('\n')}`;
```

The **resolved absolute path is the first line of the tree**, and that tree goes into `llmContent`, not merely into the user-facing `returnDisplay`. So the agent receives the absolute skill directory as text on activation.

The same file also calls `getWorkspaceContext().addDirectory(path.dirname(skill.location))`, so the directory is readable without a further grant.

Both discovery scopes flow through this one code path, so **the mechanism does not differ between global and project scope**. Discovery locations:

> User skills: `~/.gemini/skills/` or the `~/.agents/skills/` alias. Workspace skills: `.gemini/skills/` or the `.agents/skills/` alias.

### Codex CLI — documented in the model-facing prompt

Codex puts the skill catalog in the system prompt, and each entry carries a path locator. From `codex-rs/ext/skills/src/render.rs`, each line renders as:

```rust
format!("- {name}: {description} ({locator_kind}: {locator})")
```

with `locator_kind` being `"file"` for host skills and `locator` being the skill's rendered path.

The instructions shipped alongside that catalog, in `codex-rs/ext/skills/src/catalog_prompt.rs`, are explicit about resolution:

> Each entry includes a name, description, and a short path that can be expanded into an absolute path using the skill roots table.

> When `SKILL.md` references relative paths (e.g., `scripts/foo.py`), resolve them relative to the directory containing that expanded `SKILL.md` first, and only consider other paths if needed.

> If `scripts/` exist, prefer running or patching them instead of retyping large code blocks.

This is the strongest statement of the six. Codex not only reveals the path, it instructs the model to resolve sibling references against it and to prefer running bundled scripts. A `SKILL.md` that says `node scripts/visualkan-run.mjs` is handled correctly by construction.

Depending on configuration, the catalog renders either full `file:` paths or short paths plus a `### Skill roots` alias table for expansion. Either way an absolute path is recoverable.

**Discrepancy worth flagging.** The official documentation lists Codex skill roots as `$CWD/.agents/skills`, `$REPO_ROOT/.agents/skills`, `$HOME/.agents/skills`, and `/etc/codex/skills` ([learn.chatgpt.com/docs/build-skills](https://learn.chatgpt.com/docs/build-skills)). The `codex` entry in `PLATFORMS` installs to `~/.codex/skills` and `.codex/skills`. Secondary sources also describe `~/.codex/skills` as valid, so both may be accepted, but this was **not confirmed** and is out of scope for this issue.

### Open Agent Standard (agentskills.io) — a documented absence

The spec defines the layout and requires relative addressing:

> When referencing other files in your skill, use relative paths from the skill root:
>
> ```
> See [the reference guide](references/REFERENCE.md) for details.
>
> Run the extraction script:
> scripts/extract.py
> ```
>
> Keep file references one level deep from `SKILL.md`.
>
> — [agentskills.io/specification](https://agentskills.io/specification)

It defines **no** mechanism for learning the skill root. The frontmatter table (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) contains nothing path-related, and no environment variable or token is specified anywhere.

So the standard places the obligation on the skill author to write relative paths and leaves resolution entirely to the implementation. This is why Codex and OpenClaw each had to invent their own answer, and why the two answers differ. A skill targeting the bare standard cannot portably locate its own files.

`.agents/skills` is the standard's shared install location, which is why it appears in the `antigravity` (project), `agents`, `codex`, `gemini`, and `openclaw` discovery lists alike.

### OpenClaw — documented token

OpenClaw defines a placeholder that is almost exactly `{{RUNTIME_PATH}}`:

> Use `{baseDir}` in the body to reference the skill folder path.
>
> — [docs/tools/skills.md](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md)

And the authoring guide gives Visualkan's exact use case:

> ### Using `{baseDir}`
>
> Reference files inside the skill directory without hardcoding paths — the agent resolves `{baseDir}` against the skill's own directory:
>
> ```markdown
> Run the helper script at `{baseDir}/scripts/run.sh`.
> ```
>
> — [docs/tools/creating-skills.md](https://github.com/openclaw/openclaw/blob/main/docs/tools/creating-skills.md)

The token is uniform across all six discovery roots, so it does not vary by scope. OpenClaw explicitly follows the AgentSkills spec and adds `{baseDir}` on top of it.

**Discrepancy worth flagging.** OpenClaw documents its roots as `<workspace>/skills`, `<workspace>/.agents/skills`, `~/.agents/skills`, `<state-dir>/skills`, bundled, and `skills.load.extraDirs`. The `openclaw` entry in `PLATFORMS` installs to `~/clawd/skills`, which matches none of these; the `caveman` installer on this machine uses `~/.openclaw/workspace` (overridable by `$OPENCLAW_WORKSPACE`). Out of scope here, but it means the OpenClaw install target may be wrong independently of this question.

## Corroborating evidence from installed skills

How real skills on this machine address their siblings, which shows what authors currently believe they can rely on:

- `~/.claude/skills/graphify/SKILL.md` uses bare relative paths throughout — `references/github-and-merge.md`, `references/extraction-spec.md`. It assumes the agent resolves them against the skill directory.
- `~/.claude/skills/impeccable/SKILL.md:22` hedges explicitly: *"Run `node .claude/skills/impeccable/scripts/context.mjs` once per session (if the runtime shows this skill's loaded base directory, run `node <skill-base-dir>/scripts/context.mjs`; keep cwd at the user's project)."* A third-party author writing a conditional because the base directory is available on some platforms and not others.
- `caveman/skills/caveman-compress/SKILL.md:22` hedges the same way: *"The compression scripts live in `scripts/` (adjacent to this SKILL.md). If the path is not immediately available, search for `scripts/__main__.py` next to this SKILL.md."*
- No installed `SKILL.md` on this machine uses `${CLAUDE_SKILL_DIR}`. The variable is new (2.1.69) and adoption has not caught up. Visualkan would be early, not late.
- The currently installed `~/.claude/skills/visualkan/SKILL.md` shows the ADR 0006 mechanism working as designed, e.g. line 66: `node "C:/Users/Davi Muammar/.claude/skills/visualkan/scripts/visualkan-run.mjs" generate ...` — forward slashes, quoted, absolute.

## What this means for `{{RUNTIME_PATH}}`

Not a recommendation, just what the evidence supports.

1. **The substitution cannot be deleted outright.** Antigravity is unverified, and the Open Agent Standard defines nothing. Removing it would break at least the `agents` target and possibly `antigravity`.
2. **Where a platform token exists, it is strictly better than an install-time path.** It survives a hand-moved skill folder — the failure mode ADR 0006 lists first under Consequences. On Claude Code it additionally makes `allowed-tools` match, removing a permission prompt.
3. **The tokens are not interchangeable.** `${CLAUDE_SKILL_DIR}`, `{baseDir}`, and Codex's "resolve relative to `SKILL.md`" are three different spellings of one idea. Emitting the right one per platform is a per-platform value for the existing `substitutions()` map — the same shape the Installer already has, not a new mechanism. ADR 0004's objection to fallback chains does not apply: this still resolves to one literal per install, chosen at install time.
4. **A shell will never expand any of these.** Observed for Claude Code, and true by construction for OpenClaw and Codex, whose tokens are not shell syntax. Every one is text substituted before the agent reads the body. Any design that assumes an environment variable reaches `node` is wrong on all six.

## Sources

Primary, in order of authority for each claim:

- [Claude Code — Skills documentation](https://code.claude.com/docs/en/skills)
- Claude Code changelog 2.1.69, local copy at `~/.claude/cache/changelog.md`
- Direct observation, Claude Code 2.1.229, this session (base-directory preamble; absent environment variables)
- [Agent Skills specification](https://agentskills.io/specification)
- [gemini-cli `docs/cli/skills.md`](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md)
- gemini-cli source: `packages/core/src/tools/activate-skill.ts`, `packages/core/src/utils/getFolderStructure.ts`
- openai/codex source: `codex-rs/ext/skills/src/catalog_prompt.rs`, `codex-rs/ext/skills/src/render.rs`
- [Codex — Build skills](https://learn.chatgpt.com/docs/build-skills)
- [OpenClaw — Skills](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md) and [Creating skills](https://github.com/openclaw/openclaw/blob/main/docs/tools/creating-skills.md)
- [Antigravity — Skills](https://antigravity.google/docs/skills)
