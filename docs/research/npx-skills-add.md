# What `npx skills add` requires, and what it copies

Research for issue #3. Resolves the question of whether the `npx skills add` Channel can
deliver the Runtime and the style templates, or only the Markdown.

**Verdict: yes, it can deliver both — but not from the layout Visualkan ships today.**
The tool copies the entire subtree rooted at the directory containing `SKILL.md`.
Visualkan's `scripts/` and `references/` sit at the repository root, outside any such
directory, and its skill bodies are named `visualkan.md`, not `SKILL.md`. As shipped,
this Channel finds zero skills in `dapih/visualkan`.

## What was examined

| Source | What it is |
|---|---|
| `skills` on npm, version 1.5.22 | The package `npx skills` resolves to. `repository: git+https://github.com/vercel-labs/skills.git`, `description: "The open agent skills ecosystem"`, bins `skills` and `add-skill` → `bin/cli.mjs`. Read via `npm view skills@latest`. |
| `package/README.md` in the 1.5.22 tarball | First-party documentation. Cited below as **README**. |
| `package/dist/cli.mjs` in the 1.5.22 tarball | The shipped implementation, a single 7531-line bundle. Cited below as **cli.mjs:LINE**. |
| Observed runs | `npx skills@1.5.22 add ...` against scratch fixtures and against two live GitHub repos, on Windows 11, 2026-08-17. |

Local corroboration: `C:/Users/Davi Muammar/.claude/plugins/marketplaces/caveman` (a repo
distributed through this tool) and `C:/Users/Davi Muammar/.vscode/extensions/saoudrizwan.claude-dev-3.89.2/skills-lock.json`
(a lockfile recording `"skillPath": "skill/cline-sdk/SKILL.md"`).

Everything below is verified against the implementation, observed behaviour, or both.
Two items are labelled UNVERIFIED.

## The answer, bullet by bullet

### 1. Required repo layout

The unit of discovery is **a directory containing a file named exactly `SKILL.md`**.
The directory name is arbitrary; the filename is not.

`parseSkillMd` resolves `join(skillDir, "SKILL.md")` (cli.mjs:1126, cli.mjs:2474) and sets
the skill's path to `dirname(skillMdPath)` (cli.mjs:1082). `hasSkillMd` stats
`join(dir, "SKILL.md")` (cli.mjs:1043).

`discoverSkills` (cli.mjs:1103) searches in this order:

1. The search root itself, if it holds a `SKILL.md`. If found, discovery **returns immediately**
   and nothing else is searched, unless `--full-depth` is passed (cli.mjs:1131-1139).
2. A priority list of container directories, each walked to **depth 3**: `skills/`,
   `skills/.curated/`, `skills/.experimental/`, `skills/.system/`, plus every agent project
   directory (`.claude/skills/`, `.agents/skills/`, and roughly fifty more). The search root
   itself is walked to depth 1 only (cli.mjs:1141-1153, cli.mjs:1176).
3. Paths declared in `.claude-plugin/marketplace.json` or `.claude-plugin/plugin.json`, at their
   declared depth (README lines 450-468, cli.mjs:846-893).
4. **Fallback:** if steps 1-3 found nothing, a recursive walk to depth 5 (cli.mjs:1087, cli.mjs:1177).

**Nested category directories are allowed.** The depth-3 walk covers
`skills/<name>/SKILL.md`, `skills/<category>/<name>/SKILL.md`, and
`skills/<category>/<category>/<name>/SKILL.md` (README lines 379-386).

Observed: a fixture with `skills/visual/visualkan/SKILL.md` and `skills/a/b/deepskill/SKILL.md`
reported `Found 2 skills`.

The depth-5 fallback is why the Cline lockfile on this machine records `skill/cline-sdk/SKILL.md` —
`skill/` singular is not a container directory, so it is only reachable once the priority
search comes up empty.

### 2. Are sibling directories beside `SKILL.md` copied? — YES, the whole subtree

This is the load-bearing answer. Install calls `copyDirectory(skill.path, targetDir, agentType)`
(cli.mjs:2073, cli.mjs:2088, cli.mjs:2106), and `copyDirectory` (cli.mjs:2155-2176) recurses
through every entry:

