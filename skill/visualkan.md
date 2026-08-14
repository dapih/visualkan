---
name: visualkan
description: Generate visual explanations (whiteboard, infographic, presentation, diagram, mindmap, mockup) from any content using native subscription capabilities (Antigravity/Codex) or image generation APIs (OpenAI, Gemini, OpenRouter). Use when the user wants to visualize, explain visually, create an infographic, draw a mind map, make a whiteboard sketch, or generate a UI wireframe/mockup of a topic.
argument-hint: "[--style whiteboard|infographic|presentation|diagram|mindmap|mindmap-structured|mockup] [--draw-level sketch|normal|polished] [--device mobile|desktop|tablet] [--complexity simple|moderate|detailed] [--backend native|openai|gemini|openrouter] [--model <model_name>] <content>"
allowed-tools: Bash, Read, Write, Glob, Grep
---

Generate a visual explanation (whiteboard, infographic, presentation, diagram, mindmap, or mockup) from content using native subscription capabilities (Antigravity/Codex) or image generation APIs.

## Usage

- `/visualkan Explain how DNS resolution works` — whiteboard style (default)
- `/visualkan --style infographic How machine learning models are trained`
- `/visualkan --style presentation The software development lifecycle`
- `/visualkan --style diagram --complexity detailed Kubernetes pod networking`
- `/visualkan --style mindmap The principles of object-oriented programming` — colorful radial mindmap
- `/visualkan --style mindmap-structured Project management methodologies` — clean, data-oriented XMind-style
- `/visualkan --style mockup A mobile app login screen with email, password, and social login` — polished UI wireframe
- `/visualkan --style mockup --device desktop An admin dashboard with sidebar navigation and data tables` — desktop wireframe
- `/visualkan --style mockup --draw-level sketch A settings page with toggles and dropdowns` — hand-drawn wireframe
- `/visualkan --draw-level sketch How the internet works` — rougher hand-drawn feel
- `/visualkan --draw-level polished --style whiteboard React component lifecycle`
- `/visualkan --style infographic --from mermaid` — convert a Mermaid diagram into a polished infographic
- `/visualkan --style whiteboard --from mermaid-file docs/architecture.mmd` — read a .mmd file and convert it
- `/visualkan --backend gemini How the water cycle works` — use Gemini/Nano Banana 2 instead of OpenAI
- `/visualkan --backend openrouter --model bytedance-seed/seedream-4.5 How async/await works` — use OpenRouter with SeeDream model
- `/visualkan --backend openrouter --model black-forest-labs/flux-1.1-pro Microservice communication` — use OpenRouter with Flux model

## Arguments

The argument string is available as `$ARGUMENTS`. Parse it according to these rules:

### Flags (all optional)

| Flag | Default | Description |
|------|---------|-------------|
| `--style S` | `whiteboard` | Visual style: `whiteboard`, `infographic`, `presentation`, `diagram`, `mindmap`, `mindmap-structured`, `mockup` |
| `--device D` | `mobile` | Device frame for mockup style: `mobile` (phone), `desktop` (browser window), `tablet` (iPad-style). Only used with `--style mockup`. |
| `--draw-level L` | `normal` | How hand-drawn vs polished: `sketch` (rough/playful), `normal` (balanced), `polished` (clean/professional) |
| `--complexity C` | `moderate` | Number of sections: `simple` (3-4), `moderate` (5-7), `detailed` (8-12) |
| `--size WxH` | style-dependent | Image dimensions. Defaults: whiteboard=`1536x1024`, infographic=`1024x1536`, presentation=`1536x1024`, diagram=`1024x1024`, mindmap=`1536x1024`, mindmap-structured=`1536x1024`, mockup=`1024x1536` (mobile/tablet) or `1536x1024` (desktop) |
| `--output DIR` | `./` | Output directory |
| `--prefix NAME` | `visualkan` | Filename prefix |
| `--mode M` | `single` | `single` (one image) or `multi-frame` (series of images building up the concept) |
| `--from F` | (none) | Input source: `mermaid` (inline Mermaid in content or clipboard), `mermaid-file PATH` (read from a .mmd/.md file) |
| `--backend B` | auto-detected | Image generation backend: `native` (built-in subscription for Antigravity/Codex via `generate_image`), `openai` (gpt-image-2), `gemini` (Nano Banana 2), or `openrouter` (OpenRouter API key). |
| `--model M` | `bytedance-seed/seedream-4.5` | **`--backend openrouter` only.** Model name to use. Supported: `bytedance-seed/seedream-4.5`, `black-forest-labs/flux-1-schnell`, `krea/krea-image`, `qwen/qwen-image`, `riverflow`, etc. Used with any other backend, this flag is an error (see ADR 0003). |

### Everything else is the content

After extracting flags, join the remaining text as the content to visualize.

## Steps

### Step 1: Validate input and choose the route

If no content is provided, go to Step 3 and run Clarification. Do not ask a single loose question here.

There are exactly two routes. Pick one and do not improvise a third.

**Native route.** If a `generate_image` tool exists in this environment, use it. Antigravity and Codex provide one, image generation is included in the subscription, and no API key, CLI, or shell command is needed.

**CLI route.** Otherwise, run `visualkan generate`. The CLI performs backend detection, API key validation, `--model` checking, size selection, the HTTP request, and writing the file.

Do NOT do any of the following yourself:

