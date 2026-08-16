# Does a Skill Directory Token Survive Every Shell?

Research for [issue #10](https://github.com/dapih/visualkan/issues/10). Splits off from [#2](https://github.com/dapih/visualkan/issues/2) (`platform-skill-directory.md`) and inherits [#4](https://github.com/dapih/visualkan/issues/4) (`claude-plugin-format.md`), which already settled `${CLAUDE_PLUGIN_ROOT}`. Decides whether a Platform token can replace the `{{RUNTIME_PATH}}` substitution ADR 0006 introduced.

Investigated 2026-08-17. Windows 11, home directory `C:\Users\Davi Muammar` (contains a space). Claude Code 2.1.229, Node v24.12.0, Git Bash, `cmd.exe`, Windows PowerShell 5.1 and PowerShell 7. Platform sources read at `main`.

## Answer

| Platform | Mechanism | Slash direction | Survives all three shells |
|---|---|---|---|
| **Claude Code**, plain skill | `${CLAUDE_SKILL_DIR}` | **Forward** — normalised | **Yes** |
| **Claude Code**, plugin skill | `${CLAUDE_PLUGIN_ROOT}` | **Forward** — normalised (settled in #4) | **Yes** |
| **Codex CLI** | `file:` locator in the system-prompt catalog | **Forward** — normalised | **Yes** |
| **Gemini CLI** | `activate_skill` → `<available_resources>` first line | **Backslash**, plus a trailing separator | **No** |
| **OpenClaw** | `{baseDir}` | **Backslash** — raw `dirname()`, no normalisation | **No** |
| Claude Code `Base directory for this skill:` preamble | prose line | Backslash (recorded in #2) | **No** |

Two of the four open items came back positive, two negative. The split runs exactly along the line of whether the implementation calls a backslash-to-slash replace before handing the path to the model.

**The negative results keep ADR 0006's substitution.** Gemini CLI and OpenClaw hand the agent a backslash path, so adopting their tokens would trade a known-good path for a fragile one. `{{RUNTIME_PATH}}` still has a job.

## A correction to ADR 0006's stated reasoning

ADR 0006 records, under Consequences:

> Verified by running: a quoted forward-slash absolute path containing a space works in bash, `cmd.exe`, and PowerShell alike, and a backslash does not survive all three.

The first half reproduces. **The second half does not.** Re-run on this machine against a real script at a path containing a space:

| Form | bash | cmd.exe | PowerShell 5.1 | pwsh 7 |
|---|---|---|---|---|
| `node "C:/…/dir with space/probe.mjs"` | OK | OK | OK | OK |
| `node "C:\…\dir with space\probe.mjs"` | **OK** | **OK** | **OK** | **OK** |
| `node C:/…/dir with space/probe.mjs` (unquoted) | fails | fails | fails | fails |
| `node C:\…\dir with space\probe.mjs` (unquoted) | fails | fails | fails | fails |

For an ordinary file path, **quoting is the variable that decides success, not slash direction.** Backslash inside double quotes survives bash because bash only treats `\` as an escape before `$`, `` ` ``, `"`, `\`, and newline — and no path segment here begins with one of those. Unquoted fails everywhere because of the space, in both slash forms.

So the ADR reaches the right rule for a reason it states too strongly. The real hazards are positional, and forward slash is the form that has none of them:

**Hazard 1 — a trailing separator immediately before the closing quote.** This is the shape Gemini CLI emits.

```
$ bash -c 'node "C:\Users\Davi Muammar\skills\vk\"'
bash: -c: line 1: unexpected EOF while looking for matching `"'
```

`cmd.exe` fails differently and more quietly — the `\"` is read as a literal quote and absorbed into the argument:

```
Error: Cannot find module 'C:\Users\Davi Muammar\...\dir with space"'
```

PowerShell 7 handles it. The forward-slash equivalent is clean in all three. A path that merely *contains* backslashes and then gets `\scripts\probe.mjs` appended is fine everywhere; it is the backslash *adjacent to the quote* that breaks.

**Hazard 2 — UNC prefix.** In bash double quotes `\\server\share\…` collapses to `\server\share\…`, because `\\` is an escape. Verified by running.

**Hazard 3 — a `$` in a path segment.** Orthogonal to slash direction, and it breaks *both* forms:

```
$ bash -c 'echo "C:/Users/Foo Bar/$temp/x.mjs"'   → C:/Users/Foo Bar//x.mjs
$ bash -c 'echo "C:\Users\Foo Bar\$temp\x.mjs"'   → C:\Users\Foo Bar$temp\x.mjs
$ pwsh -c 'Write-Output "C:/Users/Foo Bar/$temp/x.mjs"' → C:/Users/Foo Bar//x.mjs
```

Forward slash loses the segment; backslash loses the separator; PowerShell expands too. Single quotes fix it in bash and PowerShell, but `cmd.exe` has no single-quote form, so no one quoting style is safe for a `$` path in all three. Windows filenames may legally contain `$`, so this is a latent hazard for every Platform including the ones that normalise — but it is not a hazard the slash decision can address.

**Net:** keep the forward-slash rule. Amend the ADR's justification from "a backslash does not survive all three" to "a quoted backslash path survives an ordinary file path in all three, but breaks when the backslash is adjacent to the closing quote or doubled; forward slash has neither failure."

## Per-platform detail

### Claude Code, plain skill — `${CLAUDE_SKILL_DIR}` is forward-slashed. Observed.

This was the headline open question, and the answer is favourable.

**Observed.** A fixture skill was created at project scope in a throwaway directory outside the repo, at a path deliberately containing a space, and no fixture was written to the real `~/.claude`. Its entire body was three probe lines:

```
SKILLDIR_BEGIN ${CLAUDE_SKILL_DIR} SKILLDIR_END
PLUGINROOT_BEGIN ${CLAUDE_PLUGIN_ROOT} PLUGINROOT_END
PROJECTDIR_BEGIN ${CLAUDE_PROJECT_DIR} PROJECTDIR_END
```

The text delivered to the agent was:

```
SKILLDIR_BEGIN C:/Users/Davi Muammar/AppData/Local/Temp/claude/.../dir with space/proj/.claude/skills/probeskill SKILLDIR_END
PLUGINROOT_BEGIN ${CLAUDE_PLUGIN_ROOT} PLUGINROOT_END
PROJECTDIR_BEGIN C:/Users/Davi Muammar/AppData/Local/Temp/claude/.../dir with space/proj PROJECTDIR_END
```

Three facts in one run:

1. **`${CLAUDE_SKILL_DIR}` expands to forward slashes** on Windows, absolute, with the space preserved unescaped and unquoted. Exactly the form ADR 0006 requires.
2. **`${CLAUDE_PLUGIN_ROOT}` is left literal** in a non-plugin skill, matching the documented "Substituted only in plugin skills". An agent that pasted it into a shell would run against the raw token.
3. **`${CLAUDE_PROJECT_DIR}` is forward-slashed too**, by the same rule.

**Implementation.** The normalisation is unconditional, in the same expression that computes the value. From the shipped 2.1.229 binary:

```js
let p = fz.dirname(t.filePath).replaceAll("\\","/"),
    f = (W) => {
      let G = THe(W, { path: o, source: r });
      if (s.isSkillMode) G = G.replace(/\$\{CLAUDE_SKILL_DIR\}/g, () => p);
      return G
    },
```

`p` is normalised at the point of definition, so every substitution of `${CLAUDE_SKILL_DIR}` — body and `allowed-tools` alike — carries forward slashes. There is no scope conditional in that expression: the value is `dirname` of the `SKILL.md` path, whatever directory the skill was discovered in.

This **corrects the reconstruction recorded in `claude-plugin-format.md`**, which showed `W.replace(/\$\{CLAUDE_SKILL_DIR\}/g, p)` and inferred from the bare `p` that only `${CLAUDE_PLUGIN_ROOT}` was normalised. The `p` was already normalised upstream. The prior note's suspicion was reasonable and its conclusion was wrong.

A second substitution site handles `allowed-tools` array entries, and normalises there too:

```js
if (g && s.length > 0) { let D = dYo(g); s = s.map((z) => z.replace(/\$\{CLAUDE_SKILL_DIR\}/g, () => D)) }
if (s.length > 0) { let D = dYo(Ha()); s = s.map((z) => z.replace(/\$\{CLAUDE_PROJECT_DIR\}/g, () => D)) }
```

**Not documented.** [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) specifies *where* substitution happens but says nothing about slash direction. The forward-slash form is a behaviour of the implementation, confirmed by observation and by the binary, not a documented contract. It could change without a doc change.

### Codex CLI — forward-slashed, explicitly. Read in source.

Codex normalises deliberately. In `codex-rs/ext/skills/src/provider/host.rs`, every path that becomes model-visible passes through a replace:

```rust
let display_path = skill_path.replace('\\', "/");
entry = entry.with_display_path(discovery_path.to_string_lossy().replace('\\', "/"));
```

`rendered_path()` in `codex-rs/ext/skills/src/catalog.rs` then returns that value unchanged:

```rust
pub(crate) fn rendered_path(&self) -> &str {
    self.display_path.as_deref().unwrap_or_else(|| self.main_prompt.as_str())
}
```

and `render.rs` interpolates it into the catalog line:

```rust
"- {name}: {description} ({locator_kind}: {locator})"
```

So the `file:` locator the model reads is forward-slashed on Windows by construction. Combined with the catalog instruction already recorded in #2 — resolve relative references against the directory containing the expanded `SKILL.md`, and prefer running bundled `scripts/` — Codex is the strongest case of the six for dropping the substitution.

`to_string_lossy()` is worth one note: a path with non-UTF-8 bytes would be corrupted rather than rejected. Not reachable on a normal Windows install.

### Gemini CLI — backslashes, with a trailing separator. Read in source. Negative.

The absolute path reaches the model as the first line of the folder-structure block, and nothing normalises it. From `packages/core/src/utils/getFolderStructure.ts`:

```js
const resolvedPath = path.resolve(directory);
…
return `${summary}\n\n${resolvedPath}${path.sep}\n${structureLines.join('\n')}`;
```

`path.resolve` returns native separators, so on Windows `resolvedPath` is backslashed, and `path.sep` appends **one more backslash**. There is no backslash-to-slash replace anywhere in the file. Confirmed by reading the file directly.

That produces exactly Hazard 1 above. A skill directory arrives as:

```
C:\Users\Davi Muammar\.gemini\skills\visualkan\
```

If the agent quotes that value as handed to it, bash raises a syntax error and `cmd.exe` silently absorbs the closing quote. The agent has to strip the trailing separator and append `scripts\visualkan-run.mjs` before quoting — which works, but it is a transformation the agent must get right rather than a value it can paste.

It is worse than a token, too, because there is no token: the path is one line of a box-drawing tree (`├───`, `└───`), so the agent must parse a rendered directory listing to recover it. The remaining lines carry bare file names, not paths.

### OpenClaw — backslashes. Read in source. Negative, with one gap.

`baseDir` is a raw `dirname()` with no normalisation. In `src/skills/loading/session.ts`:

```ts
const skillDir = dirname(filePath);
…
baseDir: skillDir,
```

On Windows that is a backslash path. The repository *has* a `normalizeNativePathSeparators()` helper — it is applied to `relative()` results for ignore-matching — and it is **not** applied to `baseDir`. The omission looks deliberate rather than accidental, which makes the negative result more solid than a mere absence would.

`src/skills/loading/skill-contract.ts` declares `baseDir: string` and carries the model-facing instruction, which is Codex-shaped prose rather than a token:

> When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.

Neither [docs/tools/skills.md](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md) nor [docs/tools/creating-skills.md](https://github.com/openclaw/openclaw/blob/main/docs/tools/creating-skills.md) states the path form, or says whether the loader or the model expands `{baseDir}`.

### Does any Platform document a forward-slash form, or a way to normalise?

**No — not one.** Across all four mechanisms, slash direction is undocumented everywhere. Claude Code and Codex normalise in code without saying so; Gemini CLI and OpenClaw do neither. No Platform offers an author-facing normalisation hook, an alternate token spelling, or a frontmatter switch.

The practical consequence: even the two favourable answers rest on observed implementation behaviour, not on a promise. A skill body that depends on forward slashes is depending on something no Platform has committed to.

## What this means for `{{RUNTIME_PATH}}`

Not a recommendation, just what the evidence supports.

1. **The substitution cannot be deleted.** Gemini CLI and OpenClaw both hand over backslashes, and Antigravity and the bare Open Agent Standard remain unanswered from #2. Adopting tokens everywhere would regress at least two Platforms.
2. **Two Platforms could safely adopt.** Claude Code (`${CLAUDE_SKILL_DIR}`, either scope) and Codex both deliver a quoted-safe forward-slash absolute path. On Claude Code the token additionally makes an `allowed-tools` rule match the command, which an install-time path cannot do.
3. **This is a per-Platform value in the existing `substitutions()` map**, exactly as #2 concluded — not a new mechanism, and not the fallback chain ADR 0004 rejects. One literal per install, chosen at install time.
4. **Adopting a token trades one failure mode for another.** An install-time path breaks when the folder is moved by hand; a token breaks silently if a Platform changes an undocumented normalisation. Neither is free.

## Unverified

- **`~/.claude/skills/` personal scope specifically.** Observation was at project scope (`.claude/skills/`), because installing a fixture into the real `~/.claude/skills/` was out of bounds and a throwaway `CLAUDE_CONFIG_DIR` could not authenticate. The substitution expression has no scope conditional — it is `dirname` of the `SKILL.md` path — and the docs state the variable resolves the same at personal, project and plugin level, so the risk is low. **What would settle it:** a throwaway `CLAUDE_CONFIG_DIR` that is logged in, with the same fixture under its `skills/`.
- **OpenClaw's `{baseDir}` substitution site.** The value is confirmed to be a raw `dirname()`, but the code that replaces the literal token in a body was not located in the public source, and the docs do not say whether the loader or the model performs it. If the model performs it, the finding is unchanged — it would be resolving against the same unnormalised value. **What would settle it:** a Windows OpenClaw install running a probe skill whose body is `{baseDir}`.
- **Codex `alias_root` compaction.** When the catalog renders short paths plus a `### Skill roots` table instead of full `file:` locators, the root table's own rendering was not read. `display_path` is normalised before it reaches either form, so the risk is low.
- **Behaviour on non-Windows.** Every observation is Windows 11. Slash direction is a Windows-only question — on POSIX both forms coincide — so this is noted for completeness rather than as a gap.
- **Antigravity**, still unanswered from #2, and the **Open Agent Standard**, which defines no mechanism at all.

## Sources

- Direct observation, Claude Code 2.1.229, fixture skill at project scope in a throwaway directory (`${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PROJECT_DIR}` expansion)
- Direct execution, this machine: Git Bash, `cmd.exe`, Windows PowerShell 5.1, PowerShell 7, Node v24.12.0 (the shell matrix and the three hazards)
- Claude Code 2.1.229 shipped binary, `~/.local/share/claude/versions/2.1.229` (substitution and normalisation expressions)
- [Claude Code — Skills documentation](https://code.claude.com/docs/en/skills)
- gemini-cli source: [`packages/core/src/utils/getFolderStructure.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/utils/getFolderStructure.ts)
- openai/codex source: [`codex-rs/ext/skills/src/provider/host.rs`](https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/provider/host.rs), [`catalog.rs`](https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/catalog.rs), [`render.rs`](https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/render.rs)
- openclaw source: [`src/skills/loading/session.ts`](https://github.com/openclaw/openclaw/blob/main/src/skills/loading/session.ts), [`src/skills/loading/skill-contract.ts`](https://github.com/openclaw/openclaw/blob/main/src/skills/loading/skill-contract.ts)
- [OpenClaw — Skills](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md) and [Creating skills](https://github.com/openclaw/openclaw/blob/main/docs/tools/creating-skills.md)
- Sibling research: `docs/research/platform-skill-directory.md` (#2), `docs/research/claude-plugin-format.md` (#4)
