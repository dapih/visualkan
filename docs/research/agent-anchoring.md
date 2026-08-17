# Does an Agent Anchor a Prose Relative Path on Its Own Skill Directory?

Research for [issue #14](https://github.com/dapih/visualkan/issues/14). Tests the mechanism
[#5](https://github.com/dapih/visualkan/issues/5) chose — a skill body that states the Runtime is
`scripts/visualkan-run.mjs` inside the skill's own directory, and asks the agent to resolve it
against the directory the skill was loaded from, using forward slashes.

[#13](https://github.com/dapih/visualkan/issues/13) proved the filesystem side: the files land where
the prose says they are. This ticket proves the **agent** side, and it is the first finding in
`docs/research/` established by driving an agent rather than by reading a source.

Investigated 2026-08-17. Windows 11, home directory `C:\Users\Davi Muammar` (contains a space).
Claude Code 2.1.229 driving `claude-opus-5`, Node v24.12.0, `skills` 1.5.22, `@openai/codex` 0.147.0.
Every fixture lived under `%TEMP%\vk14`, and **every fixture path deliberately contained a space**.
No real agent configuration directory was written to; `~/.claude/skills` and `~/.claude/plugins` were
byte-identical before and after.

Six agent runs, `$1.67` total.

## Answer

**The prose mechanism works.** On all three non-rewriting Channels the agent built a path that ran,
on the first command, with no search and no retry.

| Channel | Path ran? | Anchored on | Slashes | Commands to succeed |
|---|---|---|---|---|
| **Claude Code plugin marketplace** | **Yes** | `Base directory for this skill:` preamble | Converted `\` → `/`, quoted | **1** |
| **`npx skills add`** | **Yes** | same preamble | Converted `\` → `/`, quoted | **1** |
| **Manual copy** | **Yes** | same preamble | Converted `\` → `/`, quoted | **1** |
| *(proxy)* Gemini-CLI-shaped directory text | **Yes** | `<available_resources>` tree line | Converted `\` → `/`, **stripped the trailing separator**, quoted | **1** |
| *(control)* No directory text at all | Yes, but | a filesystem **search** | Converted, quoted | **4** |

Three findings beyond the headline:

1. **Not one agent anchored on the working directory**, even though a file at the anchoring
   mistake's exact address existed and would have run.
2. **Every agent normalised the separators itself.** Claude Code hands over a backslash path
   ([`platform-skill-directory.md`](./platform-skill-directory.md)); every command the agents wrote
   used forward slashes, quoted, with the space intact. The prose asked for this, and the prose was
   obeyed.
3. **The failure is loud.** With the script absent, `node` exited 1 with `MODULE_NOT_FOUND` on the
   first command. [#5](https://github.com/dapih/visualkan/issues/5)'s "a wrong path cannot succeed
   quietly" survives the test — with one qualification recorded below.

## How the behaviour was made observable

Reading a transcript that says "it worked" proves nothing about *why*. Two design choices made the
anchoring visible rather than inferred.

**A decoy at the anchoring mistake's address.** Every probe project carried its own
`scripts/run.mjs` at the project root — the exact path a cwd-anchored agent would resolve to. The
two scripts self-identify:

```
VKPROBE-SKILLDIR ...   <- the copy inside the skill directory (correct)
VKPROBE-DECOY-CWD ...  <- the copy at the working directory (the anchoring mistake)
```

So a correct anchor is a *positive* result, not the absence of an error. Without the decoy, a
cwd-anchored agent would simply have failed and self-corrected, and the transcript would have looked
like success.

**The full tool-call stream, not the summary.** Every run used
`--output-format stream-json --verbose`, so the recorded evidence is the literal `Bash` command the
agent issued, not its prose account of what it did.

The fixture skill body carried the prose form under test, and nothing else:

```markdown
Run the Runtime. It is at `scripts/run.mjs`, inside this skill's own directory.

Resolve that relative path against the directory this skill was loaded from, not against the
current working directory, and write it with forward slashes:

```bash
node "<this skill's own directory>/scripts/run.mjs" probe
```
```

**All three Channels delivered that body byte-identical to the source.** Verified with `diff` against
the fixture before any agent ran. The "no rewriting step" premise the ticket rests on is confirmed,
not assumed.

## Per-Channel detail

### Claude Code plugin marketplace — anchored, first try

The fixture was loaded with `claude --plugin-dir` from a directory shaped like a real marketplace
cache, `<temp>/plug space/cache/vkprobe/vkprobe/0.6.0/`, because
[`sibling-and-frontmatter.md`](./sibling-and-frontmatter.md) already proved end to end that
`claude plugin install` produces exactly that
`<cfg>/plugins/cache/<marketplace>/<plugin>/<version>/skills/<name>/` layout. Loading from disk
avoided writing to the user's plugin configuration.

The text the Platform handed the agent, extracted from the transcript:

```
Base directory for this skill: C:\Users\DAVIMU~1\AppData\Local\Temp\vk14\plug space\cache\vkprobe\vkprobe\0.6.0\skills\pathprobe
```

The one and only command the agent ran:

```bash
node "C:/Users/DAVIMU~1/AppData/Local/Temp/vk14/plug space/cache/vkprobe/vkprobe/0.6.0/skills/pathprobe/scripts/run.mjs" probe
```

It printed `VKPROBE-SKILLDIR`. The decoy at the working directory was not touched. The agent's own
account:

> I resolved `scripts/run.mjs` against `C:/Users/DAVIMU~1/.../skills/pathprobe` — the "Base directory
> for this skill" given in the skill's own loaded content — not against the working directory.

Note the transformation performed silently between those two blocks: **eleven backslashes became
forward slashes**, and the path was wrapped in double quotes because of the space. That is precisely
the form ADR 0006 requires, and no Platform supplied it — the agent produced it from the prose
instruction.

### `npx skills add` — anchored, first try

Installed with `npx skills@1.5.22 add <fixture> -s pathprobe -a claude-code -y --copy` from inside a
throwaway project, at project scope, its default. That produced
`.claude/skills/pathprobe/{SKILL.md, scripts/run.mjs}`, matching
[`npx-skills-add.md`](./npx-skills-add.md) §2.

Preamble: `Base directory for this skill: C:\Users\Davi Muammar\...\proj2 space\.claude\skills\pathprobe`

The one and only command:

```bash
node "C:/Users/Davi Muammar/AppData/Local/Temp/vk14/proj2 space/.claude/skills/pathprobe/scripts/run.mjs" probe
```

`VKPROBE-SKILLDIR`. The decoy sat two directory levels up, unused.

### Manual copy — anchored, first try

A plain `cp -r` of the skill directory into `<project>/.claude/skills/pathprobe`, with the same decoy
in place. Identical result:

```bash
node "C:/Users/Davi Muammar/AppData/Local/Temp/vk14/proj3 space/.claude/skills/pathprobe/scripts/run.mjs" probe
```

On Claude Code this Channel and `npx skills add` converge on the same on-disk address, so the
identical outcome is expected. It was run separately rather than inferred, because the ticket asks
for each Channel to be exercised.

The Codex side of this Channel was checked for free, with no API call, using
`codex debug prompt-input` against a fixture at `<project>/.agents/skills/pathprobe`. Codex
discovered it and rendered it into the model-visible catalog:

```
### Skill roots
- `r20` = `C:/Users/Davi Muammar/AppData/Local/Temp/vk14/proj6 space/.agents/skills`
### Available skills
- pathprobe: Path anchoring probe. ... (file: r20/pathprobe/SKILL.md)
```

Forward-slashed, absolute, exactly as [`skill-directory-token-shells.md`](./skill-directory-token-shells.md)
read out of `provider/host.rs`. The *mechanism* is confirmed for Codex on this Channel. The
*behaviour* is not — see Unverified.

## The four questions the ticket asked

### 1. Does the agent construct a path that runs?

Yes, on every Channel reached, on the first command. Four of the six runs used exactly one `Bash`
call. The two that took more were the two deliberately degraded fixtures.

### 2. What did it anchor on — the Platform's directory text, the working directory, or a search?

**The Platform's directory text, every time it was offered one.** Never the working directory, and
never a search — despite a runnable file sitting at the cwd-anchored address in every probe.

Where no directory text was offered, the agent fell back to **search**. That control run is the most
decision-relevant result here, so it gets its own section below.

### 3. Backslashes and trailing separators — normalised, or passed through?

**Normalised, in both hazardous shapes.**

*Backslashes* were tested for real, not simulated: Claude Code's preamble is backslashed on Windows
on all three Channels, confirmed in every transcript. Every agent emitted forward slashes.

*A trailing separator* is Gemini CLI's shape, and Gemini CLI is not installed here. It was tested by
**proxy**: a Claude Code run with no skill installed, handed the exact `<activated_skill>` /
`<available_resources>` block Gemini CLI's `getFolderStructure.ts` produces — backslash path, one
appended `path.sep`, box-drawing tree — as the prompt. This tests how a model handles that text form.
It does not test the Gemini harness.

Input line, byte-verified with `od -c`:

```
C:\Users\DAVIMU~1\AppData\Local\Temp\vk14\gem space\.gemini\skills\pathprobe\
├───SKILL.md
└───scripts/
    └───run.mjs
```

Command produced:

```bash
node "C:/Users/DAVIMU~1/AppData/Local/Temp/vk14/gem space/.gemini/skills/pathprobe/scripts/run.mjs" probe
```

The agent parsed the path out of a rendered directory tree, dropped the trailing separator, converted
the separators, appended the relative path, and quoted the result — producing no `//`, and none of
Hazard 1 from [`skill-directory-token-shells.md`](./skill-directory-token-shells.md), where a
backslash adjacent to a closing quote makes bash raise a syntax error and `cmd.exe` silently absorb
the quote. One command, two turns, the cheapest run of the six.

### 4. Is a failure loud, or a silent skip?

**Loud and immediate**, and this is the bullet [#5](https://github.com/dapih/visualkan/issues/5)
staked its reasoning on.

The probe removed `scripts/` from the installed skill and removed the decoy, so no path could
succeed. The agent anchored correctly, and `node` failed on the first command:

```
Exit code 1
Error: Cannot find module 'C:\Users\...\proj4 space\.claude\skills\pathprobe\scripts\run.mjs'
  code: 'MODULE_NOT_FOUND'
```

It then spent four further commands locating the problem, found five other copies of `run.mjs`
elsewhere on disk — and **ran none of them**, reporting the failure plainly instead:

> I did not run any of them: none is the file this skill's instructions point at, so executing one
> would have manufactured an output line that misrepresents what the correct path resolves to.

No silent skip, and no silent substitution.

**One qualification, recorded because it weakens the generalisation.** That same reply opened with
"since it's the likely point of the probe" — the model recognised it was being tested. A model that
knows it is a fixture may be more scrupulous about not substituting a nearby file than one working
inside a real user's task. The *loudness* of the `node` failure is a property of Node and is not in
doubt; the agent's refusal to paper over it is a behaviour observed once, under conditions the model
had identified as a test.

## The control that matters most: a Platform that reveals nothing

The three Channels above all ran on Claude Code, which volunteers the skill directory. The prose was
never load-bearing there — it only had to be *obeyed*, not to supply information.

So a sixth run removed the directory text entirely: the skill body arrived through the prompt with no
base-directory line, no resources block, no token — the shape of a Platform with no mechanism at all.
[`platform-skill-directory.md`](./platform-skill-directory.md) records two such cases: the Open Agent
Standard, which "defines **no** mechanism for learning the skill root", and Antigravity, still
unverified. The skill was installed at `<project>/.agents/skills/pathprobe`, and the decoy sat at the
project root.

**The agent recovered, by searching.** Four commands: it looked in `~/.claude/skills`, then swept the
temp tree for a `pathprobe` directory, found **seven** candidates, listed two of them, read the
`SKILL.md` of the one under its working directory, confirmed the body matched the instructions it had
been given, and only then ran the script. It got the right answer, and it did not take the decoy.

That result cuts both ways, and both halves matter.

- **It survives.** Prose plus a competent agent recovers even with zero help from the Platform.
- **It is not the same mechanism.** One deterministic command became a four-step heuristic search over
  seven candidates, disambiguated by reading file contents. It succeeded here because the skill
  happened to live *under the working directory*. A skill installed at global scope — outside the
  project entirely — gives that search nothing to find, and none of this was tested.

This is a direct argument for keeping [#5](https://github.com/dapih/visualkan/issues/5) part 5: the
Installer's rewrite to an absolute path is what turns a search into a command on the Platforms that
reveal nothing. Read against ADR 0004, "resolve the directory text, else search the filesystem" is a
fallback chain the agent invents on its own when the first input is missing — and the rewrite is what
prevents it from ever being reached.

## What this means for the spec

Not a recommendation, just what the evidence supports.

1. **The prose mechanism survives the test it was blocking on.** Three non-rewriting Channels, three
   first-try successes, with a decoy in place to make the success positive rather than merely
   error-free.
2. **The prose earns its keep even where a Platform volunteers the path.** The directory text is
   backslashed on every Claude Code Channel. The forward-slash sentence is the thing that turns it
   into a command that survives bash, `cmd.exe`, and PowerShell alike. Dropping that clause from the
   body would remove the only instruction that fires on all three of these Channels.
3. **`#5`'s loudness argument holds**, with the caveat that it was observed once, from a model that
   had spotted the fixture.
4. **The Installer's rewrite is doing more than rescuing the Open Agent Standard.** Without a
   directory text, the mechanism degrades from one command to a filesystem search whose success
   depended on the skill living under the working directory. Global-scope installs on such a Platform
   are untested and are the likeliest place for this to break.

## Unverified

- **Codex CLI behaviour.** The mechanism is confirmed for free (`codex debug prompt-input` renders a
  forward-slashed absolute root and a `file:` locator for the fixture). The behaviour is not: the
  `codex exec --full-auto` run was **blocked by this session's own permission classifier**, and
  working around that was out of bounds. This is the single biggest gap, because it would have been
  the only observation from a different model vendor. **What would settle it:** `codex exec` against
  a fixture at `<project>/.agents/skills/pathprobe` with a decoy at the project root, in a session
  permitted to auto-approve, and check whether the printed line is `VKPROBE-SKILLDIR` or
  `VKPROBE-DECOY-CWD`.
- **Every behavioural observation is one model.** All six runs used `claude-opus-5`. Anchoring is a
  model behaviour, not a Platform guarantee, and nothing here shows how a smaller or older model
  handles the same text. **What would settle it:** re-run the same three Channel probes with
  `--model` set to a cheaper model.
- **Gemini CLI, OpenClaw, and Antigravity as harnesses.** Not installed here, or GUI-only. The
  trailing-separator result is a proxy — right text, wrong harness. OpenClaw's backslash `{baseDir}`
  was not tested at all, by proxy or otherwise; its shape is a plain backslash path with no trailing
  separator, which is the *easier* of the two hazards and is covered in kind by the Claude Code
  preamble result.
- **Claude Code personal scope (`~/.claude/skills/`).** All Claude Code runs were project scope or
  `--plugin-dir`, because installing a fixture into the real `~/.claude` was out of bounds and a
  throwaway `CLAUDE_CONFIG_DIR` cannot authenticate — `~/.claude/.credentials.json` is the only copy.
  The preamble is `dirname` of the `SKILL.md` path with no scope conditional
  ([`skill-directory-token-shells.md`](./skill-directory-token-shells.md)), so the risk is low.
- **A search with the skill outside the working directory.** The no-mechanism control succeeded
  because the skill was under cwd. The global-scope version of that case is untested and is where the
  mechanism is most likely to fail.
- **Non-Windows.** Every observation is Windows 11. Slash direction is a Windows-only question, so
  the normalisation finding is moot on POSIX; the anchoring finding should carry over unchanged.
- **The real Runtime.** The fixture ran a one-line `run.mjs`, never `visualkan-run.mjs`, and no image
  API was called.

## Reproducing this

```bash
R=<throwaway-under-%TEMP%>

# Fixture: a skill whose body carries the prose form, a script beside it that prints
# VKPROBE-SKILLDIR, and a decoy at each project root that prints VKPROBE-DECOY-CWD.

# Channel 1 - plugin marketplace, loaded from a cache-shaped directory.
cd "$R/proj1 space" && claude -p "Use the pathprobe skill." \
  --output-format stream-json --verbose --allowedTools "Skill,Bash,Read,Glob,Grep" \
  --plugin-dir "$R/plug space/cache/vkprobe/vkprobe/0.6.0"

# Channel 2 - npx skills add, project scope.
cd "$R/proj2 space" && npx skills@1.5.22 add "$R/src" -s pathprobe -a claude-code -y --copy
cd "$R/proj2 space" && claude -p "Use the pathprobe skill." --output-format stream-json --verbose \
  --allowedTools "Skill,Bash,Read,Glob,Grep"

# Channel 3 - manual copy.
cp -r "$R/src/skills/pathprobe" "$R/proj3 space/.claude/skills/pathprobe"
cd "$R/proj3 space" && claude -p "Use the pathprobe skill." ...

# Loud-failure probe: same, with scripts/ deleted from the installed skill and no decoy.
# Gemini proxy: no skill installed; the <activated_skill>/<available_resources> block is the prompt.
# No-mechanism control: no skill registered with the Platform; the body alone is the prompt.

# Read the evidence - the literal Bash command, not the agent's account of it.
grep '"tool_use"' out*.jsonl
```

Confirm afterwards that `~/.claude/skills` and `~/.claude/plugins` are unchanged, and that no
`pathprobe` or `vkprobe` directory exists under `~/.claude`, `~/.codex`, `~/.gemini`, or `~/.agents`.
Driving `claude -p` writes session logs under `~/.claude/projects/`, exactly as an ordinary session
does; nothing else in a real configuration directory is touched.

## Sources

Primary, in order of authority for each claim:

- Direct observation, six `claude -p` runs, Claude Code 2.1.229 / `claude-opus-5`, full
  `stream-json` transcripts. Every command quoted above is the literal `Bash` tool input recorded in
  a transcript, not an agent's summary.
- Direct execution, this machine: `npx skills@1.5.22 add`, `diff` of the delivered bodies against the
  fixture, `od -c` on the Gemini-shaped input, Node v24.12.0.
- `codex debug prompt-input`, `@openai/codex` 0.147.0, against a fixture under a throwaway project —
  renders the model-visible skills catalog with no API call and no cost.
- [Claude Code — Skills documentation](https://code.claude.com/docs/en/skills)
- gemini-cli source: [`packages/core/src/utils/getFolderStructure.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/utils/getFolderStructure.ts),
  for the shape reproduced in the proxy probe
- [Agent Skills — specification](https://agentskills.io/specification), for the documented absence of
  any skill-root mechanism
- Sibling research: [`platform-skill-directory.md`](./platform-skill-directory.md) (#2),
  [`npx-skills-add.md`](./npx-skills-add.md) (#3),
  [`claude-plugin-format.md`](./claude-plugin-format.md) (#4),
  [`skill-directory-token-shells.md`](./skill-directory-token-shells.md) (#10),
  [`sibling-and-frontmatter.md`](./sibling-and-frontmatter.md) (#13)
- Decision under test: [#5](https://github.com/dapih/visualkan/issues/5) resolution comment, parts 1
  and 5; [#12](https://github.com/dapih/visualkan/issues/12) for the Wizard's sibling read