- Read or test `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `OPENROUTER_API_KEY`
- Decide which backend to use
- Call an image API with `curl`
- Parse a response with `jq`, or decode base64 by hand

If `visualkan` is not on PATH, stop and tell the user to run this:

```bash
npm install -g visualkan
```

The CLI prints the backend and model it selected to stderr before it calls the API. Pass that line through to the user.

### Step 1b: Detect and parse Mermaid input

If `--from mermaid` or `--from mermaid-file PATH` is specified, OR if the content contains Mermaid syntax (lines starting with `graph`, `flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `erDiagram`, `gantt`, `pie`, `mindmap`, `timeline`, or fenced in a ` ```mermaid ` block), treat the input as a Mermaid diagram and parse it.

**How to parse Mermaid input:**

If `--from mermaid-file PATH` is specified, read the file at PATH first using the Read tool.

If `--from mermaid` is specified without a file path, the content itself IS the Mermaid code (it may also appear inline in the content argument, or the user may have pasted it in a previous message — check the conversation context).

Parse the Mermaid syntax to extract the following structured data:

1. **Diagram Type**: What kind of Mermaid diagram is it? Map to the best visual style:

   | Mermaid Type | Suggested Style (if user didn't specify) |
   |---|---|
   | `flowchart` / `graph` | diagram or whiteboard |
   | `sequenceDiagram` | diagram or whiteboard |
   | `classDiagram` | diagram |
   | `stateDiagram` | diagram or whiteboard |
   | `erDiagram` | diagram |
   | `gantt` | infographic |
   | `pie` | infographic or presentation |
   | `mindmap` | mindmap or mindmap-structured |
   | `timeline` | infographic or whiteboard |

   If the user explicitly specified a `--style`, always use their choice — ANY Mermaid diagram type can be rendered in ANY visual style. The table above is only for auto-selection when no style is given.

2. **Nodes/Entities**: Extract every node with its:
   - ID (internal reference)
   - Display label (the human-readable text)
   - Shape hint (if the Mermaid syntax specifies one — e.g., `[rect]`, `(round)`, `{diamond}`, `[(cylinder)]`, `((circle))`)

3. **Connections/Edges**: Extract every connection with:
   - Source node → Target node
   - Arrow style (solid `-->`, dotted `-..->`, thick `==>`, bidirectional `<-->`)
   - Edge label (text on the arrow, if any)

4. **Subgraphs/Groups**: Extract any `subgraph` blocks as logical groupings with their title and contained nodes.

5. **Participants/Actors** (sequence diagrams): Extract participant names, aliases, and message flow.

6. **Attributes/Fields** (class/ER diagrams): Extract class names, methods, fields, relationships, cardinality.

7. **Timeline/Gantt data**: Extract dates, milestones, sections, task names, durations.

8. **Title**: If a `title` directive exists, use it. Otherwise, infer a title from the diagram content.

**CRITICAL**: Mermaid input gives you EXACT structure — use it. Every node becomes a labeled visual element. Every edge becomes an arrow or connection. Every subgraph becomes a visual grouping/container. This is MORE precise than free-text input, so the resulting prompts should be MORE detailed, not less.

After parsing, proceed to Step 2 using the extracted structure as the input for analysis. The Mermaid data pre-fills much of the analysis:
- Nodes → Sections
- Edges → Relationships (with exact labels)
- Subgraphs → Layout groupings
- You still need to add: Visual Metaphors, Color Coding, and style-specific decorative elements

### Step 2: Analyze the content

Before generating any image, you MUST deeply analyze the input content to extract structure. This is the most critical step — the quality of the visual depends entirely on this analysis.

Perform the following analysis and write it out explicitly:

1. **Core Concept**: What is the single main idea?
2. **Sections**: List 3-12 sections depending on complexity setting
3. **Relationships**: How do sections connect? (hierarchy, sequence, cause-effect, comparison, part-whole)
4. **Visual Metaphors**: What real-world objects or metaphors could represent each concept? (e.g., "security" → shield, "data flow" → pipeline/river, "scaling" → mountains/ladder)
5. **Layout Strategy**: How should sections be arranged spatially? (radial from center, left-to-right flow, top-to-bottom hierarchy, grid, timeline)
6. **Color Coding**: Assign a color theme to each major section for visual grouping

### Step 3: Clarification

Run this step when one of these two conditions is true. Skip it in every other case.

1. **No content exists.** Step 1 sent you here.
2. **Step 2 cannot reach the section floor.** `simple` needs 3 sections, `moderate` needs 5, and `detailed` needs 8. Run `visualkan controls` to confirm these numbers.

Content that cannot fill the floor forces you to invent sections. An invented section produces an image that looks confident and states nothing true. That is the failure this step prevents.

Do NOT run this step because two styles both fit. `whiteboard` is an acceptable default, and Step 4 lets the user change the style at no cost.

**How to ask:**

- Ask at most three questions.
- Send them in one message, numbered.
- Give each question a recommended answer that one word accepts.
- Never ask what the content already answers.

Ask about the gap you found, not about the flags. Good questions name the missing structure: which parts matter, who reads the result, what the reader must do next.

After the answers arrive, run Step 2 again with the new content. Then go to Step 4.

If the user declines to answer, lower the complexity to the highest level that the content supports. Say which level you chose and why. If the content cannot fill 3 sections, stop and say so.

### Step 4: Confirm the plan

Run this step when one of these two conditions is true. Skip it in every other case.

1. Step 3 ran.
2. The `visualkan-wizard` skill started this run.

A user who typed exact flags asked for an image, not a conversation. Never interrupt that user here.

State the plan in one block:

```
Style: [style]        Draw Level: [draw-level]    Complexity: [complexity]
Mode: [mode]          Backend: [as the CLI reports it]
Core Concept: [one sentence]
Sections: [numbered titles, no descriptions]
Cost: [one image, or N images for multi-frame]
```

Then stop and wait. Do not construct the image prompt. Do not call the image API. The user reads this block to find out what will appear before any money is spent.

If the user changes a control, apply the change and print the block again. If the user changes the content, run Step 2 again first.

### Step 5: Construct the image generation prompt

Build an extremely detailed prompt following the style-specific templates below. The prompt MUST be comprehensive — typically 400-800 words. Vague prompts produce generic results. Every visual element must be explicitly described.

**CRITICAL PROMPT ENGINEERING RULES:**
- Describe the EXACT layout with spatial positions (top-left, center, bottom-right, etc.)
- Specify EVERY icon, illustration, and decorative element
- Include exact text/labels that should appear in the image
- Describe colors using specific names (not just "colorful")
- Specify typography style (bold headers, handwritten labels, etc.)
- Describe connections between elements (arrows, dotted lines, flowing curves)
- Include background details and textures
- Specify the overall composition and visual flow (where the eye should travel)

---

## Style Templates

### WHITEBOARD Style

Use this template structure to build the prompt. Replace bracketed sections with content-specific details.

```
Create a stunning hand-drawn whiteboard visual explanation. The image should look like an expert educator spent hours crafting an engaging whiteboard illustration — vibrant, energetic, and visually rich.

