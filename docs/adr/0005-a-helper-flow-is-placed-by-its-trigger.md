# A helper flow is placed by its trigger

Three failures pushed us to add guidance. A user does not know the Controls and reads the documentation before every run. A user does not know what the image will look like until four cents are spent. A request arrives too thin for a Content Analysis, and the agent invents Sections to fill the Section Floor.

The obvious design gives each failure its own skill. We rejected that, because a Platform starts a skill in exactly two ways. The user names it, or the Platform matches the request against the skill description. Neither event happens in the middle of a run that a user already started. Skill-to-skill handoff is not a reliable primitive across Antigravity, Codex, Gemini CLI, Claude Code, Cursor, and Copilot. Two skills whose descriptions both describe visualizing also compete for the same request, and the match is a coin flip. A wrong flip sends a precise request into an interrogation.

Placement therefore follows the trigger, not the topic. A flow that must start without the user knowing that it exists lives inside `skill/visualkan.md` as a step. Clarification is that flow. A flow that the user starts by name lives in its own skill. The Wizard is that flow, and its description states that it applies only when the user names it.

## Consequences

- Clarification needs a test that a feeling cannot supply. The Section Floor is that test. `simple` needs three Sections, `moderate` needs five, and `detailed` needs eight. Content that cannot reach the floor triggers the step. Content that reaches it never does.
- Style ambiguity is deliberately not a trigger. `whiteboard` is an acceptable default, and the confirmation step already lets the user change the Style before any money is spent.
- The confirmation step runs only after Clarification, or when the Wizard started the run. A user who typed exact flags asked for an image, not a conversation.
- The Wizard carries no style template and no Image Prompt logic. It collects Controls and Content, then enters `skill/visualkan.md` at the analysis step. One copy of the templates stays the point, and a Wizard user with thin Content meets Clarification on the same path as everybody else.
- Both skills install together from one command. An optional install would mean that the user has to know that the Wizard exists, which is the failure the Wizard removes.
- Two skills mean two metadata files. `visualkan sync-version` writes each one, because a skill left behind ships a stale version that no test catches.
- A third failure mode is now possible: a Wizard description that drifts wide enough to match a plain visualize request. The description is load-bearing, and editing it carries the risk that the coin flip returns.