```js
async function copyDirectory(src, dest, agentType) {
	await mkdir(dest, { recursive: true });
	const entries = await readdir(src, { withFileTypes: true });
	await Promise.all(entries.filter((entry) => !isExcluded$1(entry.name, entry.isDirectory())).map(async (entry) => {
		...
		if (entry.isDirectory()) await copyDirectory(srcPath, destPath, agentType);
		else ... await cp(srcPath, destPath, { dereference: true, recursive: true });
```

There is **no manifest and no file allowlist**. Everything under the skill directory is copied,
minus a small exclusion set (cli.mjs:2131-2136):

- Excluded file, by exact name: `metadata.json`
- Excluded directories: `.git`, `__pycache__`, `__pypackages__`

Symlinks are dereferenced. File mode is reapplied with `chmod(destPath, srcMode & 511)`
(cli.mjs:2171).

**The critical qualifier:** "sibling" means *inside the skill directory*, because the skill
directory is `dirname(SKILL.md)`. Directories that sit beside the skill directory, or at the
repository root, are **not** copied. Visualkan's `scripts/` and `references/` are at the
repository root today, so they fall outside every skill directory.

Observed, fixture `skills/visualkan/{SKILL.md, scripts/, references/}` installed with `--copy`:

```
.claude/skills/visualkan/SKILL.md
.claude/skills/visualkan/references/style-diagram.md          (all 7 style files arrived)
.claude/skills/visualkan/scripts/visualkan-run.mjs            (arrived, and runs)
.claude/skills/visualkan/visualkan.metadata.json              (arrived)
```

Observed on a real distributed repo — `npx skills add JuliusBrussee/caveman -s caveman-compress`
delivered all seven Python files from `skills/caveman-compress/scripts/`:

```
.claude/skills/caveman-compress/scripts/{__init__,__main__,benchmark,cli,compress,detect,validate}.py
```

That settles the caveman evidence the ticket pointed at: those scripts do arrive at the install
target.

**Corollary — a root `SKILL.md` copies the whole repository.** Observed with a fixture holding a
root `SKILL.md`: `node_modules/`, `test/`, `package.json`, and `README.md` were all copied into
`.claude/skills/rootskill/`. Only `.git` was dropped. This is a way to deliver the Runtime, but a
bad one.

### 3. Where the files land

Two install modes (README lines 102-109, cli.mjs:4715-4737):

- **copy** — an independent copy per agent directory. Selected by `--copy`, and **also selected
  automatically when the targets resolve to a single distinct directory** (`uniqueDirs.size <= 1`,
  cli.mjs:4737).
- **symlink** (default when two or more distinct agent directories are targeted) — one real copy
  at the canonical path `<scope>/.agents/skills/<name>` (cli.mjs:1970-1972), with each agent
  directory a symlink to it. On failure it falls back to copying (cli.mjs:2105-2114).

Observed, `-a claude-code -a cursor -y`:

```
.agents/skills/visualkan/                                  <- real files
.claude/skills/visualkan -> .../.agents/skills/visualkan   (symlink)
```

Scope (README lines 95-100): project is the default, rooted at the current directory; `-g` roots
at the home directory. A `skills-lock.json` is written at the project root.

Per-agent paths for Visualkan's six Platforms (README lines 248-318), against what Visualkan's
own Installer uses (`PLATFORMS` in `visualkan.mjs:47-76`):

| Visualkan Platform | `-a` slug | `npx skills` project | `npx skills` global | Installer project | Installer global |
|---|---|---|---|---|---|
| Claude Code | `claude-code` | `.claude/skills/` | `~/.claude/skills/` | `.claude/skills` | `~/.claude/skills` |
| Antigravity | `antigravity` | `.agents/skills/` | `~/.gemini/antigravity/skills/` | `.agents/skills` | `~/.gemini/config/skills` |
| Gemini CLI | `gemini-cli` | `.agents/skills/` | `~/.gemini/skills/` | `.gemini/skills` | `~/.gemini/skills` |
| Codex CLI | `codex` | `.agents/skills/` | `~/.codex/skills/` | `.codex/skills` | `~/.codex/skills` |
| Open Agent Standard | `universal` (also `amp`, `replit`) | `.agents/skills/` | `~/.config/agents/skills/` | `.agents/skills` | `~/.agents/skills` |
| OpenClaw | `openclaw` | `skills/` | `~/.openclaw/skills/` | (global only) | `~/clawd/skills` |