CANVAS: A large whiteboard with [slight off-white texture / clean white surface based on draw-level]. [If sketch: visible whiteboard frame edges, slight marker smudges, eraser marks. If polished: pristine surface with subtle shadow at edges.]

TITLE: "[Title text]" written in large, bold [hand-lettered / marker-style] text across the top [center/left]. Use [color] for the title with [decorative underline / banner / box around it]. [If sketch: slightly uneven lettering with personality. If polished: confident, clean hand-lettering.]

LAYOUT: [Describe the spatial arrangement — e.g., "Radial layout with the core concept in the middle and 5 sections arranged around it like spokes of a wheel" or "Left-to-right flow with 4 stages connected by large curved arrows"]

SECTIONS:
[For each section, describe:]
- "[Section Title]" in [color] bold marker text [position]
- [Icon/illustration description — be VERY specific, e.g., "a hand-drawn brain with visible folds and small lightning bolts coming from it" not just "a brain icon"]
- Key points written in smaller [handwriting/print] text: "[exact text]"
- [Border style: colored rounded rectangle, cloud bubble, banner, torn paper effect, etc.]
- [Any annotations: stars, exclamation marks, arrows pointing to important parts]

CONNECTIONS:
[Describe every arrow, line, and visual connection between sections]
- [e.g., "A thick curved arrow in blue flows from Section 1 to Section 2 with the word 'triggers' written along it"]
- [e.g., "Dotted red lines connect the three related sections with small heart icons at the endpoints"]

DECORATIVE ELEMENTS:
[Scatter appropriate decorations throughout — these bring the whiteboard to life]
- Small doodles: [stars, lightbulbs, question marks, exclamation points, checkmarks, sparkles, small rockets, gears, clouds]
- Color splashes: [small colored dots, underline accents, highlighted keywords]
- Margin notes: [small speech bubbles with "Wow!", "Key!", "Remember this!", "Important!", etc.]
- [If sketch: more scattered doodles, playful elements, slight imperfections that feel human]
- [If polished: fewer but more carefully placed decorations, consistent spacing]

COLORS: Use a vibrant palette — [specify 4-6 exact colors, e.g., "cherry red, ocean blue, emerald green, sunshine yellow, deep purple, and tangerine orange for markers on the white background"]. Each section should have its own dominant color.

TYPOGRAPHY: All text should appear [hand-written with markers / carefully hand-lettered]. Headers in thick marker strokes (like Expo dry-erase markers). Body text in thinner pen-style writing. [If sketch: casual, slightly messy handwriting. If normal: confident educator handwriting. If polished: beautiful hand-lettering with consistent sizing.]

OVERALL FEEL: Energetic, educational, like walking into a classroom where the best teacher just finished an amazing visual lecture. The board should feel FULL but not cluttered — every element has purpose and the eye naturally flows through the content.
```

### INFOGRAPHIC Style

```
Create a [hand-drawn / clean / publication-quality] infographic. [If sketch: it should look like a talented designer worked out an infographic by hand in a notebook — every section still numbered, ordered, and readable, but drawn rather than typeset. If normal: it should look like a clear, well-organised infographic from a good article or an internal report. If polished: it should look like it was designed by a professional graphic designer for a premium educational publication — clean, structured, and visually sophisticated.]

CANVAS: [Portrait/landscape] format with a [color] background. [If sketch: visible paper grain, slightly uneven margins, the feel of a good notebook page. If normal: a flat, clean background. If polished: subtle gradient or textured background.]

HEADER: "[Title]" in large, bold [sans-serif / modern] typography at the top. [Subtitle if applicable] in lighter weight below. Use [color scheme] for the header area with [a decorative banner, geometric shape, or colored background block]. [If sketch: hand-lettered title above a drawn banner or a double underline. If polished: a precise typographic lockup with exact spacing.]

COLOR PALETTE: Use a sophisticated, cohesive palette — [specify exact scheme, e.g., "slate blue (#4A6FA5), warm taupe (#B8A898), olive green (#6B7F3B), charcoal (#3D3D3D), and cream (#F5F0E8) — inspired by modern editorial design"]. Use color consistently to group related sections. [If sketch: hold it to 3-4 colors, as if drawn with a few good pens.]

LAYOUT: [Describe the grid/flow structure — e.g., "Two-column layout with numbered sections flowing top-to-bottom. Left column covers theory, right column covers application. A central dividing line with decorative elements separates them."]

NUMBERED SECTIONS:
[For each section, describe:]
- Section number in a [colored circle / hexagon / badge] with [icon inside or beside it]. [If sketch: a hand-drawn circle with the number written inside it. If polished: an exact geometric badge.]
- "[Section Title]" in bold [font style], [color]
- [Icon/illustration — describe each one exactly]
- Content organized as: [bullet points / comparison table / flow arrows / stat callouts]
- [Specific data visualizations if applicable: bar charts, pie charts, simple graphs]
- [Visual container. If sketch: a drawn box with slightly uneven corners. If normal: a plain rounded rectangle. If polished: a rounded rectangle card with a subtle shadow, or a colored sidebar.]

