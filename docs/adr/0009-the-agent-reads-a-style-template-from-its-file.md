# The agent reads a Style Template from its file, and the delivery command is deleted

ADR 0007 moved the seven Style Templates out of the skill body and into `references/`. It then made the agent obtain one by running `template --style <name>`, rather than by reading a path. The reason was stated plainly: a prose contract that spans two skill files "did not survive its first real run", and a Style Template carries the same risk with a worse outcome, because an agent that skips one produces a weaker prompt instead of an error.

That ADR was equally plain that delivery is not the enforcement. It placed the real enforcement in the gate inside `generate`, which rejects a prompt that misses its `requires` sections or falls under 300 words.

The asymmetry ADR 0007 did not foresee is this. The `native` route never calls `generate`. A user on that route pays a mandatory Node dependency for delivery, and receives none of the enforcement that the dependency exists to pair with. The cost falls precisely on the users who otherwise need nothing installed.

While npm was the only Channel, that cost was invisible. Every user had Node, because `visualkan install` required it. Once three Channels place files without an install step, the same cost becomes the difference between a working copy-paste install and a broken one.

The alternatives were narrow. Shipping the templates inside the skill body again is what ADR 0007 removed, and it returns roughly 6,700 wasted tokens to every run. Keeping the command and accepting that the `native` route needs Node makes a whole Channel half-work, which the map rejected for every Channel. Adding a second route, a file read that falls back to the command, is the fallback chain ADR 0004 rejects.

So the agent reads `references/style-<name>.md` from its own skill directory, on every route. It reaches the file by the Anchor Sentence mechanism that [ADR 0008](0008-the-skill-body-anchors-its-own-paths.md) establishes, which is the same mechanism that reaches the Runtime. One rule serves both.

`template --style <name>` is then deleted. It has no caller left in either skill body, and a command with no caller is a code path the tests must cover for no benefit. `templatePath` and `readTemplate` survive as exported functions, because the test that checks each `requires` entry against its own template uses them. That test is about the templates, not about the command.

## Relationship to ADR 0007

Everything in ADR 0007 stands except delivery.

The templates are still seven files, one per Style, because a single file would force the Runtime to parse and locate a section by header. The file name still derives from the `STYLES` key, and a test still asserts that the two sets match. The `requires` list is still per-Style rather than shared. The gate inside `generate` is untouched, and it still rejects an inadmissible prompt before any money is spent. The token result is unchanged: one template of roughly 1,100 tokens loads per run, in place of seven totalling 7,847.

ADR 0007 chose a command over a file read to stop an agent from skipping the payload. This decision accepts that the choice bought less than it appeared to. Delivery was never the enforcement, by ADR 0007's own statement, and the route with no gate is the route that paid for it.

## Consequences

- An agent on the `native` route that skips the template file produces a weaker prompt, and nothing detects it. Nothing detected it before this decision either, because that route never reaches the gate. A file read is marginally easier to skip than a command, so the risk rises a little on the one route that cannot measure it. This is the cost, and it is the reason ADR 0007 chose otherwise.
- The `visualkan` skill needs no Node at all on the `native` route. A copy-paste install becomes a whole Channel rather than half of one.
- `template` leaves `USAGE` and `RUNTIME_USAGE`. Deleting a documented command is a public interface change, and it lands in a release that already carries a clean break.
- The templates must now be reachable by a path the agent can state. That is a stronger constraint than ADR 0007 imposed, because the Runtime no longer mediates. The `references/` directory moves inside `skills/visualkan/`, beside `scripts/`. The Runtime keeps its own resolution, because both directories move together.
- The Runtime is no longer required for a run on every route, but it stays required for `generate`. Two of the three things the Runtime once served are now files that the agent reads. Its remaining job is the one that must not move: the paid API call, and the gate in front of it.
- ADR 0007's rejection of the `graphify` pattern is narrowed rather than reversed. That pattern points an agent at a path for optional context. This decision points an agent at a path for the payload, and accepts the risk only because the alternative charges a Node dependency to users who get nothing back for it.
