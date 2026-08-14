# Visualkan

A cross-platform AI skill that converts any content into stunning visual explanations — whiteboard sketches, professional infographics, presentation slides, technical diagrams, mind maps, and UI wireframe mockups — supporting Antigravity, Codex, Claude Code, and OpenClaw, powered by Native Subscriptions (Antigravity/Codex), OpenAI (gpt-image-2), Google Gemini (Nano Banana 2), or OpenRouter (SeeDream, Flux, Krea, RiverFlow, QwenImage, etc.).

## About

AI-generated visual explanations have exploded in popularity — tools like NotebookLM and Gemini can turn documents into polished infographics and whiteboard sketches. But these tools are closed ecosystems. You can't customize the output style, integrate them into your dev workflow, or control the prompts that drive the generation.

**Visualkan** brings this capability directly into your AI coding assistant (Antigravity, Codex, Claude Code, or OpenClaw) as a skill. It takes any content — a topic, a document, meeting notes, a codebase — and transforms it into a rich visual explanation.

The core insight is that image generation quality depends almost entirely on prompt quality. Visualkan uses deeply structured, 400-800 word prompts with explicit spatial layout, icon descriptions, color palettes, typography, and connections — producing results that rival or exceed what dedicated visual AI tools generate.

### Design Principles

- **Style Spectrum** — From rough whiteboard sketches to polished infographics, with a `--draw-level` parameter to control exactly where on the hand-drawn-to-professional spectrum the output lands
- **Deep Content Analysis** — Every generation starts with structured extraction of the core concept, sections, relationships, visual metaphors, and layout strategy before any prompt is written
- **Prompt Engineering as the Product** — The skill's value is in its style-specific prompt templates, not just API wrappers. Each style (whiteboard, infographic, presentation, diagram, mindmap, mindmap-structured, mockup) has a comprehensive template tuned for that visual language
- **Composable with Documents** — Works naturally with your AI assistant's ability to read files, so you can point it at any existing doc, spec, or codebase and generate visuals from it

### Credits