ICONS AND ILLUSTRATIONS:
[Describe the visual style for all icons. Keep one style across the whole image.]
- Style: [If sketch: line illustrations with visible pen strokes, drawn by hand. If normal: simple flat-design icons. If polished: refined flat-design, isometric, or duotone icons — NOT hand-drawn.]
- [List specific icons for each concept with exact descriptions]
- Each icon should be [size] and use [color approach — monochrome with accent, full color, etc.]

FLOW AND CONNECTIONS:
- [Describe how sections connect visually — numbered progression, timeline, flowchart arrows]
- [Connector style. If sketch: drawn arrows with slight wobble and hand-written labels along them. If polished: precise thin lines, dotted paths, or thick arrows with set labels.]

DATA CALLOUTS:
- [Any statistics, key numbers, or highlight boxes]
- [e.g., "A large '6' in a teal circle with 'Key Determinants' written below in small caps"]
- [If sketch: the number written large by hand inside a drawn circle, with the label printed beneath it.]

FOOTER: [Attribution, source notes, or summary bar at the bottom]

TYPOGRAPHY:
- Headers: [If sketch: bold hand-lettering. Otherwise: bold sans-serif, e.g., Montserrat or Roboto style.]
- Body: [If sketch: neat, even handwriting or hand-printing. Otherwise: clean sans-serif, good readability.]
- Callouts: [Slightly larger, maybe italicized or in accent color]
- All text must be crisp and legible at every draw-level. A hand-drawn infographic is still an infographic, so it must stay readable

OVERALL FEEL: Clean, authoritative, and visually balanced. Information hierarchy is immediately clear — the viewer knows exactly where to start and how to navigate the content. White space is used intentionally. Nothing feels cramped or cluttered. [If sketch: like a well-kept notebook spread — made by hand, but organised with real rigour. If polished: like a premium educational poster you would see in a university, or a well-designed report.]
```

### PRESENTATION Style

```
Create a single, visually striking presentation slide that explains [topic]. This should look like a keynote slide from a world-class conference talk — bold, minimal, and impactful.

CANVAS: Widescreen (16:9) format. [Dark background with light text / Light background with dark text / Gradient background]. [Specify exact colors.] [If sketch: flat matte paper or a plain board surface, no gradients, slight texture. If normal: a clean solid field with one subtle accent shape. If polished: a precise gradient or deep solid with controlled vignetting.]

TITLE: "[Title]" in [large/extra-large] bold [modern sans-serif] text. Positioned [top-left / center-top]. [Color and styling details.] [If sketch: hand-lettered with a marker, slightly uneven baseline, drawn underline. If normal: clean sans-serif with a simple accent rule. If polished: tight tracking, optical alignment, exact optical sizing.]

VISUAL HIERARCHY: The slide should have ONE dominant visual element that immediately captures attention, supported by [2-4] secondary elements.

PRIMARY VISUAL:
[Describe the main illustration, diagram, or graphic — e.g., "A large circular diagram in the center showing the 4 stages of the process, with each quadrant in a different color and connected by curved arrows"]
[If sketch: draw it with visible marker strokes, hand-drawn arcs, and shapes that do not close perfectly. If normal: clean vector shapes with consistent stroke weight. If polished: exact geometry, aligned to an invisible grid, with refined shadow and depth.]

SUPPORTING ELEMENTS:
[For each supporting element:]
- [Position on slide]
- [Visual description]
- [Text labels]

KEY POINTS:
[2-5 key takeaways displayed as clean bullet points or visual callouts]
- [Exact text and position for each]
- [If sketch: hand-drawn bullet dots or ticks, text in marker handwriting. If normal: simple round bullets, clean sans-serif. If polished: custom bullet glyphs or numerals, precise baseline spacing.]

DESIGN DETAILS:
- [Subtle grid lines, geometric decorations, or accent shapes in background]
- [Icon style and placement]
- [Color accent usage]
- [If sketch: margin doodles, a hand-drawn frame edge, one or two arrows pointing at the primary visual. If normal: restrained geometric accents only. If polished: no decoration beyond deliberate negative space and one accent shape.]

TYPOGRAPHY: [Conference-quality — bold headers, clean body text, consistent sizing. Specify font style.]
[If sketch]: Hand-lettered throughout. Headers in thick marker strokes, body in a thinner pen. Confident but clearly drawn by hand.
[If normal]: Clean sans-serif (Helvetica or Inter style). Two weights only. All text horizontal and aligned.
[If polished]: Precise typographic scale with a clear ratio between levels. Tight tracking on headers, generous leading on body text.

OVERALL FEEL: TED-talk quality. Bold, confident, focused. Every element earns its place. High contrast and strong visual hierarchy. The key message is understood within 3 seconds of looking at it.
[If sketch]: Like a speaker sketched the slide on a tablet the night before. Energetic and human, still readable from the back row.
[If normal]: Like a well-built conference deck. Clean, professional, not fussy.
[If polished]: Like a keynote slide from a product launch. Impeccable alignment, deliberate whitespace, nothing accidental.
```

### MINDMAP Style

```
Create a vibrant, colorful mind map illustration. This should look like a beautifully hand-crafted mind map created by someone who loves visual thinking — organic, radial, bursting with color and personality.

CANVAS: [White / cream / light gray] background, landscape orientation. Clean but with subtle paper texture. [If sketch: visible paper grain, faint pencil guide marks, one or two smudges. If normal: light texture only. If polished: a pure flat field with no texture.]

DRAW LEVEL: This style stays vibrant and colorful at every draw level. The draw level changes only how the marks are executed, never the palette. Do NOT desaturate at the polished level — a muted, data-oriented mind map is the `mindmap-structured` style, not this one.

CENTER NODE: A large, eye-catching central element in the exact center of the image:
- Shape: [rounded rectangle / circle / cloud / organic blob] with a bold fill color (e.g., rich coral, deep teal, or vibrant purple)
- Text: "[Core Concept]" in large, bold white or dark text inside the shape
- [Optional: a small icon or illustration inside or beside the central node that represents the topic — e.g., a brain, a gear, a lightbulb]
- The center should feel like the "sun" of the map — everything radiates outward from it

