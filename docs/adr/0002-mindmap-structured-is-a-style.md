# mindmap-structured is a Style, not a Draw Level

`mindmap` and `mindmap-structured` differ on the axis that Draw Level already covers: vibrant and organic against muted and professional. A reader will therefore propose that we delete the style and express it as `--style mindmap --draw-level polished`. We keep it as a separate Style because the DATA ELEMENTS block at `skill/visualkan.md:406-413` adds content that `mindmap` never produces at any Draw Level: priority badges, percentage indicators, status markers, count badges, and category labels. Draw Level controls how an element is rendered. It does not add elements.

## Consequences

- The two mindmap Styles must stay distinct in more than polish. If `mindmap-structured` ever becomes only a tidier `mindmap`, this justification fails and the fold into Draw Level becomes correct.
- The Style list stays at seven, and the Style and Draw Level axes stay independent.
- A fold is a breaking change. Users have `--style mindmap-structured` in saved commands and scripts, so any reversal needs a major version bump.
