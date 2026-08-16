# Where Each Platform Actually Reads Skills From

Research for [issue #11](https://github.com/dapih/visualkan/issues/11). Corrects the `PLATFORMS`
registry in `visualkan.mjs`, and gives the manual-copy Channel a destination that works.

Investigated 2026-08-17 on Windows 11. Codex CLI 0.147.0, `gemini-cli-core` 0.55.1, `openclaw`
2026.7.1-2, Claude Code 2.1.229, Antigravity IDE (installed, GUI only).

Five of the six entries are right. One is wrong, and it is wrong in a way that hides itself.

## The corrected table

`global` is relative to the home directory. `project` is relative to a project root. Both columns
are in the registry's own notation, ready to paste.

| Platform | `global` | `project` | Verdict on the current entry | Evidence |
|---|---|---|---|---|
| Claude Code | `.claude/skills` | `.claude/skills` | **Correct.** Only location at each scope. | Vendor docs + observed |
| Antigravity | `.gemini/config/skills` | `.agents/skills` | **Correct.** | Vendor docs + observed layout |
| Gemini CLI | `.gemini/skills` | `.gemini/skills` | **Correct, but the weaker of two.** `.agents/skills` outranks it in both tiers. | Shipped source, executed |
| Codex CLI | `.codex/skills` | `.codex/skills` | **Correct.** OpenAI's public docs omit it; the shipped binary reads it. | Executed against shipped binary |
| Open Agent Standard | `.agents/skills` | `.agents/skills` | **Correct.** A convention, not a spec requirement. | Convention docs + executed on two platforms |
| OpenClaw | ~~`clawd/skills`~~ → **`.openclaw/skills`** | *(none — correct)* | **WRONG.** No OpenClaw version has ever read `~/clawd`. | Shipped source |

One line changes:

```js
  openclaw: {
    label: 'OpenClaw',
    global: ['.openclaw', 'skills'],
  },
```

## The OpenClaw entry is wrong, and it fabricated its own evidence

`~/clawd/skills` exists on this machine. That is why the entry looked plausible. It is not
OpenClaw's — **it is Visualkan's own artifact.**

Proved by running the Installer against a throwaway home:

```
$ USERPROFILE=<throwaway> node visualkan.mjs install openclaw
Installed visualkan v0.6.0 to <throwaway>\clawd\skills\visualkan\SKILL.md
$ USERPROFILE=<throwaway> node visualkan.mjs uninstall openclaw
Uninstalled visualkan from <throwaway>\clawd\skills\visualkan
$ find <throwaway>
<throwaway>/clawd
<throwaway>/clawd/skills          <- empty, and left behind
```

The real `~/clawd/skills` is empty, and `~/clawd` was created 32 seconds before it — exactly the
signature of one install followed by one uninstall. `rmSync` removes the skill folder and leaves
the two parents standing. Anyone checking whether `~/clawd` "looks real" finds a directory that
Visualkan created and Visualkan forgot.

OpenClaw is not installed on this machine at all: no `openclaw` or `clawd` on `PATH`, no npm
global package, nothing under `AppData`.

**`clawd` is not a legacy name either.** From the shipped package, `dist/config-utils-Cn9AD66v.js`:

```js
LEGACY_STATE_DIRNAMES = [".clawdbot"]
NEW_STATE_DIRNAME = ".openclaw"
```

The only `clawd` string anywhere in the bundle is a browser-profile subdirectory,
`<configDir>/browser/clawd`, which `openclaw doctor` offers to archive as residue. `~/clawd` was
never a skills root under any spelling.

### What OpenClaw actually reads

`dist/workspace-BgZV1_od.js` builds the roots and merges them into a `Map` keyed by skill name.
Merge order is last-wins, so reading the merge loop bottom-up gives precedence:

```js
for (const record of extraSkills)          mergeRecord(record);   // lowest
for (const record of bundledSkills)        mergeRecord(record);
for (const record of managedSkills)        mergeRecord(record);
for (const record of personalAgentsSkills) mergeRecord(record);
for (const record of projectAgentsSkills)  mergeRecord(record);
for (const record of workspaceSkills)      mergeRecord(record);   // highest
```

| Priority | Source | Path | Resolved default |
|---|---|---|---|
| 1 highest | Workspace | `<workspace>/skills` | `~/.openclaw/workspace/skills` |
| 2 | Project agent | `<workspace>/.agents/skills` | `~/.openclaw/workspace/.agents/skills` |
| 3 | Personal agent | `~/.agents/skills` | default state dir only |
| 4 | Managed / local | `<state-dir>/skills` | `~/.openclaw/skills` |
| 5 | Bundled | shipped with the install | — |
| 6 lowest | Extra | `skills.load.extraDirs` + plugin skills | — |

The defaults come from the same package:

```js
// resolveConfigDir — used for managedSkillsDir
return path.join(resolveRequiredHomeDir(env, homedir), ".openclaw");

// resolveDefaultAgentWorkspaceDir
if (profile && profile !== "default") return path.join(home, ".openclaw", `workspace-${profile}`);
return path.join(home, ".openclaw", "workspace");
```

The table matches the first-party documentation exactly, which also states the rule outright:

> OpenClaw loads from these sources, **highest precedence first**. When the same skill name
> appears in multiple places, the highest source wins.
>
> — [docs/tools/skills.md](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md)

### Which root the manual copy must target: `~/.openclaw/skills`

Three home-relative roots are available. `~/.openclaw/skills` is the one to use, for three
reasons:

1. **It matches Visualkan's "global" semantics.** OpenClaw's own CLI says so: *"`openclaw skills
   install` installs into the active workspace `skills/` directory by default. Add `--global` to
   install into the shared `~/.openclaw/skills` directory"* — visible to all local agents.
2. **The workspace path is not stable.** `resolveDefaultAgentWorkspaceDir` appends the profile:
   with `OPENCLAW_PROFILE=work` the workspace becomes `~/.openclaw/workspace-work`. A registry
   entry cannot know the profile. The managed root has no such partitioning.
3. **Multi-agent installs.** Each agent gets its own workspace, so a workspace install reaches one
   agent. The managed root reaches all of them.

`~/.openclaw/workspace/skills` is what the authoring guide tells a *human* to create
(`mkdir -p ~/.openclaw/workspace/skills/hello-world`), and it wins on precedence. It is the right
answer for a one-off hand install by someone who knows their own profile. It is the wrong answer
for a registry constant.

**Precedence consequence:** `~/.openclaw/skills` (4) sits *below* `~/.agents/skills` (3). A user
who installs both the `openclaw` and `agents` targets gets the `.agents` copy. Harmless — same
content — but `visualkan status` will report two installs where one is live.

**Caveat, inherent to a home-relative registry:** if `OPENCLAW_STATE_DIR` is set, the managed root
moves with it *and* `~/.agents/skills` is dropped from the index. Both home-relative options fail
together. Nothing the registry can do; worth a line in the README.

**UNVERIFIED: none of the OpenClaw behaviour was observed running.** OpenClaw is not installed
here, and installing a gateway to check a path is out of proportion. Everything above is read from
the shipped `openclaw@2026.7.1-2` bundle and first-party docs, which agree with each other.
Running `openclaw skills list` after dropping a marker skill into each root would settle it.

## Codex CLI: the registry is right and OpenAI's documentation is incomplete

The public docs page lists four roots and does not mention `~/.codex/skills`:

> Codex reads skills from repository, user, admin, and system locations. For repositories, Codex
> scans `.agents/skills` in every directory from your current working directory up to the
> repository root.
>
> — [learn.chatgpt.com/docs/build-skills](https://learn.chatgpt.com/docs/build-skills)

The shipped binary disagrees, and so does OpenAI's own shipped skill. From
`~/.codex/skills/.system/skill-installer/SKILL.md`:

> Installs into `$CODEX_HOME/skills/<skill-name>` (defaults to `~/.codex/skills`).

Codex populates that directory itself: `~/.codex/skills/.system/` holds `imagegen`, `openai-docs`,
`plugin-creator`, `review-agent`, `skill-creator`, `skill-installer`, and a
`.codex-system-skills.marker`. Strings in `codex.exe` carry
`${CODEX_HOME:-$HOME/.codex}/skills/...`.

### Verified by running

`codex debug prompt-input` renders the model-visible prompt as JSON without an API call, and the
skills catalog is in it. Run against a fixture with a throwaway `CODEX_HOME`, from
`<proj>/pkg/deep`:

| Probe skill planted at | Appeared in catalog |
|---|---|
| `$CODEX_HOME/skills/probe-codexhome` | **yes** |
| `<proj>/.codex/skills/probe-proj-dotcodex` | **yes** |
| `<proj>/.agents/skills/probe-proj-agents` | **yes** |
| `<proj>/pkg/.codex/skills/probe-mid-dotcodex` | **yes** |
| `<proj>/pkg/.agents/skills/probe-mid-agents` | **yes** |
| `<proj>/.claude/skills/probe-proj-dotclaude` | no |
| `~/.agents/skills/*` (real home) | **yes** |

So Codex reads `.codex/skills` *and* `.agents/skills`, in every directory from the cwd up to the
repository root, plus `$CODEX_HOME/skills` and `~/.agents/skills`. It ignores `.claude/skills`.
Codex also bootstrapped `.system` into the throwaway `CODEX_HOME` on first run, which is direct
confirmation that it owns that directory.

`/etc/codex/skills` could not be tested on Windows — **UNVERIFIED**, and irrelevant to a
home-relative registry.

### Precedence: there is none, and that is the hazard

Three copies of a skill named `collide`, in `$CODEX_HOME/skills`, `<proj>/.agents/skills`, and
`<proj>/.codex/skills`, produced **three catalog entries with the same bare name**:

```
- collide: COLLIDE from proj-dot-agents.   (file: <FIX>/proj/.agents/skills/collide/SKILL.md)
- collide: COLLIDE from proj-dot-codex.    (file: <FIX>/proj/.codex/skills/collide/SKILL.md)
- collide: COLLIDE from CODEX_HOME-skills. (file: <FIX>/codexhome/skills/collide/SKILL.md)
```

No shadowing, no namespacing, no warning. Codex is the only one of the six that duplicates instead
of resolving. **Install to exactly one Codex root.** The registry's choice of `.codex/skills` at
both scopes is fine and keeps Codex distinct from the `agents` target, so a user who runs both
does not end up with two `visualkan` entries competing for the model's attention.

## Gemini CLI: correct, and the weaker of two options

Verified by executing the shipped `@google/gemini-cli-core@0.55.1` discovery code against a
fixture. `packages/core/src/config/storage.ts` gives the four constants, and
`skills/skillManager.ts` gives the order:

```js
// 3.  User skills            ~/.gemini/skills
// 3.1 User agent alias       ~/.agents/skills
// 4.  Workspace skills       <ws>/.gemini/skills
// 4.1 Workspace agent alias  <ws>/.agents/skills
```

Ordered lowest to highest: builtin → extension → user `.gemini` → user `.agents` → workspace
`.gemini` → workspace `.agents`. Confirmed by running: a `collide` skill in all four resolved to
one winner at `<ws>/.agents/skills/collide/SKILL.md`. Unlike Codex, Gemini CLI keeps one skill per
name and emits a conflict warning.

The registry's `.gemini/skills` is correct at both scopes. It is the Gemini-only location, and it
loses to `.agents/skills` on a name clash — which is the desirable direction, since the `agents`
target is meant to be the cross-tool one.

**Trap worth documenting.** Workspace skills are skipped entirely when the folder is not trusted:

```js
if (!isTrusted) {
  debugLogger.debug('Workspace skills disabled because folder is not trusted.');
  return;
}
```

Confirmed by running with `isTrusted: false` — both workspace probes vanished and the `collide`
winner fell back to `~/.agents/skills`. A `--project` install on Gemini CLI silently does nothing
until the user trusts the folder. No error, no warning.

## Claude Code: correct, with the industry's precedence inverted

> | Personal   | `~/.claude/skills/<skill-name>/SKILL.md` | All your projects |
> | Project    | `.claude/skills/<skill-name>/SKILL.md`   | This project only |
>
> Across levels, enterprise overrides personal, and **personal overrides project.**
>
> — [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)

One location per scope, so the manual copy has no choice to make. The registry is right.

**Claude Code does not read `.agents/skills`.** Observed live: `postgres` and `find-skills` exist
in `~/.agents/skills` on this machine and in no `~/.claude/skills` folder, and neither appears in
this session's available-skills list, while every `~/.claude/skills` entry does.

**The precedence direction is a real upgrade hazard for Visualkan.** Every other platform here
puts project above personal, and the Agent Skills implementation guide calls project-over-user
"the universal convention across existing implementations". Claude Code goes the other way. So a
stale `~/.claude/skills/visualkan` from an older release **shadows** a fresh `--project` install,
and the user gets the old Runtime path with no indication why. `visualkan status` should say so.

Two more Claude Code behaviours the registry does not need but the README might:

- Project skills load from `.claude/skills/` in the start directory **and every parent up to the
  repository root**, plus `--add-dir` directories.
- Nested `.claude/skills/` below the start directory load lazily, under a directory-qualified name
  (`apps/web:deploy`), the first time Claude touches a file in that directory.

## Antigravity: correct, exactly as Google documents it

> Antigravity supports two types of skills: `<workspace-root>/.agents/skills/<skill-folder>/`
> [for] Workspace-specific and `~/.gemini/config/skills/<skill-folder>/` [for] Global.
>
> Note: Antigravity now defaults to `.agents/skills`, but still maintains backward support for
> `.agent/skills`.
>
> — [antigravity.google/docs/skills](https://antigravity.google/docs/skills)

Both registry values match. The legacy `.agent/skills` (no `s`) is read but should not be written
to.

Corroborated by the on-disk layout here: `~/.gemini/config/` is Antigravity's own config root,
holding `skills/`, `plugins/<plugin>/skills/`, `projects/`, and `config.json` — structurally
distinct from Gemini CLI's `~/.gemini/`, which holds `skills/` directly. Antigravity's bundled
skills sit separately at `~/.gemini/antigravity/builtin/skills/`.

Note that `~/.gemini/antigravity/skills/` — the global path `npx skills add` uses for its
`antigravity` slug, per [`npx-skills-add.md`](./npx-skills-add.md) — **does not exist on this
machine**, while `~/.gemini/config/skills/` does. Either that slug targets the separate
`antigravity-cli` product or it is simply wrong; the registry follows Google.

**UNVERIFIED: no live discovery run.** Antigravity is a GUI IDE with no headless skills command,
and the skill roots appear in neither `language_server.exe` nor `app.asar`, so discovery is
server-side or in a downloaded agent. Precedence between the two scopes is undocumented.
Installing a one-line probe skill at each scope and asking the agent to name its own directory
would settle both.

## Open Agent Standard: correct, but it is a convention, not a rule

The specification defines what goes *inside* a skill directory and says nothing about where that
directory lives. The location comes from the client-implementation guide instead:

> | Project | `<project>/.agents/skills/` | Cross-client interoperability |
> | User    | `~/.agents/skills/`         | Cross-client interoperability |
>
> The `.agents/skills/` paths have emerged as a widely-adopted convention for cross-client skill
> sharing. **While the Agent Skills specification does not mandate where skill directories live**
> (it only defines what goes inside them), scanning `.agents/skills/` means skills installed by
> other compliant clients are automatically visible to yours.
>
> — [agentskills.io/client-implementation/adding-skills-support](https://agentskills.io/client-implementation/adding-skills-support)

Both registry values match the convention, and the convention is load-bearing in practice: this
research confirmed by execution that Codex and Gemini CLI both read `~/.agents/skills` and
`<project>/.agents/skills`, and by source that OpenClaw does too. Antigravity reads
`<workspace>/.agents/skills` per Google's docs. Claude Code is the only one of the six that
ignores it.

The guide also states the collision rule the rest of the ecosystem follows, and which Claude Code
breaks:

> The universal convention across existing implementations: **project-level skills override
> user-level skills.**

## Precedence, all six at a glance

Answering the issue's fourth question: yes, it matters, and it is not uniform.

| Platform | Same name in two locations | Direction |
|---|---|---|
| Claude Code | One wins | enterprise > **personal > project** > bundled |
| Antigravity | **UNVERIFIED** | undocumented |
| Gemini CLI | One wins, warning emitted | workspace `.agents` > workspace `.gemini` > user `.agents` > user `.gemini` > extension > builtin |
| Codex CLI | **Both listed. No dedup.** | none — install to one root only |
| Open Agent Standard | Left to the implementation | recommends project > user |
| OpenClaw | One wins | workspace > project `.agents` > personal `.agents` > managed > bundled > extra |

## What this changes

1. **Fix `openclaw.global` to `['.openclaw', 'skills']`.** One line. Everything else in the
   registry stands.
2. **Delete `~/clawd`** on any machine that ran an older Visualkan. It is dead weight the
   Installer created, and it will keep confusing anyone who audits install targets.
3. **The README's manual-copy section can use the corrected table as-is.** Five of six paths are
   the same ones the Installer already writes.
4. Consider three warnings in `visualkan status` or the README:
   - Claude Code: a personal install shadows a project install.
   - Gemini CLI: a project install is inert until the folder is trusted.
   - Codex CLI: installing to both `.codex/skills` and `.agents/skills` yields two catalog entries.

## Reproducing this

```bash
# Codex: renders the model-visible prompt, no API call, no cost.
cd <fixture-project>/pkg/deep
CODEX_HOME=<throwaway> codex debug prompt-input | grep -o 'probe-[a-z-]*'

# Gemini CLI: run the shipped discovery code directly.
npm pack @google/gemini-cli-core@0.55.1 && tar -xzf *.tgz && cd package && npm i
USERPROFILE=<fixture-home> node -e "
  import('./dist/src/skills/skillManager.js').then(async ({SkillManager}) => {
    const {Storage} = await import('./dist/src/config/storage.js');
    const m = new SkillManager();
    await m.discoverSkills(new Storage('<fixture-ws>'), [], true);
    for (const s of m.getSkills()) console.log(s.name, s.location);
  })"

# OpenClaw: read the roots out of the shipped bundle.
npm pack openclaw@2026.7.1-2 && tar -xzf openclaw-*.tgz
grep -n 'agents-skills-personal\|openclaw-managed' package/dist/workspace-*.js

# The clawd artifact.
USERPROFILE=<throwaway> node visualkan.mjs install openclaw
USERPROFILE=<throwaway> node visualkan.mjs uninstall openclaw
find <throwaway>
```

Every fixture lived under `%TEMP%`. No real agent configuration directory was written to.

## Sources

Primary, in order of authority for each claim:

- Shipped `openclaw@2026.7.1-2`: `dist/workspace-BgZV1_od.js`, `dist/refresh-6Ptx4G_X.js`,
  `dist/config-utils-Cn9AD66v.js`
- [OpenClaw — Skills](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md) and
  [Creating skills](https://github.com/openclaw/openclaw/blob/main/docs/tools/creating-skills.md)
- Shipped `@openai/codex@0.147.0` binary strings, and observed `codex debug prompt-input` runs
- OpenAI's shipped `skill-installer` skill, `~/.codex/skills/.system/skill-installer/SKILL.md`
- [Codex — Build skills](https://learn.chatgpt.com/docs/build-skills) (incomplete; see above)
- Shipped `@google/gemini-cli-core@0.55.1`: `dist/src/skills/skillManager.js`,
  `dist/src/config/storage.js`, executed against a fixture
- [gemini-cli `docs/cli/skills.md`](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md)
- [Claude Code — Skills documentation](https://code.claude.com/docs/en/skills)
- [Antigravity — Skills](https://antigravity.google/docs/skills)
- [Agent Skills — specification](https://agentskills.io/specification) and
  [adding skills support](https://agentskills.io/client-implementation/adding-skills-support)
- Direct observation of installed platform directories on this machine, 2026-08-17
- Prior tickets: [`platform-skill-directory.md`](./platform-skill-directory.md),
  [`npx-skills-add.md`](./npx-skills-add.md)
