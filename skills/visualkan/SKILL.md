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

**CLI route.** Otherwise, run the Runtime. It is at `scripts/visualkan-run.mjs`, inside this skill's own directory. Resolve that relative path against the directory this skill was loaded from, not against the current working directory, and write it with forward slashes:

```bash
node "<this skill's own directory>/scripts/visualkan-run.mjs" generate --prompt-file <file> ...
```

That path needs no PATH lookup and no particular working directory. Do not search for a `visualkan` command. The Runtime performs backend detection, API key validation, `--model` checking, size selection, the HTTP request, and writing the file.

Do NOT do any of the following yourself:

- Read or test `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `OPENROUTER_API_KEY`
- Decide which backend to use
- Call an image API with `curl`
- Parse a response with `jq`, or decode base64 by hand

If that file does not exist, the install is stale or incomplete. Stop and tell the user to run this:

```bash
visualkan install <platform>
```

The Runtime prints the backend and model it selected to stderr before it calls the API. Pass that line through to the user.

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

Perform the analysis defined in "Content Analysis: the mandatory breakdown" and write it out explicitly.

### Step 3: Clarification

Run this step when one of these two conditions is true. Skip it in every other case.

1. **No content exists.** Step 1 sent you here.
2. **Step 2 cannot reach the section floor.** `simple` needs 3 sections, `moderate` needs 5, and `detailed` needs 8.

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
2. The literal line `VISUALKAN-WIZARD-RUN` appears in this conversation. That is the Handoff Token, and the Wizard prints it when it hands over a run.

A user who typed exact flags asked for an image, not a conversation. Never interrupt that user here.

State the plan in one block:

```
Style: [style]        Draw Level: [draw-level]    Complexity: [complexity]
Mode: [mode]          Backend: [name, and why it won]
Core Concept: [one sentence]
Sections: [numbered titles, no descriptions]
Cost: [one image, or N images for multi-frame]
```

The Backend line must say why. Write `native (generate_image tool detected)` for the native route. For the CLI route, write what the Runtime reported plus the reason, for example `OpenRouter (no generate_image tool here; first key found)`. A user who expected their platform's own image generation must be able to see, in one line, that it was not available.

Then stop and wait. Do not construct the image prompt. Do not call the image API. The user reads this block to find out what will appear before any money is spent.

If the user changes a control, apply the change and print the block again. If the user changes the content, run Step 2 again first.

### Step 5: Construct the image generation prompt

Read the Style Template first, using the instructions in the next section, then build the prompt from it. The prompt MUST be comprehensive — typically 400-800 words. Vague prompts produce generic results. Every visual element must be explicitly described.

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

The seven Style Templates do not live in this file. Each one is a separate reference file inside this skill's `references/` directory.

Read `references/style-<style>.md` from this skill's own directory, using the Style you resolved in Step 1. Resolve that relative path against the directory this skill was loaded from, not against the current working directory, and write it with forward slashes:

```
<this skill's own directory>/references/style-<style>.md
```

Build the Image Prompt from the template you read. Do not write a prompt from memory, and do not invent a template. `generate` rejects a prompt that is missing the sections its Style requires, so a skipped template fails the run rather than producing a weaker image.

The template names every section the prompt must contain, and branches on `--draw-level`. Keep every branch you are given.

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
node "<path from Step 1>" generate --prompt-file .visualkan-prompt.txt --style <style> --output <dir> --prefix <prefix>
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
- If the Runtime file is missing and no `generate_image` tool exists, tell the user to run `visualkan install <platform>`. Never tell them to reinstall the npm package, because `visualkan install` is that package, so it is already present.
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

