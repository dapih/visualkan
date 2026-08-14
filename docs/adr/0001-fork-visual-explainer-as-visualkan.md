# Fork visual-explainer as Visualkan

Visualkan began as a copy of Eric Blue's `visual-explainer` skill, which is MIT licensed. We renamed the skill, the slash command, and the documentation to Visualkan because we intend to diverge from upstream rather than track it. A reader who compares the two projects will otherwise assume that this repository is a mirror and that upstream changes flow in.

## Consequences

- The MIT license requires attribution. Keep the Eric Blue copyright notice in `LICENSE`. Removal breaches the license, even after the rename.
- Upstream fixes do not arrive automatically. Port anything we want by hand.
- Version numbers now belong to Visualkan. Do not align them with upstream releases.
- The name `visual-explainer` stays where it states a fact. That means the commit history, this file, `LICENSE`, README Credits, the upstream release history, and the `CONTEXT.md` entry that lists it as a name to avoid. The rename applies to the product, not to the record of where the product came from. Rewriting those commit messages was considered on 2026-08-14 and rejected: the root commit really did add upstream's skill, the rename commit needs the old name to mean anything, and the edit would force-push over three published tags.