MAIN BRANCHES: [4-8 depending on complexity] thick, organic, curved branches radiating outward from the center node like tree limbs. Each branch should:
- Be a DIFFERENT bold color (e.g., branch 1: cherry red, branch 2: ocean blue, branch 3: emerald green, branch 4: golden amber, branch 5: deep purple, branch 6: tangerine orange)
- Curve gracefully outward — NOT straight lines. Use smooth, flowing, slightly wavy curves
- Taper from thick (near center) to thinner as they extend outward
- End at a rounded rectangle or pill-shaped node containing the section title
- [If sketch: drawn with felt-tip markers, visible stroke texture, branches that wobble and vary in width. If normal: clean vector curves with smooth tapering. If polished: precise bezier curves with even taper and a soft drop shadow.]

BRANCH NODES (Level 1): At the end of each main branch:
- A rounded rectangle or pill shape filled with the SAME color as its branch (but slightly lighter tint)
- "[Section Title]" in bold text inside
- [Small relevant icon next to or inside the node — be specific about each icon]

SUB-BRANCHES (Level 2): From each Level 1 node, extend 2-4 thinner branches outward:
- Same color family as the parent branch but thinner lines
- End at smaller nodes or simple text labels
- Text: "[detail point]" — keep these short (2-5 words each)
- [Optional: tiny icons, checkmarks, or bullet dots at each endpoint]

SUB-BRANCHES (Level 3, if complexity is detailed): From some Level 2 nodes, extend even thinner branches:
- Finest lines, same color family
- Simple text labels, no boxes needed
- These are leaf-level details

DECORATIVE ELEMENTS:
- Small icons scattered near relevant branches: [specify icons per topic — gears, stars, arrows, hearts, lightbulbs, clouds, locks, etc.]
- Colorful dots or circles at branch connection points
- Subtle shadow or glow behind the central node
- [Optional: small doodles, emoji-style icons, or illustrative elements that make it feel alive]
- Curved connector lines (dotted, in gray) between related branches that aren't directly connected — with small labels explaining the cross-connection
- [If sketch: many scattered doodles, hand-drawn stars and arrows, deliberate imperfection. If normal: a moderate number of clean icons placed with intent. If polished: fewer icons, each precisely drawn and evenly spaced.]

COLORS: Use a vibrant, saturated palette — each main branch has its own distinct color. Colors should be bold and joyful: [specify 4-8 colors]. The overall impression should be a rainbow of organized knowledge.

TYPOGRAPHY:
- Central node: Large, bold [sans-serif or hand-lettered]
- Level 1 nodes: Medium bold text
- Level 2: Smaller regular text
- Level 3: Smallest text, still legible
- All text should be horizontal and easy to read (not rotated along branches)
- [If sketch: hand-lettered throughout, cheerful and uneven. If normal: a clean rounded sans-serif. If polished: a refined sans-serif with an exact size ratio between levels.]

OVERALL FEEL: Organic, radiant, visually stunning. Like a beautifully crafted mind map from a skilled visual thinker's notebook. The eye is drawn to the center and naturally follows branches outward. Balanced composition — branches fill the space evenly without crowding. Feels creative, energetic, and intellectually stimulating.
[If sketch]: Like a page torn from an enthusiast's notebook. Loose, joyful, obviously made by hand.
[If normal]: Like a mind map built in a good visual tool by someone with taste. Clean execution, full personality.
[If polished]: Like a printed poster of a mind map. Every curve exact, every colour deliberate, still bright and alive.
```

### MINDMAP-STRUCTURED Style

```
Create a clean, professional, data-oriented mind map in the style of XMind or MindMeister. This should look like a structured knowledge map from a business intelligence tool — organized, precise, and information-dense with minimal decorative elements.

