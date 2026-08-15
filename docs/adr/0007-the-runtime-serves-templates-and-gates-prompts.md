# The Runtime serves the Style Templates, and gates the prompts built from them

`skill/visualkan.md` was 52 KB, roughly 13,030 tokens, and 60% of it was the seven Style Templates. Exactly one Style applies to any run, so about 6,700 tokens were loaded and discarded every time the skill fired. The wizard path was worse, because it reads both skill bodies.

The problem is waste, not size. "The file is big" has no standard to fail against — nothing in this repository states a token budget, and no reported failure traced to the length. Six of seven templates being unreachable on every run is a defect regardless of how large the context window happens to be.

Moving prose into reference files is an established pattern. `graphify` ships a 42 KB `SKILL.md` beside 44 KB of `references/`, and `claude-api` splits by language. Both point the agent at a path and ask it to read.

We rejected that shape here. Two days earlier, ADR 0006 recorded that a prose contract spanning two skill files "did not survive its first real run" — the Wizard was asked to state that it had started a run, it did not, and the confirmation step never fired. A Style Template carries the same risk with a worse outcome: an agent that skips it does not error, it produces a weaker prompt, and `AGENTS.md` states that the prompt engineering is the product. Unlike graphify's references, the template is not optional context. It is the payload.

So the templates move out as markdown files, but the agent obtains one by running `template --style <name>` rather than by reading a path. Delivery becomes a command, which is the pattern `controls` already proves in production. The Runtime resolves `references/` relative to itself, so no new placeholder is needed and ADR 0006's existing substitution carries the whole change.

Delivery alone is not enforcement, because an agent can still write a plausible prompt from general knowledge. The gate is at `generate`, the one place that must see the finished prompt. Each entry in `STYLES` gained a `requires` list naming the sections that Style's prompt must contain, and `generate` rejects a prompt that is missing them or shorter than 300 words — a floor the Prompt Quality Checklist already stated in prose. A skipped template now fails the run before any money is spent, instead of quietly costing four cents for a worse image.

## Consequences

- The CLI now rejects the agent's work product. ADR 0004 gave prompt construction to the agent, and this narrows that: the agent still writes the prompt, but the CLI decides whether it is admissible. "What a valid prompt must contain" is policy, which ADR 0004 already assigns to the CLI.
- `requires` is a per-Style list, not a shared one. Only `TYPOGRAPHY` and `OVERALL FEEL` appear in all seven templates, and `mockup` says `BACKGROUND` where the others say `CANVAS`, so a universal check would have been worth almost nothing. A test asserts that every required section actually appears in its own template, because a requirement absent from the template would reject every honest prompt.
- Seven files, not one. A single file would force the Runtime to parse and locate a section by header, which is a bug surface for no benefit. The file name derives from the `STYLES` key, and a test asserts the two sets match, so adding a Style without its template fails the suite.
- The Mermaid block stayed. It is about 810 tokens and also conditional, but nothing can gate a Mermaid parse — `generate` can check a prompt because it must see one, while a degraded parse has no detector. Trading 6% of the file for an invisible failure mode was the wrong side of the bargain this decision rests on.
- `install` now copies `references/` beside `scripts/`, and both are verified present in the package before any file is written. A missing template is reported as a stale install, with the same instruction as a missing Runtime.
- The gate can produce false rejections, and that is the real risk carried forward. It is bounded by keeping `requires` to sections the template actually names, and by the test that checks each one against its template. A style whose template is edited to rename a section will start rejecting prompts until `requires` follows.
- Result: `skill/visualkan.md` fell from about 13,030 tokens to about 5,159, and a run loads one template of roughly 1,100 instead of seven totalling 7,847.
