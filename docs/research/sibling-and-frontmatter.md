# Do the Sibling and Frontmatter Assumptions Hold

Research for [issue #13](https://github.com/dapih/visualkan/issues/13). Tests the two facts
[#12](https://github.com/dapih/visualkan/issues/12) accepted without proof: that the two skills land
as siblings on every Channel, and that only Claude Code cares about
`disable-model-invocation: true`.

Investigated 2026-08-17 on Windows 11. Claude Code 2.1.229, Node v24.12.0, `skills` 1.5.22,
`@openai/codex` 0.147.0, `@google/gemini-cli-core` 0.55.1, `openclaw` 2026.7.1-2, `skills-ref` 0.1.5.
Every install ran against a throwaway home, a throwaway `CODEX_HOME`, or a throwaway
`CLAUDE_CONFIG_DIR`. No real agent configuration directory was written to.

## The two verdicts

**1. Siblings: yes on three Channels, no on the fourth.** The npm Installer, the plugin marketplace,
and a manual copy all put both skills under one parent, and `../visualkan/SKILL.md` resolves in every
one. `npx skills add` breaks it: `-s visualkan-wizard` installs the Wizard **alone**, with no
dependency resolution and no warning, and the sibling path resolves to nothing.

**2. The frontmatter key: no Platform rejects it, but a seventh distribution path does.** All six
Platforms ignore or honour it. Two honour it — Claude Code and, unexpectedly, **OpenClaw**, which
implements the same field with the same meaning. The rejection lives outside the `PLATFORMS`
registry: the Agent Skills reference validator and the claude.ai / Skills API packaging path both
fail hard on any key outside the spec's six.

**And that rejection already fires today.** The Wizard's existing `argument-hint` is not a spec field
either, so `skills-ref validate` rejects the Wizard **as it currently ships**, before
`disable-model-invocation` is added at all. The new key adds a second name to an error message that
is already there.

## Question 1: do the two skills land as siblings?

| Channel | Siblings? | Can a user take the Wizard alone? | Evidence |
|---|---|---|---|
| npm, placed by the Installer | **Yes**, all 11 targets | **No** — impossible by construction | Executed |
| Claude Code plugin marketplace | **Yes** | **No** — the plugin is the unit | Executed, end to end |
| `npx skills add` | Yes *when both are installed* | **YES — and this is the failure** | Executed |
| Manual copy | Depends on the instructions | Yes, trivially | See requirements below |

### npm Installer — holds, and cannot be made to fail

`cmdInstall` loops `for (const skillName of Object.keys(SKILLS))` (`visualkan.mjs`), so both skills
install or neither does. There is no flag to install one. `targetDir` joins the same
`...platform.global` / `...platform.project` prefix for each, differing only in the final segment.

Verified by running the real Installer against a throwaway home and a throwaway project, for all six
Platforms at global scope and all five that support project scope. Every one produced the pair, and
`<wizard-dir>/../visualkan/SKILL.md` resolved in all eleven:

```
~/.claude/skills/{visualkan, visualkan-wizard}
~/.gemini/config/skills/{visualkan, visualkan-wizard}
~/.gemini/skills/{visualkan, visualkan-wizard}
~/.codex/skills/{visualkan, visualkan-wizard}
~/.agents/skills/{visualkan, visualkan-wizard}
~/clawd/skills/{visualkan, visualkan-wizard}          <- path itself is wrong; see platform-install-targets.md
<proj>/.claude/skills/, <proj>/.gemini/skills/, <proj>/.codex/skills/, <proj>/.agents/skills/
```

`uninstall` removes both by the same loop, so the pair cannot be half-removed either.

Note that the Installer does not use a relative path today — it writes `{{VISUALKAN_SKILL_PATH}}`, an
absolute or project-relative literal. Switching to the prose sibling path is safe on this Channel:
the pair is guaranteed, and the relative form resolves at all eleven targets. See the open question
at the end about what the *agent* resolves it against.

### Claude Code plugin marketplace — holds, verified end to end

This also closes the item `claude-plugin-format.md` left open, which had only tested
`claude --plugin-dir` against fixtures.

A fixture marketplace was added and installed into a throwaway `CLAUDE_CONFIG_DIR`:

```
$ claude plugin marketplace add <fixture>
✔ Successfully added marketplace: visualkan (declared in user settings)
$ claude plugin install visualkan@visualkan
✔ Successfully installed plugin: visualkan@visualkan (scope: user)
```

The installed tree keeps the repository layout, so the skills stay siblings:

```
<cfg>/plugins/cache/visualkan/visualkan/0.6.0/skills/visualkan/SKILL.md
<cfg>/plugins/cache/visualkan/visualkan/0.6.0/skills/visualkan-wizard/SKILL.md
```

`../visualkan/SKILL.md` resolves, and `claude plugin details visualkan` reports
`Skills (2)  visualkan, visualkan-wizard`. The real `~/.claude` was confirmed untouched afterwards.

**A plugin is atomic.** There is no per-skill selection at install time. A user can suppress one skill
with a `Skill(...)` deny [permission rule](https://code.claude.com/docs/en/permissions), but that
blocks invocation only — the file stays on disk, so the sibling path still resolves.

### `npx skills add` — the assumption fails

This is the answer [#3](https://github.com/dapih/visualkan/issues/3) left open.

**All three behaviours exist, and one of them is the failure.** Against a two-skill fixture:

- `--list` reports `Found 2 skills` and ends with `Use --skill <name> to install specific skills`.
  The tool advertises the partial install itself.
- No `-s`, non-interactive (`-y`, or an auto-detected agent): installs **both**.
- Interactive with no flags: a multiselect prompt, so a user can uncheck one.
  (From `README` lines 56, 59-60 and cli.mjs:4715-4737, recorded in `npx-skills-add.md`. Not
  re-observed here — this session has no TTY. **UNVERIFIED** by observation.)
- `-s visualkan-wizard`: installs **the Wizard alone**.

Observed, the failure case:

```
$ npx skills@1.5.22 add <fixture> -s visualkan-wizard -a claude-code -y --copy
◇ Installed 1 skill
  ✓ visualkan-wizard (copied)

$ find .claude
.claude/skills/visualkan-wizard/SKILL.md
```

`.claude/skills/visualkan/SKILL.md` does not exist. There is **no dependency resolution, no warning,
and no error**. The Wizard's `../visualkan/SKILL.md` resolves to nothing, and the user finds out when
the Wizard runs and the Read fails.

Nothing in the skill package can prevent this. The tool never parses a sidecar — a file named exactly
`metadata.json` is dropped from the copy and is not read anywhere in the bundle
(`npx-skills-add.md` §5) — so the `dependencies.skills: ["visualkan"]` already declared in
`skill/visualkan-wizard.metadata.json` has no reader on this Channel.

**When both are installed, siblings hold in both install modes.** The install directory is
`sanitizeName(frontmatter.name)` under each agent root, so the two names put the two directories side
by side. Verified in copy mode (single agent) and in symlink mode (`-a claude-code -a codex
-a gemini-cli`, which resolves to two distinct roots):

```
.agents/skills/{visualkan, visualkan-wizard}      <- real files
.claude/skills/{visualkan, visualkan-wizard}      <- symlinks
```

**Consequence: the failure must be stated in the Wizard body.** The Wizard cannot assume the sibling
exists. It should read the sibling, and on failure say plainly that the `visualkan` skill is missing
and name the fix — `npx skills add dapih/visualkan` with no `-s`, or `-s '*'`.

### Manual copy — what the instructions must say

Three requirements, all load-bearing:

1. **Copy both directories, into the same skills root.** Naming one directory is what makes this
   Channel fail; the instruction must name the pair as a pair.
2. **Keep the directory names exactly `visualkan` and `visualkan-wizard`.** The sibling path is
   spelled `../visualkan/`, so a user who renames the target directory breaks it. This is not merely
   a Visualkan convention — the Agent Skills spec requires `name` to match the parent directory name,
   and the reference validator enforces it:
   ```
   - Directory name 'wrongdir' must match skill name 'visualkan-wizard'
   ```
   Claude Code agrees from the other direction: for a personal or project skill, the command name
   comes from the **directory name**, and frontmatter `name` is only a display label.
3. **Use the corrected roots** from [`platform-install-targets.md`](./platform-install-targets.md),
   including `~/.openclaw/skills` rather than `~/clawd/skills`.

A manual copy also does not run the Installer, so no `{{...}}` placeholder is substituted. This is a
second, independent argument for the relative sibling path over `{{VISUALKAN_SKILL_PATH}}`: the
relative form is the only one that is correct without a rewriting step, on this Channel and on the
`npx skills add` Channel alike.

## Question 2: does any Platform reject an unknown frontmatter key?

| Platform / toolchain | Verdict | How established |
|---|---|---|
| Claude Code | **Honours it** | First-party docs + executed |
| Antigravity | **UNVERIFIED** — ignores, on strong indirect evidence | Shipped binary strings |
| Gemini CLI | **Ignored** | Shipped loader, executed |
| Codex CLI | **Ignored** | Shipped binary, executed |
| Open Agent Standard | **Ignored at load, REJECTED by the spec's validator** | Reference implementation, executed |
| OpenClaw | **Honours it** — same field, same meaning | Shipped bundle, executed |
| `npx skills add` | **Ignored**, and preserved byte-for-byte | Shipped bundle + executed |
| *(not in the registry)* claude.ai upload / Skills API / `package_skill.py` | **REJECTED, hard error** | First-party docs |

Three probe skills were used throughout: one carrying `disable-model-invocation: true`, one carrying
two invented keys (`visualkan-nonsense-key`, `totally-made-up`), and one carrying nothing extra.

### Claude Code — honours it, for every skill, not only plugin skills

`disable-model-invocation` is in the main frontmatter table in
[code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills):

> | `disable-model-invocation` | No | Set to `true` to prevent Claude from automatically loading
> this skill. Use for workflows you want to trigger manually with `/name`. […] Default: `false`.

And the effect is exactly what ADR 0005 wants — the description leaves the model's context entirely:

> | `disable-model-invocation: true` | You can invoke: Yes | Claude can invoke: No | Description **not
> in context**, full skill loads when you invoke |

**This corrects `claude-plugin-format.md`**, which recorded that `disable-model-invocation` was
"neither available to a plain skill directory". That is wrong. The docs scope the whole table to
"Claude Code skills at any level, **including** plugin skills", and note that custom commands have
been merged into skills, so every skill already has a `/name`. The field works for the npm Channel's
plain `~/.claude/skills/visualkan-wizard/` install too.

Observed: a fixture plugin whose Wizard carried the key loaded normally, and a control skill carrying
two invented keys loaded normally beside it — `Skills (3)  control-junk, visualkan, visualkan-wizard`.
Claude Code does not reject unknown keys.

### OpenClaw — honours it, which nobody expected

OpenClaw implements the same field, under the same spelling, with the same semantics. From the
shipped bundle, `dist/frontmatter-Co_01Uxb.js`:

```js
function resolveSkillInvocationPolicy(frontmatter) {
	return {
		userInvocable: parseFrontmatterBool(getFrontmatterString(frontmatter, "user-invocable"), true),
		disableModelInvocation: parseFrontmatterBool(getFrontmatterString(frontmatter, "disable-model-invocation"), false)
	};
}
```

It is consumed, not merely parsed — `dist/workspace-BgZV1_od.js:898` sets
`includeInAvailableSkillsPrompt: !invocation.disableModelInvocation`, and
`dist/sessions-D8qGY7uC.js:9348` documents the same rule:

```js
/* Skills with disableModelInvocation=true are excluded from the prompt */
return formatSkillsForPrompt$1(skills.filter((s) => !s.disableModelInvocation));
```

Verified by executing the shipped parser against the three probes:

```
probe-dmi        keys=["name","description","disable-model-invocation"]  policy={"userInvocable":true,"disableModelInvocation":true}
probe-junk       keys=["name","description","visualkan-nonsense-key","totally-made-up"]  policy={"userInvocable":true,"disableModelInvocation":false}
probe-baseline   keys=["name","description"]  policy={"userInvocable":true,"disableModelInvocation":false}
```

Unknown keys are retained as strings and never validated: `parseFrontmatterBlock` iterates
`Object.entries(parsed)` and keeps everything it can coerce. No allowlist, no rejection.

So the ticket's framing — "Claude Code honours it, every other Platform must ignore it" — is better
than it needed to be. Two of six honour it, and the Wizard gets its intended behaviour on both.

### Gemini CLI — ignored

`dist/src/skills/skillLoader.js` destructures exactly two keys and discards the rest:

```js
const parsed = load(content);
if (parsed && typeof parsed === 'object') {
    const { name, description } = parsed;
    if (typeof name === 'string' && typeof description === 'string') {
        return { name, description };
    }
}
```

There is no allowlist and no unknown-key check. Verified by executing the shipped loader against the
three probes: `loaded 3`, all with their descriptions intact.

### Codex CLI — ignored

Verified by running `codex debug prompt-input`, which renders the model-visible prompt as JSON with
no API call and no cost, against a throwaway `CODEX_HOME` holding all three probes. All three
appeared in the catalog:

```
probe-baseline
probe-dmi
probe-junk
```

### Antigravity — UNVERIFIED, but the evidence points to ignored

Antigravity is a GUI IDE with no headless skills command, and installing a probe skill would mean
writing to the real `~/.gemini/config/skills`, which this research does not do.

Two indirect findings, both from `resources/bin/language_server.exe`:

- The only frontmatter validation it carries an error string for is the same two fields everyone
  else checks: `Markdown agent at %s is missing name or description in frontmatter`.
- `disable-model-invocation` **does not appear anywhere** in Antigravity's installed files, so the
  key is not recognised — the question is only whether it is ignored or refused.

The binary is Go, and `failed to unmarshal frontmatter YAML` indicates a struct unmarshal, which
ignores unknown fields unless strict decoding is switched on. `KnownFields` and the strict error
string `line %d: field %s not found in type %s` are present in the binary, but go-yaml ships those
whether or not any caller enables them, so this does not settle it either way.

**What would settle it:** install a one-line probe skill carrying the key at
`~/.gemini/config/skills/probe-dmi/` and ask the agent to list its available skills. That requires
writing to a real configuration directory, so it is left for someone working outside this
constraint.

### `npx skills add` — ignored, and preserved verbatim

Only `name` and `description` are required (cli.mjs:1066-1076); everything else is untouched and
copied byte-for-byte, as `npx-skills-add.md` §6 established. Re-confirmed here with the actual key —
the installed Wizard came through unchanged:

```yaml
argument-hint: "(no arguments)"
allowed-tools: Bash, Read, Write, Glob, Grep
disable-model-invocation: true
```

The invented-key control installed cleanly too, in the same run that installed the pair.

### Open Agent Standard — the negative result

The [spec](https://agentskills.io/specification) defines a **closed** frontmatter table — `name`,
`description`, `license`, `compatibility`, `metadata`, `allowed-tools` — and names `metadata` as the
designated extension point:

> The optional `metadata` field: A map from string keys to string values. **Clients can use this to
> store additional properties not defined by the Agent Skills spec.**

The spec text does not state what a client must do with an unknown top-level key, so the reference
implementation is the authority. It rejects. Verified by running `skills-ref` 0.1.5:

```
$ agentskills validate <probe-dmi>
Validation failed:
  - Unexpected fields in frontmatter: disable-model-invocation.
    Only ['allowed-tools', 'compatibility', 'description', 'license', 'metadata', 'name'] are allowed.
```

**Two qualifiers keep this from being a Channel break.**

First, it is the *linter* that rejects, not the *loader*. The same tool's runtime-shaped commands
accept the file: `read-properties` returned name and description, and `to-prompt` emitted the skill
into `<available_skills>` normally. No Platform in the registry runs this validator at load time.

Second, and more usefully: **the Wizard already fails this validator today.**

```
$ agentskills validate <wizard-frontmatter-as-shipped>
  - Unexpected fields in frontmatter: argument-hint. …

$ agentskills validate <wizard-frontmatter-as-planned>
  - Unexpected fields in frontmatter: argument-hint, disable-model-invocation. …
```

`argument-hint` is not a spec field. Adding `disable-model-invocation` does not create this problem;
it lengthens an error message that Visualkan has been producing since the Wizard was written.

Expressing the same intent through the spec's own extension point passes:

```yaml
metadata:
  disable-model-invocation: "true"
```
```
Valid skill: <wizard-metadata-form>
```

That form is **not** a substitute: Claude Code and OpenClaw both read the top-level key, and neither
reads it out of `metadata`. It is recorded here only to show that the spec has a sanctioned shape and
Visualkan is choosing not to use it, for a reason — the two Platforms that implement the behaviour
spell it at the top level.

### The path that does reject, and it is not in the registry

The registry has six Platforms. There is a seventh distribution path, and Anthropic documents it
rejecting exactly this, with exactly the error the reference validator produced:

> | claude.ai skill uploads, the Skills API, and packaging with `package_skill.py` | `name`,
> `description`, `license`, `compatibility`, `metadata`, `allowed-tools` |
>
> If you include any field the spec doesn't allow, packaging or upload **fails with a hard error
> instead of ignoring the field**:
>
> ```
> Unexpected key(s) in SKILL.md frontmatter: argument-hint. Allowed properties are: allowed-tools,
> compatibility, description, license, metadata, name
> ```
>
> — [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)

Anthropic's own example names `argument-hint`, the field the Wizard already carries. The same page
notes this also covers enabling a personal skill for Cowork and cloud sessions.

This is a Channel Visualkan does not ship on today. It is worth a documented limitation rather than a
change, unless that Channel is ever wanted.

## What this changes

1. **The Wizard body must state the missing-sibling failure.** Read `../visualkan/SKILL.md`; if it is
   not there, stop and tell the user the `visualkan` skill is not installed, and give the fix. This
   is the "changed sentence in a skill body" the ticket anticipated, and `npx skills add -s` is why.
2. **The `npx skills add` install instructions must never show `-s visualkan-wizard`.** Show the bare
   `npx skills add dapih/visualkan`, or `-s '*'`. A README that demonstrates the single-skill form
   teaches users the one command that breaks the pair.
3. **Manual-copy instructions must name both directories, the shared parent, and the exact directory
   names.** Renaming a target directory breaks the sibling path and violates the spec's
   name-matches-directory rule.
4. **Correct `claude-plugin-format.md`.** `disable-model-invocation` is available to plain skill
   directories, not only plugin skills, so the npm Channel gets the ADR 0005 benefit too.
5. **Record the spec-conformance limitation.** The Wizard's frontmatter is not spec-clean, because of
   `argument-hint` first and `disable-model-invocation` second. That is a deliberate trade — both
   fields buy behaviour on the Platforms that matter — but it closes the claude.ai / Skills API path
   and fails `skills-ref validate`. Worth one line in the README rather than a code change.

## Unverified

- **Antigravity's handling of an unknown key.** No headless discovery command exists, and the key is
  absent from its installed files. Settled by planting a probe skill in
  `~/.gemini/config/skills/` and asking the agent to list its skills — which means writing to a real
  configuration directory.
- **The `npx skills add` interactive multiselect.** Recorded from the shipped bundle and README in
  `npx-skills-add.md`, not re-observed here, because this session has no TTY. Settled by running
  `npx skills add <repo>` with no flags in a terminal. It does not change the verdict: `-s` alone
  already proves a user can take the Wizard without the `visualkan` skill.
- **Non-Windows behaviour.** All observations are Windows 11. The sibling layout is produced by
  `path.join` and by directory-per-skill copies on every Channel, so the risk is low.
- **`skills-ref` as a gate.** No Platform was observed running `skills-ref validate` at load time. If
  a registry or directory ever adopts it as an admission check, the linter result becomes a Channel
  break rather than a lint failure.

## Reproducing this

```bash
# Q1, npm Installer — throwaway home, all six Platforms.
USERPROFILE=<throwaway> node visualkan.mjs install claude
find <throwaway> -type d -name 'visualkan*'

# Q1, npx skills add — the failure.
npx skills@1.5.22 add <fixture> -s visualkan-wizard -a claude-code -y --copy
ls .claude/skills/            # visualkan-wizard only

# Q1, plugin marketplace — end to end, throwaway config.
CLAUDE_CONFIG_DIR=<throwaway> claude plugin marketplace add <fixture>
CLAUDE_CONFIG_DIR=<throwaway> claude plugin install visualkan@visualkan
CLAUDE_CONFIG_DIR=<throwaway> claude plugin details visualkan

# Q2, Codex — renders the model-visible prompt, no API call, no cost.
CODEX_HOME=<throwaway> codex debug prompt-input | grep -o 'probe-[a-z]*'

# Q2, Gemini CLI — run the shipped loader directly.
npm pack @google/gemini-cli-core@0.55.1 && tar -xzf *.tgz && cd package
npm install js-yaml glob --no-save
node -e "import('./dist/src/skills/skillLoader.js').then(async m => {
  for (const s of await m.loadSkillsFromDir('<probe-dir>')) console.log(s.name, '|', s.description);
})"

# Q2, OpenClaw — run the shipped frontmatter parser and policy resolver.
npm pack openclaw@2026.7.1-2 && tar -xzf openclaw-*.tgz && cd package
npm install yaml --no-save
node -e "import(require('node:url').pathToFileURL('./dist/frontmatter-Co_01Uxb.js').href).then(fm => {
  const p = fm.t(require('node:fs').readFileSync('<probe>/SKILL.md','utf8'));
  console.log(Object.keys(p), fm.r(p));
})"

# Q2, Open Agent Standard — the spec's own reference implementation.
uvx --from skills-ref agentskills validate <probe-dir>
uvx --from skills-ref agentskills to-prompt <probe-dir>
```

Every fixture lived under `%TEMP%`. The plugin marketplace test used a throwaway `CLAUDE_CONFIG_DIR`,
and `~/.claude` was confirmed unchanged afterwards.

## Sources

Primary, in order of authority for each claim:

- `visualkan.mjs`, `cmdInstall` / `targetDir` / `installedPath`, executed against throwaway roots
- Shipped `skills@1.5.22`: `dist/cli.mjs` and `README.md`, plus observed runs against a two-skill
  fixture
- Claude Code 2.1.229: `claude plugin marketplace add`, `plugin install`, `plugin details`,
  `plugin validate`, observed against fixtures in a throwaway config directory
- [Claude Code — Skills](https://code.claude.com/docs/en/skills), the frontmatter table, the
  "Control who invokes a skill" section, and "Using skill frontmatter outside Claude Code"
- Shipped `@google/gemini-cli-core@0.55.1`: `dist/src/skills/skillLoader.js`, executed
- Shipped `@openai/codex@0.147.0`: observed `codex debug prompt-input` runs
- Shipped `openclaw@2026.7.1-2`: `dist/frontmatter-Co_01Uxb.js`, `dist/frontmatter-WnMmgZSx.js`,
  `dist/workspace-BgZV1_od.js`, `dist/curator-pEgKwBNc.js`, `dist/sessions-D8qGY7uC.js`, executed
- [Agent Skills — specification](https://agentskills.io/specification) and its reference
  implementation `skills-ref` 0.1.5, executed
- Antigravity `resources/bin/language_server.exe`, string analysis only
- Prior tickets: [`npx-skills-add.md`](./npx-skills-add.md),
  [`claude-plugin-format.md`](./claude-plugin-format.md),
  [`platform-install-targets.md`](./platform-install-targets.md),
  [`platform-skill-directory.md`](./platform-skill-directory.md),
  [`skill-directory-token-shells.md`](./skill-directory-token-shells.md)