CANVAS: Clean white or very light gray (#F8F9FA) background, landscape orientation. No texture — pure and minimal. [If sketch: a whiteboard or plain paper surface with faint texture. If normal or polished: no texture at all.]

DRAW LEVEL: The data elements and the muted palette are what define this style, and they are present at every draw level. The draw level changes only how the marks are executed. Do NOT drop the badges, counts, or status markers at the sketch level — a colorful mind map without data elements is the `mindmap` style, not this one.

CENTER NODE: A prominent but understated central element in the center:
- Shape: Rounded rectangle with subtle shadow or thin border
- Fill: Muted professional color (e.g., dark slate blue #2C3E50, charcoal #34495E, or dark teal #1A5276)
- Text: "[Core Concept]" in clean, white, bold sans-serif text
- Subtle drop shadow or thin 1px border — no glow, no decoration
- [Optional: a small monochrome icon to the left of the text]

MAIN BRANCHES: [4-8 depending on complexity] — these are clean, straight or gently curved lines:
- Use a MUTED, PROFESSIONAL color palette — not vibrant. Colors like: steel blue (#5B7B9A), sage green (#6B8E6B), warm gray (#8E8E7A), muted coral (#C27B6B), slate purple (#7B6B8E), dusty teal (#5B8E8E)
- [If sketch: drawn by hand with a fine marker, consistent intent but visibly hand-ruled, still straight rather than organic. If normal: clean and consistent width (2-3px), NOT organic or hand-drawn. If polished: exact 2px strokes with precise joins.]
- Lines connect from center node edge to Level 1 nodes with clean right-angle or gentle curve routing
- Use a structured layout: top branches go up-right and up-left, bottom branches go down-right and down-left — creating a balanced tree structure

BRANCH NODES (Level 1): Connected to the center:
- Rounded rectangles with thin colored border matching the branch color, white or very light fill
- "[Section Title]" in dark text, bold, clean sans-serif
- Consistent sizing across all Level 1 nodes
- [Optional: small monochrome or duotone icon (line-art style) to the left of text]

SUB-BRANCHES (Level 2): Extend from Level 1 nodes:
- Thinner lines (1-2px), same color as parent branch
- Connected to smaller nodes or inline text blocks
- Nodes: Smaller rounded rectangles or simple bordered pills
- Text: "[detail]" in regular weight, dark gray text
- Aligned neatly — sub-branches should be vertically stacked or fanned in an organized pattern, NOT randomly scattered

SUB-BRANCHES (Level 3, if complexity is detailed):
- Finest lines (1px), lighter shade of parent color
- Simple text labels with small bullet dots or dashes
- May use a simple table or list format within a container

DATA ELEMENTS (what makes this style distinct):
- [Where applicable, include small inline data representations:]
  - Small tag/badge elements: e.g., "[HIGH]" "[LOW]" priority badges in colored pills
  - Percentage indicators: small progress-bar style elements
  - Status markers: green checkmarks, yellow circles, red X marks
  - Count badges: small numbered circles showing "3 items", "5 types", etc.
  - Category labels: small muted pills like "[Core]" "[Advanced]" "[Optional]"
- These data elements should feel like metadata attached to nodes — compact and informative
- [If sketch: the badges and markers are hand-drawn — pills sketched by hand, checkmarks and bars drawn with a marker. They stay present and readable. If normal: clean vector pills and bars. If polished: pixel-exact badges with consistent corner radii and precise alignment.]

CROSS-CONNECTIONS:
- Thin dashed gray lines connecting related nodes across different branches
- Small text labels on these connections explaining the relationship
- Arrows showing direction of influence or dependency

LAYOUT RULES:
- Maintain strict visual hierarchy through size and weight, not color intensity
- Equal spacing between sibling nodes
- Branches should not overlap or cross each other
- White space is used generously — the map should breathe
- Overall structure should feel like a well-organized org chart or knowledge taxonomy

COLORS: Muted, desaturated, professional palette. Think corporate presentation, not children's art. [Specify 4-6 muted colors.] Use color primarily for branch differentiation, not decoration. Gray (#666) for all body text. Darker shade for headers.

TYPOGRAPHY:
- All text in clean sans-serif (Helvetica/Arial/Roboto style)
- Center: 18-20pt bold, white
- Level 1: 14pt bold, dark charcoal
- Level 2: 11-12pt regular, dark gray
- Level 3: 10pt regular, medium gray
- [If sketch: neat hand printing in place of the sans-serif, sized to the same hierarchy. Never script or decorative. If normal or polished: NO hand-drawn, script, or decorative fonts anywhere.]
- All text horizontal, left-aligned within nodes

OVERALL FEEL: Professional, structured, corporate-ready. Like a screenshot from XMind Pro or MindMeister in "business" theme. Information-dense but well-organized. Could be dropped into a board presentation or strategy document without modification. Clean lines, muted colors, clear hierarchy. The focus is on the DATA and RELATIONSHIPS, not visual flair.
[If sketch]: Like a planning session captured on a whiteboard by someone rigorous. Hand-drawn, but every badge and count is still there and still legible.
[If normal]: Like a screenshot from XMind Pro in its business theme.
[If polished]: Like a vector export from a business intelligence tool, ready to drop into a board pack at full resolution.
```

### DIAGRAM Style

```
Create a clear, precise technical diagram explaining [topic]. This should look like a professionally created technical illustration — accurate, well-labeled, and easy to follow.

CANVAS: Clean [white / light gray] background. [Specify dimensions context.] [If sketch: whiteboard or graph-paper surface with faint grid lines. If normal: flat white. If polished: flat white with a very subtle grid at low opacity.]

DRAW LEVEL: The diagram must stay accurate and unambiguous at every draw level. The draw level changes how the marks are executed, never how precise the information is. Labels stay legible and connections stay traceable even at the sketch level.

TITLE: "[Title]" in [position] using clean, professional [sans-serif] text in [color]. [If sketch: hand-lettered in marker, underlined by hand. If normal: clean sans-serif. If polished: precise sans-serif with exact optical alignment.]

DIAGRAM TYPE: [Flowchart / Architecture diagram / Sequence diagram / Mind map / Process flow / Comparison matrix / Hierarchy tree / Network topology]

NODES/ELEMENTS:
[For each node:]
- Shape: [rectangle / rounded rectangle / circle / diamond / hexagon / cylinder / cloud]
- Color: [specific color]
- Label: "[exact text]"
- Position: [where in the diagram]
- [Any internal details or sub-elements]
- [If sketch: shapes drawn by hand with a marker, corners that do not quite meet, slightly uneven fills. If normal: clean vector shapes with uniform 2px strokes. If polished: exact geometry, aligned to a grid, with consistent corner radii and subtle shadow.]

CONNECTIONS:
[For each connection:]
- From [node] to [node]
- Line style: [solid / dashed / dotted / thick / thin]
- Arrow: [one-way / bidirectional / none]
- Label: "[text on the connection]"
- Color: [specific color]
- [If sketch: hand-drawn lines with visible marker texture and arrowheads drawn as two quick strokes. Lines stay traceable from source to target. If normal: clean straight or orthogonal routing. If polished: precise routing with even spacing, rounded corners at bends, and uniform arrowheads.]

LEGEND/KEY: [If applicable, describe a legend box]

ANNOTATIONS:
- [Numbered callouts, notes, or labels outside the main diagram]

GROUPING:
- [Visual containers/boundaries that group related nodes — dashed rectangles, shaded regions, swim lanes]

TYPOGRAPHY: Clean, technical, highly legible. All labels crisp. Use consistent font sizing — larger for main nodes, smaller for connection labels.
[If sketch]: Neat hand printing in marker. Every label still crisp and readable. Never script or decorative.
[If normal]: Clean technical sans-serif at two or three consistent sizes.
[If polished]: Precise sans-serif with an exact size ratio between levels and consistent baseline alignment.

OVERALL FEEL: Engineering-quality documentation. Precise, unambiguous, and professionally typeset. Should look like it belongs in official technical documentation or an architecture review deck.
[If sketch]: Like an architecture sketched on a whiteboard during a design discussion. Rough marks, rigorous thinking, every box and arrow still correct.
[If normal]: Like a diagram from a well-maintained engineering wiki.
[If polished]: Like a figure from published technical documentation. Exact, typeset, ready to print.
```

### MOCKUP Style

The mockup style generates UI wireframes and mockups. It supports three device frames controlled by the `--device` flag: `mobile` (default), `desktop`, and `tablet`. The `--draw-level` controls fidelity: `sketch` produces hand-drawn wireframes, `normal` produces mid-fidelity wireframes, and `polished` produces clean Figma/Sketch-quality output.

```
Create a [draw-level-description] wireframe mockup of [content description]. [Draw-level feel description.]

BACKGROUND: Pure clean white (#FFFFFF). No texture, no gradients. [If sketch: subtle dot grid paper texture. If polished: completely clean white.]

DEVICE FRAME:
[If mobile]: A modern smartphone outline (rounded rectangle, iPhone proportions, thin bezels) centered on the canvas. Drawn with [sketch: hand-drawn dark gray marker lines | normal: clean medium-gray lines with subtle shadow | polished: precise medium-gray (#999999) lines with a refined drop shadow]. The phone includes a notch or dynamic island at top and subtle bottom home indicator.
[If desktop]: A browser window frame centered on the canvas with a top bar showing [sketch: hand-drawn circles for close/minimize/maximize, a rough URL bar | normal: clean window controls, a URL bar with "https://app.example.com" | polished: pixel-perfect Chrome/Safari-style window chrome with controls, tabs, and URL bar]. The window has [sketch: slightly uneven borders | normal/polished: clean rounded corners with subtle shadow].
[If tablet]: An iPad-style frame centered on the canvas (landscape or portrait based on content). Drawn with [sketch: hand-drawn lines | normal: clean lines | polished: precise lines with refined shadow]. Thin bezels, rounded corners, subtle home indicator.

All UI elements are rendered INSIDE the device frame.

SCREEN CONTENTS (top to bottom, with generous vertical spacing):
[For each UI element described in the content, specify:]

- **Navigation/Header**: [Describe nav bar, logo placement, menu items, hamburger icon, back arrow, etc.]
- **Input Fields**: [For each field:]
  - Small label above: "[Field Name]" in [dark gray semibold | hand-drawn] text, left-aligned
  - A [sketch: hand-drawn | normal: clean | polished: precise] rounded rectangle with [sketch: visible stroke | normal: 1.5px light gray border | polished: 1px #DDDDDD border] and white fill
  - Inside on the left: a small [relevant icon] in gray
  - Placeholder text: "[placeholder]" in light gray [sketch: handwriting | normal/polished: sans-serif]
- **Buttons**: [For each button:]
  - Primary buttons: [sketch: filled with diagonal hatching | normal: solid dark gray fill | polished: solid dark charcoal (#333333) fill] with [white text, centered, bold]
  - Secondary buttons: [sketch: outlined | normal: light gray fill with border | polished: #F5F5F5 fill with thin border]
- **Text Elements**: [Headlines, body text, links — describe each with exact text, size hierarchy, and color]
- **Lists/Tables**: [If applicable — describe rows, columns, alternating backgrounds]
- **Cards/Containers**: [If applicable — rounded rectangles with subtle shadows grouping related content]
- **Images/Media**: [Placeholder boxes with X through them and "[Image]" or "[Photo]" label — standard wireframe convention]
- **Toggle/Switch Controls**: [If applicable — simple toggle shapes in on/off state]
- **Tabs/Segmented Controls**: [If applicable — tab bar with active/inactive states]

SPACING AND LAYOUT:
- [Describe the grid system — single column for mobile, multi-column for desktop/tablet]
- Consistent padding between elements (16px feel for mobile, 24px for desktop)
- Clear visual hierarchy — larger elements for primary actions, smaller for secondary
- Content should feel appropriately dense for the device — mobile is single-column and scrollable, desktop uses the full width

ANNOTATIONS (outside the device frame, connected by thin arrows):
[If draw-level is sketch or normal:]
- Thin arrow lines (1px, gray #AAAAAA) pointing from annotation text to elements:
  - [Describe 3-5 key annotations calling out important UX decisions, component names, or specifications]
- [Optional: small specification notes like "48px height", "8px radius", "Primary CTA"]
[If draw-level is polished: minimal or no annotations — the wireframe speaks for itself]

COLORS:
[If sketch]: Primarily grayscale (black, dark gray, light gray). Light blue ONLY for interactive/link elements. Feels like marker on paper.
[If normal]: Grayscale with blue (#4A90D9) for interactive elements and light blue (#E8F0FE) for selected/active states. Clean and professional.
[If polished]: Refined grayscale palette. Dark charcoal (#333) for primary elements, medium gray (#888) for secondary text, light gray (#DDD) for borders, blue (#4A90D9) for interactive elements. Pixel-perfect and precise.

TYPOGRAPHY:
[If sketch]: Hand-drawn with fine-tip markers. Clean but slightly imperfect. Headers in thicker strokes, body text in thinner strokes.
[If normal]: Clean sans-serif throughout (Helvetica/SF Pro style). Professional typographic hierarchy. All text perfectly horizontal and aligned.
[If polished]: Crisp sans-serif with precise sizing. Headers bold, body regular weight. Perfect alignment and consistent spacing. Like a Figma export.

OVERALL FEEL:
[If sketch]: Like a page from a UX designer's sketchbook during a design sprint. Quick, conceptual, focused on layout and flow. Standard wireframe conventions (placeholder boxes, hatching for filled elements, annotation arrows).
[If normal]: Like a mid-fidelity wireframe from Balsamiq or Whimsical. Clean enough to share with stakeholders, rough enough to signal "this is not the final design."
[If polished]: Like a premium wireframe exported from Figma or Sketch. Impeccably clean. Elegant whitespace. Professional gray palette with blue accent. The kind of wireframe a senior UX designer would present in a design review. Pixel-perfect precision.
```

---

## Step 6: Handle multi-frame mode

If `--mode multi-frame` is specified:

1. Break the content into 3-5 progressive frames that build up the concept
2. Frame 1: Introduction — show the core concept and title
3. Frame 2-N-1: Progressive elaboration — add sections one at a time
4. Frame N: Complete picture with all elements and a summary
5. Generate each frame as a separate image, maintaining consistent style/layout
6. Each prompt should reference "this is frame X of Y in a series" for consistency

## Step 7: Generate the image(s)

### Native route

Invoke the environment's `generate_image` tool:

- **Prompt**: the constructed prompt
- **ImageName**: `<prefix>-<n>`
- **AspectRatio**: `3:2` for landscape, `2:3` for portrait, `1:1` for square

### CLI route

Write the prompt to a file first. Never pass the prompt as a command-line argument. A prompt contains double quotes, apostrophes, and newlines, and a shell will corrupt at least one of them.

1. Write the constructed prompt to a temporary file, for example `.visualkan-prompt.txt`, using the Write tool.
2. Run the CLI:

```bash
visualkan generate --prompt-file .visualkan-prompt.txt --style <style> --output <dir> --prefix <prefix>
```

3. Delete the temporary prompt file.

The CLI writes the saved image path to stdout, and the backend and model it selected to stderr.

Pass through each flag the user supplied:

| User flag | CLI flag |
|---|---|
| `--backend` | `--backend openai`, `gemini`, or `openrouter` |
| `--model` | `--model NAME` (openrouter only, the CLI rejects it elsewhere) |
| `--size` | `--size WxH` |
| `--device` | `--device mobile`, `desktop`, or `tablet` |
| `--output` | `--output DIR` |
| `--prefix` | `--prefix NAME` |

Always pass `--style`, because the CLI derives the default image size from it.

For `--mode multi-frame`, call the CLI once per frame with that frame's own prompt file. The CLI numbers the output files automatically, so keep `--output` and `--prefix` identical across the frames.

If the CLI exits with a non-zero status, show its message to the user unchanged. The message is written for them. Do not retry with a different backend, and do not fall back to `curl`.

## Step 8: Generate structured text companion

After generating the image, also output a structured text summary in this format:

```
## Visualkan: [Title]

**Style:** [style] | **Backend:** [as reported by the CLI, or "native" for `generate_image`] | **Draw Level:** [draw-level] | **Complexity:** [complexity]

### Sections
1. **[Section Title]** — [brief description]
2. **[Section Title]** — [brief description]
...

### Key Relationships
- [Concept A] → [Concept B]: [relationship]
...

### Image
Generated: [filepath]
```

## Step 9: Summary

Report to the user:
- The generated image path(s)
- The style and settings used
- A brief description of what's depicted
- Suggestions for refinement (e.g., "Try `--draw-level sketch` for a more casual feel" or "Try `--style infographic` for a more structured layout")

---

## Prompt Quality Checklist

Before sending any prompt to the image generator, verify it includes ALL of these:

- [ ] Explicit canvas/background description
- [ ] Title text and styling
- [ ] Spatial layout description (where things are positioned)
- [ ] 3-12 section descriptions with titles, icons, and text
- [ ] Specific icon/illustration descriptions (not generic — describe what each looks like)
- [ ] Connection/arrow descriptions between related elements
- [ ] Color palette with specific color names
- [ ] Typography/text style description
- [ ] Decorative elements appropriate to the style
- [ ] Overall mood/feel description
- [ ] At least 300 words of prompt detail

If any item is missing, add it before generating.

## Error Handling

The CLI owns every error about backends, API keys, and models. Its messages are written for the user, so show them unchanged and do not translate or summarise them. Your own error handling covers only these cases:

- If no content is provided, run Step 3
- If `visualkan` is not on PATH and no `generate_image` tool exists, tell the user to run `npm install -g visualkan`
- If the CLI exits non-zero, print its message and stop. Do not retry with another backend.
- If the content is too complex for the chosen complexity level, suggest upgrading to `detailed`
- If the content is too thin for the chosen complexity level, run Step 3. Never invent sections to fill the floor.

## Notes

- The prompt engineering is the primary value of this skill — spend time on analysis and prompt construction
- The same prompts work across every backend; the style templates are backend-agnostic
- The CLI already requests the highest quality each backend offers. Do not try to set quality yourself.
- For best results with text-heavy content, prefer `infographic` style
- For process/flow content, prefer `diagram` style
- For engaging/fun explanations, prefer `whiteboard` style
- For hierarchical/categorical content, prefer `mindmap` (colorful) or `mindmap-structured` (data-oriented)
- For UI wireframes and screen layouts, use `mockup` style with `--device` to select the frame type
- The `mockup` style is ideal for rapid wireframing from PRDs, brainstorming UI layouts, or visualizing modernized interfaces for existing code
- Use `mindmap` when the audience values visual appeal and creativity
- Use `mindmap-structured` when the audience values precision, data density, and professional presentation
- The `draw-level` parameter changes every style template. Its effect is strongest on `whiteboard`, `mockup`, `diagram`, and `presentation`. It is lightest on `infographic`, which is a polished format by definition.
- `mindmap` stays vibrant at every draw level, and `mindmap-structured` keeps its data elements at every draw level. Each template states this. The two styles differ by data elements, not by polish (see ADR 0002).
- Multi-frame mode costs more (one API call per frame) — warn the user about cost
- Estimated cost (OpenAI): ~$0.053 per image at medium quality, 1024x1024. High quality ~$0.211
- Estimated cost (Gemini): Free tier available; check current pricing at aistudio.google.com
