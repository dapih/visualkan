# Visualkan

Visualkan turns any content into a visual explanation: a whiteboard sketch, an infographic, a presentation slide, a technical diagram, a mind map, or a UI mockup. It installs into an AI coding assistant and generates images through that assistant or through an image generation API.

## Language

### The product

**Visualkan**:
The skill itself, and the name of this project. A fork of Eric Blue's `visual-explainer`, renamed because it diverges from upstream.
_Avoid_: visual-explainer, the command, the slash command

**Platform**:
An AI coding assistant that can run Visualkan. For example Antigravity, Codex, Claude Code, Gemini CLI, or OpenClaw.
_Avoid_: host, client, agent, tool, IDE

**Scope**:
Where an installed copy of Visualkan applies. Global scope covers every project for one user. Project scope covers one project.
_Avoid_: install location, install level

### The output

**Visual Explanation**:
The image or images that Visualkan produces from Content. This is the product of a single run.
_Avoid_: visual, output, artwork, illustration, graphic

**Frame**:
One image within a Visual Explanation. A single-mode run produces one Frame. A multi-frame run produces three to five, and each Frame adds detail to the one before it.
_Avoid_: slide, panel, step, image

**Core Concept**:
The single main idea that a Visual Explanation communicates. Every Section supports it.
_Avoid_: central topic, main concept, theme, subject

**Section**:
One of the three to twelve units of content that a Visual Explanation covers. Complexity sets how many appear.
_Avoid_: concept, sub-topic, topic, block, node, branch

**Structured Summary**:
The text companion published alongside a Visual Explanation. It lists the Sections and the relationships between them.
_Avoid_: structured output, text summary, companion output

### The controls

**Style**:
The visual language of a Visual Explanation. One of `whiteboard`, `infographic`, `presentation`, `diagram`, `mindmap`, `mindmap-structured`, or `mockup`.
_Avoid_: template, format, theme, look, visual style

**Draw Level**:
How hand-drawn or how precise a Visual Explanation appears. One of `sketch`, `normal`, or `polished`.
_Avoid_: fidelity, roughness, polish level, hand-drawn level

**Complexity**:
How many Sections a Visual Explanation contains. One of `simple`, `moderate`, or `detailed`.
_Avoid_: content density, depth, detail level

**Device**:
The hardware frame drawn around a `mockup` Style Visual Explanation. One of `mobile`, `desktop`, or `tablet`.
_Avoid_: device frame, form factor, viewport, screen size

**Mode**:
Whether a run produces one Frame or a series. Either `single` or `multi-frame`.
_Avoid_: generation mode, run type

### The pipeline

**Content**:
The source material that a Visual Explanation explains. A topic, a document, a Mermaid diagram, or a codebase.
_Avoid_: input, source, material, subject, prompt

**Content Analysis**:
The written breakdown of Content into a Core Concept, Sections, relationships, visual metaphors, a layout strategy, and colors. It precedes every Image Prompt.
_Avoid_: analysis, extraction, breakdown, deep analysis

**Image Prompt**:
The detailed text that Visualkan sends to a Backend to produce one Frame. Built from a Content Analysis and a Style template.
_Avoid_: prompt, generation prompt, constructed prompt

**Backend**:
The source of image generation for a Frame. Either the host Platform's own capability (`native`) or an external API (`openai`, `gemini`, `openrouter`).
_Avoid_: provider, engine, image API, image generator

**Model**:
The named image generation model that a Backend runs.
_Avoid_: engine, generator, image model