Visualkan is a fork of the `visual-explainer` skill by [Eric Blue](https://about.ericblue.com) ([GitHub](https://github.com/ericblue)). It is used under the MIT license. See [LICENSE](LICENSE) for the original copyright notice, and [ADR 0001](docs/adr/0001-fork-visual-explainer-as-visualkan.md) for why this project forked.

Visualkan restarted its version numbering at 0.1.0. Releases numbered 1.0.0 through 1.4.0 belong to `visual-explainer`. They are listed under [Upstream Release History](#upstream-release-history).

## Prerequisites

### 1. AI Assistant Platform

Compatible with:
- **[Google Antigravity](https://antigravity.google)**
- **[Gemini CLI](https://gemini.google)**
- **[OpenAI Codex CLI](https://openai.com)**
- **[Claude Code](https://claude.ai/code)**
- **[OpenClaw](https://github.com/ericblue/openclaw)**
- **Open Agent Standard (agentskills.io) platforms**:
  - ChatGPT desktop (including Codex desktop)
  - Cursor
  - OpenCode
  - GitHub Copilot (in VS Code)
  - Windsurf
  - Roo Code
  - Trae

### 2. Image Generation Backend

#### Option A: Native Subscription (Antigravity & Codex) — No API Key Required!
If you use **Antigravity** or **Codex**, image generation capabilities (via Nano Banana or gpt-image models) are **included in your subscription plan**. No external API key is needed.

#### Option B: OpenAI API (gpt-image-2)
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a key and set it:
```bash
export OPENAI_API_KEY="sk-..."
```

#### Option C: Google Gemini API (Nano Banana 2)
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Create an API key and set it:
```bash
export GEMINI_API_KEY="AIza..."
```

#### Option D: OpenRouter API (SeeDream, Flux, Krea, RiverFlow, QwenImage, etc.)
If you are a non-Antigravity / non-Codex user, or if you want to use alternative image generation models provided by OpenRouter:
1. Go to [openrouter.ai/keys](https://openrouter.ai/keys)
2. Create an API key and set it:
```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```
Then run with `--backend openrouter` and optional `--model` flag (default: `--model bytedance-seed/seedream-4.5`; supported: `--model bytedance-seed/seedream-4.5`, `--model black-forest-labs/flux-1-schnell`, `--model krea/krea-image`, `--model qwen/qwen-image`, etc.).

#### Persist across sessions

Add your key(s) to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="AIza..."
export OPENROUTER_API_KEY="sk-or-v1-..."
```

### 3. jq

The skill uses `jq` to parse JSON responses from image generation APIs:

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

## Compatibility

This skill supports any Skills-compatible agent or CLI tool that supports markdown skill definitions, including:

- **Google Antigravity** (supported — native subscription image generation)
- **Gemini CLI** (supported — API keys or OpenRouter)
- **OpenAI Codex CLI** (supported — native subscription image generation)
- **Claude Code** (supported — API keys or OpenRouter)
- **OpenClaw** (supported — API keys or OpenRouter)
- **Open Agent Standard (agentskills.io)** (supported — Cursor, GitHub Copilot, ChatGPT desktop, OpenCode, Windsurf, Roo Code, Trae)

## Installation

### 1. Google Antigravity

- **Global scope**: `~/.gemini/config/skills/` (macOS/Linux) or `%USERPROFILE%\.gemini\config\skills\` (Windows)
  ```bash
  make antigravity-install
  ```
- **Project scope**: `<project-root>/.agents/skills/`
  - **Makefile**:
    ```bash
    make project-install PROJECT_DIR=/absolute/path/to/your-project
    ```
  - **Manual copy**:
    ```bash
    # macOS / Linux
    mkdir -p /path/to/your-project/.agents/skills/visualkan
    cp skill/visualkan.md /path/to/your-project/.agents/skills/visualkan/SKILL.md
    cp skill/metadata.json /path/to/your-project/.agents/skills/visualkan/metadata.json

    # Windows (PowerShell)
    New-Item -ItemType Directory -Force -Path "C:\path\to\your-project\.agents\skills\visualkan"
    Copy-Item skill\visualkan.md "C:\path\to\your-project\.agents\skills\visualkan\SKILL.md"
    Copy-Item skill\metadata.json "C:\path\to\your-project\.agents\skills\visualkan\metadata.json"
    ```

### 2. Gemini CLI

- **Global scope**: `~/.gemini/skills/` (macOS/Linux) or `%USERPROFILE%\.gemini\skills\` (Windows)
  ```bash
  make gemini-install
  ```
- **Project scope**: `<project-root>/.gemini/skills/`
  - **Makefile**:
    ```bash
    make gemini-project-install PROJECT_DIR=/absolute/path/to/your-project
    ```
  - **Manual copy**:
    ```bash
    # macOS / Linux
    mkdir -p /path/to/your-project/.gemini/skills/visualkan
    cp skill/visualkan.md /path/to/your-project/.gemini/skills/visualkan/SKILL.md
    cp skill/metadata.json /path/to/your-project/.gemini/skills/visualkan/metadata.json

    # Windows (PowerShell)
    New-Item -ItemType Directory -Force -Path "C:\path\to\your-project\.gemini\skills\visualkan"
    Copy-Item skill\visualkan.md "C:\path\to\your-project\.gemini\skills\visualkan\SKILL.md"
    Copy-Item skill\metadata.json "C:\path\to\your-project\.gemini\skills\visualkan\metadata.json"
    ```

### 3. Codex CLI

- **Global scope**: `~/.codex/skills/` (macOS/Linux) or `%USERPROFILE%\.codex\skills\` (Windows)
  ```bash
  make codex-install
  ```
- **Project scope**: `<project-root>/.codex/skills/`
  - **Makefile**:
    ```bash
    make codex-project-install PROJECT_DIR=/absolute/path/to/your-project
    ```
  - **Manual copy**:
    ```bash
    # macOS / Linux
    mkdir -p /path/to/your-project/.codex/skills/visualkan
    cp skill/visualkan.md /path/to/your-project/.codex/skills/visualkan/SKILL.md
    cp skill/metadata.json /path/to/your-project/.codex/skills/visualkan/metadata.json

    # Windows (PowerShell)
    New-Item -ItemType Directory -Force -Path "C:\path\to\your-project\.codex\skills\visualkan"
    Copy-Item skill\visualkan.md "C:\path\to\your-project\.codex\skills\visualkan\SKILL.md"
    Copy-Item skill\metadata.json "C:\path\to\your-project\.codex\skills\visualkan\metadata.json"
    ```

### 4. Open Agent Standard (agentskills.io)
*Supported by: ChatGPT desktop (including Codex desktop), Cursor, OpenCode, GitHub Copilot (in VS Code), Windsurf, Roo Code, Trae*

- **Global scope**: `~/.agents/skills/` (macOS/Linux) or `%USERPROFILE%\.agents\skills\` (Windows)
  ```bash
  make agents-install
  ```
- **Project scope**: `<project-root>/.agents/skills/`
  - **Makefile**:
    ```bash
    make project-install PROJECT_DIR=/absolute/path/to/your-project
    ```
  - **Manual copy**:
    ```bash
    # macOS / Linux
    mkdir -p /path/to/your-project/.agents/skills/visualkan
    cp skill/visualkan.md /path/to/your-project/.agents/skills/visualkan/SKILL.md
    cp skill/metadata.json /path/to/your-project/.agents/skills/visualkan/metadata.json

    # Windows (PowerShell)
    New-Item -ItemType Directory -Force -Path "C:\path\to\your-project\.agents\skills\visualkan"
    Copy-Item skill\visualkan.md "C:\path\to\your-project\.agents\skills\visualkan\SKILL.md"
    Copy-Item skill\metadata.json "C:\path\to\your-project\.agents\skills\visualkan\metadata.json"
    ```

### 5. Claude Code

- **Global scope**: `~/.claude/skills/` (macOS/Linux) or `%USERPROFILE%\.claude\skills\` (Windows)
  ```bash
  make install
  ```
- **Manual copy**:
  ```bash
  # macOS / Linux
  mkdir -p ~/.claude/skills/visualkan
  cp skill/visualkan.md ~/.claude/skills/visualkan/SKILL.md
  cp skill/metadata.json ~/.claude/skills/visualkan/metadata.json

  # Windows (PowerShell)
  New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\skills\visualkan"
  Copy-Item skill\visualkan.md "$env:USERPROFILE\.claude\skills\visualkan\SKILL.md"
  Copy-Item skill\metadata.json "$env:USERPROFILE\.claude\skills\visualkan\metadata.json"
  ```

### 6. OpenClaw

```bash
make openclaw-install
```
Or manually copy `skill/visualkan.md` to `~/clawd/skills/visualkan/SKILL.md`.

### Makefile targets

| Target | Description | Scope / Path |
|--------|-------------|--------------|
| **Antigravity** | | |
| `make antigravity-install` | Install to global scope | `~/.gemini/config/skills/` |
| `make antigravity-uninstall` | Remove from global scope | `~/.gemini/config/skills/` |
| `make antigravity-check` | Check status | `~/.gemini/config/skills/` |
| **Gemini CLI** | | |
| `make gemini-install` | Install to global scope | `~/.gemini/skills/` |
| `make gemini-uninstall` | Remove from global scope | `~/.gemini/skills/` |
| `make gemini-check` | Check status | `~/.gemini/skills/` |
| **Codex CLI** | | |
| `make codex-install` | Install to global scope | `~/.codex/skills/` |
| `make codex-uninstall` | Remove from global scope | `~/.codex/skills/` |
| `make codex-check` | Check status | `~/.codex/skills/` |
| **Open Agent Standard** | | *(Cursor / Copilot / ChatGPT desktop / OpenCode / Windsurf / Roo Code / Trae)* |
| `make agents-install` | Install to global scope | `~/.agents/skills/` |
| `make agents-uninstall` | Remove from global scope | `~/.agents/skills/` |
| `make agents-check` | Check status | `~/.agents/skills/` |
| **Project Scope** | | |
| `make project-install` | Install to target project scope | `<PROJECT_DIR>/.agents/skills/` |
| `make project-uninstall` | Remove from target project scope | `<PROJECT_DIR>/.agents/skills/` |
| `make gemini-project-install` | Install to Gemini project scope | `<PROJECT_DIR>/.gemini/skills/` |
| `make codex-project-install` | Install to Codex project scope | `<PROJECT_DIR>/.codex/skills/` |
| **Claude Code** | | |
| `make install` | Install to global scope | `~/.claude/skills/` |
| `make uninstall` | Remove from global scope | `~/.claude/skills/` |
| **OpenClaw** | | |
| `make openclaw-install` | Install to global scope | `~/clawd/skills/` |
| `make openclaw-uninstall` | Remove from global scope | `~/clawd/skills/` |
| `make openclaw-check` | Check status | `~/clawd/skills/` |
| **General** | | |
| `make info` | Show skill metadata | — |
| `make version` | Print current version | — |
| `make check` | Verify prerequisites | — |

## Usage

```
/visualkan [--style S] [--draw-level L] [--complexity C] [--size WxH] [--mode M] [--output DIR] [--prefix NAME] <content>
```

### Quick examples

```bash
# Default whiteboard style
/visualkan How DNS resolution works

# Professional infographic
/visualkan --style infographic The foundations of machine learning

# Rough sketch feel
/visualkan --draw-level sketch How Git branching works

# Detailed technical diagram
/visualkan --style diagram --complexity detailed Kubernetes pod networking

# Multi-frame progressive build-up
/visualkan --mode multi-frame The OAuth2 authorization code flow

# Custom output location
/visualkan --output ./docs/images --prefix arch-overview System architecture of a microservices app

# Colorful radial mind map
/visualkan --style mindmap The principles of object-oriented programming

# Clean, data-oriented XMind-style mind map
/visualkan --style mindmap-structured Project management methodologies

# UI wireframe mockup (mobile, polished by default)
/visualkan --style mockup A mobile app login screen with email, password, social login, and forgot password

# Desktop web app wireframe
/visualkan --style mockup --device desktop An admin dashboard with sidebar nav, stats cards, charts, and data table

# Hand-drawn wireframe for brainstorming
/visualkan --style mockup --draw-level sketch A settings page with profile photo, name fields, toggles, and save button

# Use Gemini instead of OpenAI
/visualkan --backend gemini How the water cycle works

# Use OpenRouter with SeeDream model (default)
/visualkan --backend openrouter --model bytedance-seed/seedream-4.5 How async/await works

# Use OpenRouter with Flux model
/visualkan --backend openrouter --model black-forest-labs/flux-1.1-pro Microservice communication
```

### Converting Mermaid diagrams

Any Mermaid diagram can be transformed into any visual style. The skill parses nodes, edges, subgraphs, and labels to build a detailed visual prompt.

```bash
# Inline Mermaid — paste or type the diagram as the content
/visualkan --style infographic --from mermaid flowchart TD; A[Start] --> B{Decision}; B -->|Yes| C[Do Thing]; B -->|No| D[Other Thing]

# From a .mmd file
/visualkan --style whiteboard --from mermaid-file docs/architecture.mmd

# From a markdown file containing a mermaid code block
/visualkan --style presentation --from mermaid-file docs/sequence-diagram.md

# Auto-detect — if the content looks like Mermaid, it's parsed automatically
/visualkan --style diagram sequenceDiagram; participant A as Client; participant B as Server; A->>B: Request; B-->>A: Response
```

### Working with existing documents

The skill works great when pointed at existing files. You can ask it to read a document, summarize the key concepts, and generate a visual from it.

**Generate directly from a file:**

```
Read docs/architecture.md and then /visualkan --style diagram the system architecture described in that document
```

**Summarize first, then visualize:**

```
Read docs/api-spec.md, summarize the key endpoints, request/response flows, and auth
mechanisms, then /visualkan --style infographic the summary
```

**Visualize a README or spec:**

```
Review the PRD at docs/product-requirements.md and /visualkan --style presentation
a one-slide executive summary of the product vision, key features, and target users
```

**Turn meeting notes into a whiteboard:**

```
Read notes/2024-03-15-retro.md and /visualkan --draw-level sketch
a whiteboard summary of the key takeaways, action items, and themes
```

**Compare concepts from a doc:**

```
Read docs/database-comparison.md and /visualkan --style infographic --complexity detailed
a comparison of the database options with pros, cons, and recommendations
```

**Multi-frame walkthrough of a complex doc:**

```
Read docs/deployment-guide.md and /visualkan --mode multi-frame --style whiteboard
the deployment process as a step-by-step walkthrough
```

**Visualize code architecture:**

```
Review the src/ directory structure and key modules, then /visualkan --style diagram
--complexity detailed the codebase architecture showing module dependencies and data flow
```

### Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `--style` | `whiteboard`, `infographic`, `presentation`, `diagram`, `mindmap`, `mindmap-structured`, `mockup` | `whiteboard` | Visual style |
| `--device` | `mobile`, `desktop`, `tablet` | `mobile` | Device frame for mockup style |
| `--draw-level` | `sketch`, `normal`, `polished` | `normal` | Hand-drawn roughness vs clean precision |
| `--complexity` | `simple`, `moderate`, `detailed` | `moderate` | Number of sections (3-4, 5-7, or 8-12) |
| `--size` | `1024x1024`, `1536x1024`, `1024x1536` | Style-dependent | Image dimensions |
| `--mode` | `single`, `multi-frame` | `single` | One image or a progressive series |
| `--from` | `mermaid`, `mermaid-file PATH` | (none) | Parse Mermaid input (inline or from a file) |
| `--backend` | `native`, `openai`, `gemini`, `openrouter` | Auto-detected | Image generation backend. Auto-detects native subscription in Antigravity/Codex, or available API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`). |
| `--model` | Model slug / name | Default per backend | Model to use (primarily for OpenRouter: default `bytedance-seed/seedream-4.5`, `black-forest-labs/flux-1-schnell`, `krea/krea-image`, `qwen/qwen-image`, `riverflow`, etc.). |
| `--output` | Directory path | `./` | Where to save generated images |
| `--prefix` | String | `visualkan` | Filename prefix |

### Default sizes by style

| Style | Default Size | Orientation |
|-------|-------------|-------------|
| Whiteboard | 1536x1024 | Landscape |
| Infographic | 1024x1536 | Portrait |
| Presentation | 1536x1024 | Landscape |
| Diagram | 1024x1024 | Square |
| Mind Map | 1536x1024 | Landscape |
| Mind Map (Structured) | 1536x1024 | Landscape |
| Mockup (mobile/tablet) | 1024x1536 | Portrait |
| Mockup (desktop) | 1536x1024 | Landscape |

## How It Works

1. **Backend detection** — Auto-detects native subscription capability (Antigravity/Codex `generate_image`) or available API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`) and reports which backend will be used
2. **Content analysis** — The skill deeply analyzes your input to extract the core concept, sections, relationships, visual metaphors, and an optimal layout strategy
3. **Prompt construction** — A detailed 400-800 word prompt is built using style-specific templates that specify exact spatial positions, icons, colors, typography, connections, and decorative elements
4. **Image generation** — The prompt is processed by native subscription tools (`generate_image`), OpenAI gpt-image-2, Gemini Nano Banana 2, or OpenRouter models (SeeDream, Flux, Krea, RiverFlow, QwenImage, etc.)
5. **Structured output** — A text summary of sections, relationships, and backend used is provided alongside the image

## Cost

### Native Subscription (Antigravity & Codex)

Included with your ChatGPT or Gemini subscription plan. No API usage fees.

### OpenAI (gpt-image-2)

Estimated cost (OpenAI): ~$0.053 per image at medium quality, 1024x1024. High quality ~$0.211.

### Gemini (Nano Banana 2)

Free tier available. Check current pricing at [aistudio.google.com](https://aistudio.google.com/).

### OpenRouter

Prices vary based on model selected (e.g. Flux, Krea, SeeDream, RiverFlow, QwenImage). Check model rates at [openrouter.ai/models](https://openrouter.ai/models).

Multi-frame mode generates multiple images (3-5), so costs multiply accordingly.

## Tips

- **Text-heavy content** works best with `infographic` style
- **Process/flow content** works best with `diagram` style
- **Engaging/fun explanations** work best with `whiteboard` style
- **Hierarchical/categorical content** works best with `mindmap` (colorful) or `mindmap-structured` (data-oriented)
- Use `mindmap` when the audience values visual appeal and creativity
- Use `mindmap-structured` for board presentations, strategy docs, or data-heavy taxonomies
- **UI wireframes and screen layouts** work best with `mockup` style — use `--device` to match the target platform
- Use `mockup --draw-level sketch` for early brainstorming, `--draw-level polished` for stakeholder-ready wireframes
- Use `--draw-level sketch` for a casual, brainstormy feel
- Use `--draw-level polished` for clean hand-lettering on whiteboard style
- Use `--complexity detailed` when you need comprehensive coverage
- If results feel too sparse, try increasing complexity; if too cluttered, decrease it

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.1.0 | 2026-08-14 | First Visualkan release: fork identity and an independent version line |

### v0.1.0 — Fork and Identity

- Renamed the skill, the command, and the documentation from `visual-explainer` to `visualkan`
- Reset the version line to 0.1.0, independent of upstream ([ADR 0001](docs/adr/0001-fork-visual-explainer-as-visualkan.md))
- Claude Code now installs a skill to `~/.claude/skills/`, matching every other supported platform
- Adopted one term per concept across the documents. `Section` replaces `concept`, `sub-topic`, and `Central Topic` (see [CONTEXT.md](CONTEXT.md))
- Corrected the `--draw-level` coverage note, which named `presentation` (which had no branches) and omitted `infographic` and `mockup` (which had them)
- Removed the dead `generate-images` dependency from `metadata.json`
- `--draw-level` now applies to every style. `presentation`, `diagram`, `mindmap`, and `mindmap-structured` previously ignored it

## Upstream Release History

The releases below belong to `visual-explainer`, not to Visualkan. They are kept for provenance. See [Credits](#credits).

### v1.4.0 — Antigravity, Codex & OpenRouter Support

- Support for installation and use in **Antigravity** (`make antigravity-install`) and **Codex** (`make codex-install`) alongside Claude Code and OpenClaw
- **Keyless Native Subscription Image Generation**: Antigravity and Codex users use native subscription capabilities (`generate_image`) with zero API key requirement
- **OpenRouter API Key Support**: Non-Antigravity/Codex users or users wanting alternative image models can pass `OPENROUTER_API_KEY` and `--backend openrouter`
- `--model` flag to select any image generation model available on OpenRouter (Flux, Krea, SeeDream, RiverFlow, QwenImage, etc.)
- Updated auto-detection priority: Native Subscription (Antigravity/Codex) → OpenAI → Gemini → OpenRouter

### v1.3.0 — Mockup/Wireframe Style

- New `mockup` style for generating UI wireframes and screen mockups
- `--device` flag to select device frame: `mobile` (phone), `desktop` (browser window), `tablet` (iPad-style)
- Three fidelity levels via `--draw-level`: sketch (hand-drawn), normal (mid-fi), polished (Figma-quality)
- Comprehensive prompt template with support for navigation, input fields, buttons, cards, tables, charts, and all standard UI components
- Annotation support for wireframe callouts and specifications
- Ideal for rapid wireframing from PRDs, brainstorming UI layouts, and visualizing modernized interfaces

### v1.2.0 — Gemini Backend Support

- `--backend` flag to choose between `openai` (gpt-image-1.5) and `gemini` (Nano Banana 2)
- Auto-detection: uses whichever API key is available; defaults to OpenAI if both are set
- Backend reported before generation and in structured output summary
- Gemini API integration via `generativelanguage.googleapis.com`
- Size handling adapted for Gemini (dimensions included in prompt text)
- Updated prerequisites to support either `OPENAI_API_KEY` or `GEMINI_API_KEY`

### v1.1.0 — Mermaid Diagram Conversion

- `--from mermaid` flag for inline Mermaid input
- `--from mermaid-file PATH` for reading `.mmd` or `.md` files
- Auto-detection of Mermaid syntax in content
- Full parsing of all Mermaid diagram types: flowchart, sequence, class, state, ER, gantt, pie, mindmap, timeline
- Extracts nodes, edges, subgraphs, participants, attributes, and labels for precise prompt construction
- Any Mermaid diagram type can be rendered in any visual style

### v1.0.0 — Initial Release

- 6 visual styles at launch: whiteboard, infographic, presentation, diagram, mindmap, mindmap-structured
- `--draw-level` parameter (sketch, normal, polished) for hand-drawn vs professional spectrum
- `--complexity` parameter (simple, moderate, detailed) for content density control
- `--mode multi-frame` for progressive build-up explanations
- Deep content analysis pipeline with concept extraction, visual metaphors, and layout strategy
- Style-specific prompt templates (400-800 words) for each visual style
- Integration with OpenAI gpt-image-1.5 via generate-images skill
- YAML frontmatter with official Claude Code skill metadata
- Makefile with install, uninstall, version management, and release targets
- 8 example images across all styles

## License

MIT — see [LICENSE](LICENSE) for details.
