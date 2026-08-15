# Visualkan

Visualkan turns any content into a visual explanation: a whiteboard sketch, an infographic, a presentation slide, a technical diagram, a mind map, or a UI mockup. It installs into an AI coding assistant and generates images through that assistant or through an image generation API.

## Language

### The product

**Visualkan**:
The skill itself, and the name of this project. A fork of Eric Blue's `visual-explainer`, renamed because it diverges from upstream.
_Avoid_: visual-explainer, the command, the slash command

**Wizard**:
The guided selection of Controls. It is a second skill, `visualkan-wizard`, and the user starts it by name. It collects Controls and Content, then hands the run to Visualkan.
_Avoid_: menu, guide, setup, interview, assistant

**CLI**:
The npm package, taken as a whole. It has two parts, the Installer and the Runtime.
_Avoid_: the tool, the binary, the command line

**Installer**:
The npm bin, `visualkan.mjs`. It owns `install`, `uninstall`, `status`, and `sync-version`. It creates skill directories, so it never lives inside one.
_Avoid_: the CLI, the binary, the command, setup

**Runtime**:
`scripts/visualkan-run.mjs`. It owns every Control and image generation. Install copies it into `<skill>/scripts/`, and the Installer imports it so that one file serves both. See ADR 0006.
_Avoid_: the CLI, engine, executable, helper, the script

**Handoff Token**:
The literal line `VISUALKAN-WIZARD-RUN`. The Wizard prints it when it hands a run to Visualkan, and the confirmation step requires it. A token rather than a sentence, because the sentence did not survive.
_Avoid_: marker, flag, signal, sentinel

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

**Control**:
One of the settings that shapes a Visual Explanation. Style, Draw Level, Complexity, Device, and Mode are Controls. `visualkan controls` prints every Control with its legal values.
_Avoid_: option, flag, parameter, setting, argument

**Style**:
The visual language of a Visual Explanation. One of `whiteboard`, `infographic`, `presentation`, `diagram`, `mindmap`, `mindmap-structured`, or `mockup`.
_Avoid_: template, format, theme, look, visual style

**Draw Level**:
How hand-drawn or how precise a Visual Explanation appears. One of `sketch`, `normal`, or `polished`.
_Avoid_: fidelity, roughness, polish level, hand-drawn level

**Complexity**:
How many Sections a Visual Explanation contains. One of `simple`, `moderate`, or `detailed`.
_Avoid_: content density, depth, detail level

**Section Floor**:
The smallest number of Sections that a Complexity accepts. Three for `simple`, five for `moderate`, and eight for `detailed`. Content that cannot fill the Section Floor triggers Clarification.
_Avoid_: minimum sections, section count, threshold

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

**Clarification**:
The step that asks the user for missing Content. It runs when no Content exists, or when a Content Analysis cannot reach the Section Floor. It never runs because two Styles both fit.
_Avoid_: grilling, brainstorm, interrogation, follow-up questions

**Image Prompt**:
The detailed text that Visualkan sends to a Backend to produce one Frame. Built from a Content Analysis and a Style template.
_Avoid_: prompt, generation prompt, constructed prompt

**Backend**:
The source of image generation for a Frame. Either the host Platform's own capability (`native`) or an external API (`openai`, `gemini`, `openrouter`).
_Avoid_: provider, engine, image API, image generator

**Model**:
The named image generation model that a Backend runs.
_Avoid_: engine, generator, image model
