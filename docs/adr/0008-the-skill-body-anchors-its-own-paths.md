# The skill body anchors its own paths, and install rewrites them where a Platform gives none

ADR 0006 wrote the Runtime path into the skill body at install time, through a `{{RUNTIME_PATH}}` placeholder. That mechanism has one requirement: an install step. Three of the four Channels now in scope have none. `npx skills add` copies a body verbatim. A plugin ships the tree as committed. A manual copy is a copy. On all three the placeholder reaches the agent as literal text, and the first command fails. This was the deepest blocker on the map.

Research settled the ground by running rather than by reading. Five of six Platforms hand the agent its own skill directory. Every one of them does it as text substituted into the body, never as a shell variable. `CLAUDE_PLUGIN_ROOT` is empty in the shell the agent spawns. The agent is therefore the only party that can resolve a path, on every Channel.

Three alternatives were weighed and rejected:

- **Adopt a Platform token, such as `${CLAUDE_SKILL_DIR}`.** Two of the four tokens carry backslashes. Gemini CLI also appends a trailing separator, and OpenClaw hands over a raw backslash path. Claude Code and Codex normalize in code, silently, and neither documents it. A token trades a fault that a user can see for a fault that can change under us without notice.
- **Fork the skill body per Channel.** A second authored body is a second source of truth. The map already ruled that out for the `skills/` directory, and the same reason applies here.
- **Keep npm as the only Channel.** That is the problem this decision exists to solve.

So each authored body carries an **Anchor Sentence**. It states a path relative to the skill's own directory. It asks the agent to resolve that path against the directory the skill was loaded from, not against the current working directory, and to write it with forward slashes. Two sentences follow this rule: the Runtime path in the `visualkan` body, and the sibling path to `../visualkan/SKILL.md` in the Wizard body.

The mechanism was proven, not assumed. Three non-rewriting Channels, three first-try successes, each past a working decoy planted at the address a working-directory-anchored agent would have hit. No agent anchored on the working directory, and none searched. Six agent runs, and no image API was touched. The evidence is in `docs/research/agent-anchoring.md`.

The forward-slash clause is load-bearing. Claude Code states its skill directory with backslashes on Windows, on all three Channels. Every agent converted the path and quoted it, prompted by nothing except that clause. No Platform supplies the correct form. A later reader will see a Platform that already gives a path and judge the clause redundant. It is not.

ADR 0004's objection to prose does not apply here. Its example was policy that an agent can ignore while still succeeding. A wrong path cannot succeed, because `node` fails on the first command.

The Installer survives, demoted. It keeps `install`, `uninstall`, `status`, and `sync-version`, and it gains one job. At install time it rewrites the Anchor Sentence into a **Written Path**: one absolute path for global scope, or one project-relative path under `--project`.

That rewrite has two reasons, and the second is the more durable one. Open Agent Standard mandates relative paths and states no skill directory at all, so prose resolution fails there on every Channel. And a control run with the directory text removed did not fail. It degraded, from one deterministic command into a four-step filesystem search across seven candidate directories, disambiguated by reading file contents. It succeeded only because the fixture happened to sit under the working directory. That search is the fallback chain ADR 0004 rejects, invented by the agent rather than written by us. The rewrite is what prevents it.

The Installer finds the sentence by matching one exact literal line. No placeholder syntax is used, because three Channels ship the body unchanged and would deliver literal braces to the agent. A test asserts that the line appears exactly once in each authored body, so a reworded body fails the suite rather than shipping a body that install cannot rewrite.

## Relationship to ADR 0006

ADR 0006 stands on its foundation, and this decision supersedes only its mechanism.

What stands: the lifecycle seam between the Installer and the Runtime, the rule that the Installer creates skill folders and therefore cannot live inside one, the rule that the Runtime must live inside one, and the finding that `node` sits on the Machine PATH while the npm global bin sits only on the User PATH. The command an agent runs is still `node <absolute path>`, and never `visualkan`.

What is superseded: `{{RUNTIME_PATH}}` and `{{VISUALKAN_SKILL_PATH}}` are deleted from the authored bodies. Install-time substitution becomes a one-line rewrite that runs on one Channel, rather than the only way a body can become runnable.

**How this avoids the failure that produced ADR 0006.** That failure is recorded in `dev-ideas-and-brief/issues-1.md`. A user installed on ChatGPT desktop with `visualkan install agents`, and the Platform could not resolve the `visualkan` command, although the npm global bin directory was on the persisted Windows User PATH. The Platform in that report is Open Agent Standard, which is exactly the Platform that keeps the rewrite. That user receives a Written Path, byte-identical to what ADR 0006 produced. On the other three Channels the agent composes `node "<its own skill directory>/scripts/visualkan-run.mjs"`, which is still an absolute path handed to `node`. No Channel puts the Installer name into a command that an agent runs, so the failure mode cannot return.

**A correction to ADR 0006.** Its Consequences state that "a quoted forward-slash absolute path containing a space works in bash, `cmd.exe`, and PowerShell alike, and a backslash does not survive all three". The first half reproduces. The second half does not. A quoted backslash path with a space runs in bash, `cmd.exe`, PowerShell 5.1, and pwsh 7. Unquoted fails everywhere, in both slash forms, because of the space.

The rule ADR 0006 adopted is still right, for a reason it stated too strongly. The real hazards are positional. A backslash adjacent to the closing quote makes bash report `unexpected EOF`, and makes `cmd.exe` absorb the quote into the argument. A doubled backslash collapses in bash, because `\\` is an escape. Gemini CLI returns exactly the first shape, a path with a trailing separator, so the hazard is real. Forward slash has neither failure. `docs/research/skill-directory-token-shells.md` holds the full table.

## Consequences

- An installed `SKILL.md` is a byte-for-byte copy of the source on three Channels, and a one-line rewrite on the fourth. ADR 0006 recorded that a skill folder moved by hand breaks. That is now reversed, and moving a folder by hand is a supported Channel.
- The mechanism rests on model behaviour rather than on a Platform guarantee. Every behavioural result comes from one model, across six runs. The mitigation is that failure is loud: `node` exits 1 with `MODULE_NOT_FOUND` on the first command. State the limit and the mitigation together, and never present the mechanism as guaranteed.
- One qualification was recorded rather than hidden. The loudness result held, but the model reply showed that it had recognized the fixture. Node loudness is not in doubt. The refusal to substitute a nearby file was observed once, under conditions the model had spotted.
- **Open Agent Standard is supported on the npm Channel only.** A global-scope install on such a Platform, reached by any other Channel, is untested and expected to fail. The coverage table must state this explicitly, not by omission.
- **Codex behaviour is unobserved.** The mechanism is confirmed, because the `file:` locator emits forward slashes. No agent run happened there. It is the one missing cross-vendor observation, and the first release closes it.
- The test suite loses two invariants: that no `{{` survives substitution, and that every placeholder a body uses has a rule. It gains one: that the Anchor Sentence appears exactly once in each authored body.
- A `$` in a path segment breaks both slash forms, in bash and in PowerShell. `cmd.exe` offers no single-quote escape, so no one quoting style is safe in all three. Windows filenames can legally contain `$`. This hazard is latent on every Platform, and the slash decision cannot address it.
- The Installer is no longer the product. It is one Channel of four. `visualkan install` still works everywhere, and it stops being the thing a user must find first.