Only Claude Code agrees on both paths. The two Channels would install to different directories on
the other five, so `visualkan status` would not see a skill installed through `npx skills add`.

### 4. What `-a` accepts

A repeatable agent slug: `-a, --agent <agents...>`, and `--agent '*'` for all
(README lines 55, 87). The README table lists **76 distinct slugs**.

**All six of Visualkan's Platforms have a slug** — `claude-code`, `antigravity`, `gemini-cli`,
`codex`, `universal`, `openclaw`. There is also `antigravity-cli` as a separate target.

When no `-a` is given, the CLI auto-detects installed agents. Observed: running inside Claude Code
it printed `Agent detected — installing non-interactively`.

### 5. Is `metadata.json` read, ignored, or rejected?

**Neither read nor rejected — silently dropped from the copy.** A file named exactly
`metadata.json` is in `EXCLUDE_FILES` (cli.mjs:2131, and again at cli.mjs:6829 for the
`skills use` path). It is the *only* excluded filename. It is never parsed anywhere in the
bundle; `grep "metadata\.json"` matches only the two exclusion sets.

Version information is not read from a sidecar file at all. The only metadata the tool reads is
the `metadata:` map **inside the `SKILL.md` frontmatter**, and it reads exactly one key from it:
`metadata.internal: true` hides a skill unless `INSTALL_INTERNAL_SKILLS=1` (cli.mjs:1077-1078,
README lines 362-375).

**Good news for Visualkan:** its sidecars are named `visualkan.metadata.json` and
`visualkan-wizard.metadata.json`, not `metadata.json`, so they survive the copy. Observed —
in a fixture holding both, `metadata.json` was dropped and `visualkan.metadata.json` arrived.
The tool will not read the version from either, but it will not discard Visualkan's.

### 6. Frontmatter schema

Required, and nothing else (cli.mjs:1066-1076):

- `name` — must be present and a string
- `description` — must be present and a string

A `SKILL.md` missing either is skipped with a warning, not an error; the run continues and reports
`No valid skills found` only if nothing at all validated.

Everything else is **ignored by the tool and preserved verbatim in the copied file**. Observed:
`argument-hint` and `allowed-tools` came through the install byte-for-byte. The one exception is
the `eve` agent, which strips frontmatter down to `description`, `license`, and string-valued
`metadata` (cli.mjs:2142-2154) — irrelevant to Visualkan's six Platforms.

Note that `name` is passed through `sanitizeName` to form the install directory name
(cli.mjs:2047), so the directory is derived from the frontmatter `name`, not from the source
directory name.

Compatibility caveat from the README (lines 477-482): `allowed-tools` is honoured by Claude Code,
Codex, Cursor, Antigravity, Cline and others, but **not** by Kiro CLI or Zencoder.

### 7. A repository with two skills

All three behaviours exist, selected by flags (README lines 56, 59-60; cli.mjs:4715-4737):

- `-y` / non-interactive (including auto-detected-agent runs): **installs all skills**, no prompt.
  Observed — a two-skill fixture with no `-s` and `-y` installed both.
- Interactive with no flags: a multiselect prompt.
- `-s <name>` filters to named skills, repeatable; `-s '*'` selects all.
- `--all` is shorthand for all skills to all agents with no prompts.

Each skill installs into its own directory named after its frontmatter `name`. Two skills that both
need the Runtime would each need their own copy of it, since the copy is rooted at each skill's own
directory. `#<ref>@<skillname>` also filters to one skill (cli.mjs:120-136).

### 8. Does it pin a ref?

**No, not by default. It reads the default branch.**

`cloneRepo(url, ref)` runs `git clone --depth 1` and appends `--branch <ref>` **only when a ref was
supplied** (cli.mjs:772-780; the `gh repo clone` fallback does the same at cli.mjs:745-754). With no
ref, the clone takes the remote's HEAD, that is, the default branch.

A ref can be pinned explicitly, two ways:

- Fragment syntax: `npx skills add owner/repo#v1.2.3`, or `owner/repo#<ref>@<skill>` to also filter
  to one skill (cli.mjs:119-136).
- A GitHub tree URL: `https://github.com/owner/repo/tree/<ref>/<subpath>` (cli.mjs:190-200).

