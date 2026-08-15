# The Runtime installs beside the skill, addressed by a path written at install time

A user installed Visualkan on ChatGPT desktop and it failed three times. The report is in `dev-ideas-and-brief/issues-1.md`. The failure that mattered was this: the platform could not resolve the `visualkan` command, even though the npm global bin directory was on the persisted Windows User PATH and held `visualkan`, `visualkan.cmd`, and `visualkan.ps1`. A spawned shell does not always inherit that PATH, and does not always apply `PATHEXT` to a `.cmd` shim.

The skill answered by telling the user to run `npm install -g @dapih/visualkan`. That advice cannot ever be right. `visualkan install` **is** that package, so any machine with a skill folder already has the package. The user reinstalled and hit the same wall.

Two facts decided the fix, and both were established by running rather than reading. `node` sits on the Machine PATH while the npm global bin sits only on the User PATH, so `node <path>` resolves in strictly more environments than `visualkan`. And `cmd.exe` does not expand `~`, while bash and PowerShell do, so no tilde shortcut is portable.

Visualkan therefore splits into two files. The **Installer** is the npm bin. It owns `install`, `uninstall`, `status`, and `sync-version`. The **Runtime** is `scripts/visualkan-run.mjs`. It owns every Control and image generation. `visualkan install` copies the Runtime into `<skill>/scripts/` and writes its resolved path into the skill body, replacing a `{{RUNTIME_PATH}}` placeholder.

The seam is a lifecycle, not a set of shared constants. The Installer creates skill folders, so it cannot live inside one. The Runtime must live inside one, so an agent can address it without a PATH lookup. We checked the coupling before splitting: the install commands reference neither `BACKENDS` nor `STYLES`, and the true shared surface is `UserError`, `parseArgs`, and about twenty lines besides.

The Installer imports the Runtime rather than duplicating it, so `visualkan controls` and `visualkan generate` keep working from the global command. One file, reached two ways, and the Control catalog exists once.

The written path branches on scope, decided from the `--project` flag at install time. Global scope receives an absolute path, because no project root exists to be relative to. Project scope receives a path relative to the project root, so a committed skill folder still works for a teammate whose home directory differs. This is not the run-time fallback chain that ADR 0004 rejects: it resolves to exactly one literal path per install, and nothing retries.

## Consequences

- An installed `SKILL.md` is no longer a byte-for-byte copy of the source. It is a template with one substitution. A skill folder moved by hand now breaks, where before it merely failed to be found. The test suite asserts that no `{{` survives substitution, and that every placeholder a body uses has a rule.
- Every written path uses forward slashes on every operating system. Verified by running: a quoted forward-slash absolute path containing a space works in bash, `cmd.exe`, and PowerShell alike, and a backslash does not survive all three.
- There are now two artifacts on disk with independent lifetimes. `npm install -g @dapih/visualkan@latest` updates the Installer but not a Runtime already copied into a skill folder. `visualkan status` reads each installed `metadata.json` and marks a mismatch `STALE`, because that number also dates the Runtime written beside it. Upgrading is two commands, and `RELEASING.md` says so.
- The "not found" message is correct for the first time. A missing Runtime at a known absolute path means the install is stale, so the instruction is `visualkan install <platform>`, never a reinstall of the package.
- Existing 0.4.1 installs keep working. The Installer still answers `generate` and `controls`, so a skill body that names the old command still runs until it is reinstalled.
- `native` is described by capability rather than by product name. Naming Antigravity and Codex taught the agent that no other platform qualifies, and only the agent can see whether a `generate_image` tool exists. `availableBackends` still never counts native, because this process cannot observe one, and a catalog that guesses is worse than a catalog that omits.
- The Wizard hands over with a literal Handoff Token, `VISUALKAN-WIZARD-RUN`, rather than a sentence. The prose contract crossing the two files did not survive its first real run, and the confirmation step never fired.