Whatever ref was used is written to `skills-lock.json` as `ref` (cli.mjs:4890) and reused by
`skills update`, which re-clones with the stored ref (cli.mjs:6707, cli.mjs:6717). With no ref
stored, `skills update` re-reads the default branch.

The lockfile's `computedHash` / `skillFolderHash` is a change-detection hash of the skill folder
(cli.mjs:3648-3654, cli.mjs:4874-4886), **not** a pin — nothing verifies it before installing.

Observed lockfile from a live GitHub install, with no `ref` key:

```json
{ "version": 1, "skills": { "caveman-compress": {
  "source": "JuliusBrussee/caveman", "sourceType": "github",
  "skillPath": "skills/caveman-compress/SKILL.md", "computedHash": "e4409b04..." } } }
```

**Consequence for `RELEASING.md`:** anyone running `npx skills add dapih/visualkan` gets whatever is
on `main` at that moment, not the last tagged release. Tags reach this Channel only if the install
instructions tell users to write `dapih/visualkan#v0.6.0`. Publishing a release does not, on its
own, change what this Channel serves — merging to `main` does.

## What blocks Visualkan today

Two independent blockers, both observed:

1. **The skill bodies are not named `SKILL.md`.** They are `skill/visualkan.md` and
   `skill/visualkan-wizard.md`. Discovery only ever stats `SKILL.md`.
2. **`scripts/` and `references/` are at the repository root**, outside any skill directory, so even
   a correctly named body would install without the Runtime or the templates.

Observed, against a fixture replicating the current layout:

```
$ npx skills@1.5.22 add <fixture-current> --list
No valid skills found. Skills require a SKILL.md with name and description.
```

Observed, against the live repository:

```
$ npx skills@1.5.22 add dapih/visualkan --list
No valid skills found. Skills require a SKILL.md with name and description.
```

## The layout that would work

```
skills/visualkan/SKILL.md
skills/visualkan/scripts/visualkan-run.mjs
skills/visualkan/references/style-diagram.md          (and the other six)
skills/visualkan-wizard/SKILL.md
```

This is exactly the shape the observed fixture used, and it delivered the Runtime and all seven
templates to `.claude/skills/visualkan/`.

Three consequences worth weighing before adopting it:

- **The Runtime lands where ADR 0006 already puts it.** ADR 0006 has the Installer copy the Runtime
  to `<skill>/scripts/` and write its path into the skill body. Under this Channel the Runtime lands
  at exactly `<skill>/scripts/visualkan-run.mjs`. But `npx skills add` copies the body **verbatim**
  and cannot rewrite anything into it, so the body must reach the Runtime by a path that is correct
  without rewriting — a relative one. An absolute path baked in at install time is not available
  through this Channel.
- **Duplication, or a second source of truth.** `skills/visualkan/scripts/` and
  `skills/visualkan/references/` would either duplicate the repo-root copies that `visualkan.mjs`
  and `npm` already use, or become the single location both Channels read from.
- **Two skills, two directories.** If the wizard ever needs the Runtime directly, it needs its own
  copy; a skill directory's copy is rooted at itself.

## Unverified

- **UNVERIFIED: executable bit preservation.** `copyDirectory` reapplies `srcMode & 511`
  (cli.mjs:2171), which should preserve `+x`. This could not be observed here: the Windows
  filesystem under test did not record the bit on the source fixture either, so both sides read
  `-rw-r--r--`. Confirm by running the same install on Linux or macOS and checking `ls -l` on the
  copied `scripts/` file. Low stakes for Visualkan, which invokes the Runtime as `node <path>`.
- **UNVERIFIED: `SKILL.md` filename case-sensitivity.** Discovery stats the literal string
  `SKILL.md` (cli.mjs:1043), so a file named `skill.md` would match on a case-insensitive
  filesystem (Windows, default macOS) and miss on Linux. Not tested. Confirm on a case-sensitive
  filesystem. Visualkan should use the exact spelling regardless.

## Reproducing this

```bash
npm pack skills@1.5.22 && tar -xzf skills-1.5.22.tgz   # README.md and dist/cli.mjs
cd <throwaway-dir>
npx skills@1.5.22 add <path-or-owner/repo> --list
npx skills@1.5.22 add <path-or-owner/repo> -s '*' -a claude-code -y --copy
```

Run it from a throwaway directory and never pass `-g`; project scope writes only under the current
directory, while `-g` writes into real agent configuration directories.
