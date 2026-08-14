# Visualkan

A cross-platform AI skill that converts any content into stunning visual explanations — whiteboard sketches, professional infographics, presentation slides, technical diagrams, mind maps, and UI wireframe mockups — powered by Native Subscriptions (Antigravity/Codex), OpenAI (gpt-image-2), Google Gemini (Nano Banana 2), or OpenRouter (SeeDream, Flux, Krea, RiverFlow, QwenImage, etc.). See [Prerequisites](#prerequisites) for the full list of compatible platforms.

## About

AI-generated visual explanations have exploded in popularity — tools like NotebookLM and Gemini can turn documents into polished infographics and whiteboard sketches. But these tools are closed ecosystems. You can't customize the output style, integrate them into your dev workflow, or control the prompts that drive the generation.

**Visualkan** brings this capability directly into your AI coding assistant as a skill. It takes any content — a topic, a document, meeting notes, a codebase — and transforms it into a rich visual explanation.

The core insight is that image generation quality depends almost entirely on prompt quality. Visualkan uses deeply structured, 400-800 word prompts with explicit spatial layout, icon descriptions, color palettes, typography, and connections — producing results that rival or exceed what dedicated visual AI tools generate.

### Design Principles

- **Style Spectrum** — From rough whiteboard sketches to polished infographics, with a `--draw-level` parameter to control exactly where on the hand-drawn-to-professional spectrum the output lands
- **Deep Content Analysis** — Every generation starts with structured extraction of the core concept, sections, relationships, visual metaphors, and layout strategy before any prompt is written
- **Prompt Engineering as the Product** — The skill's value is in its style-specific prompt templates, not just API wrappers. Each style (whiteboard, infographic, presentation, diagram, mindmap, mindmap-structured, mockup) has a comprehensive template tuned for that visual language
- **Composable with Documents** — Works naturally with your AI assistant's ability to read files, so you can point it at any existing doc, spec, or codebase and generate visuals from it

### Credits

Visualkan is a fork of the `visual-explainer` skill by [Eric Blue](https://about.ericblue.com) ([GitHub](https://github.com/ericblue)). It is used under the MIT license. See [LICENSE](LICENSE) for the original copyright notice, and [ADR 0001](docs/adr/0001-fork-visual-explainer-as-visualkan.md) for why this project forked.

Visualkan restarted its version numbering at 0.1.0. Releases numbered 1.0.0 through 1.4.0 belong to `visual-explainer`. They are listed in [CHANGELOG.md](CHANGELOG.md#upstream-release-history).

## Prerequisites

### 1. AI Assistant Platform

Compatible with:

- Claude Code (CLI and desktop)
- Antigravity
- Gemini CLI
- Codex CLI
- ChatGPT desktop (including Codex desktop)
- OpenClaw
- Cursor
- OpenCode
- GitHub Copilot (in VS Code)
- Windsurf
- Roo Code
- Trae
- Other platforms compatible with Open Agent Standard

### 2. Image Generation Backend

Visualkan needs a way to generate images. Pick one option below.

An API key is a password that identifies you to a service. Visualkan sends your key with each request, and the service checks it before it generates an image.

#### Option A: Native Subscription (Antigravity and Codex)

If you use Antigravity or Codex, image generation is included in your subscription plan. No API key is needed. Skip to [Installation](#installation).

#### Option B: OpenAI API (gpt-image-2)

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Sign in, or create an account.
3. Select **Create new secret key**.
4. Copy the key. It starts with `sk-`.
5. Store it as `OPENAI_API_KEY`. See [Storing your API key](#storing-your-api-key).

#### Option C: Google Gemini API (Nano Banana 2)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Sign in with a Google account.
3. Select **Create API key**.
4. Copy the key. It starts with `AIza`.
5. Store it as `GEMINI_API_KEY`. See [Storing your API key](#storing-your-api-key).

#### Option D: OpenRouter API (SeeDream, Flux, Krea, RiverFlow, QwenImage, and more)

Choose this option if you do not use Antigravity or Codex, or if you want a choice of image models.

1. Go to [openrouter.ai/keys](https://openrouter.ai/keys).
2. Sign in, or create an account.
3. Select **Create Key**.
4. Copy the key. It starts with `sk-or-v1-`.
5. Store it as `OPENROUTER_API_KEY`. See [Storing your API key](#storing-your-api-key).

Add `--backend openrouter` to your request to use this option. See [Default backend and model](#default-backend-and-model) for the full list of OpenRouter models.

#### Storing your API key

An environment variable holds a value that programs on your computer can read. This method lets Visualkan find your key. You do not need to type it into every request.

Two methods exist. A temporary variable lasts until you close the terminal window. A permanent variable survives a restart.

**Windows — temporary, for the current PowerShell window only:**

```powershell
$env:OPENAI_API_KEY = "sk-..."
```

**Windows — permanent:**

1. Press the Windows key.
2. Type `env`.
3. Select **Edit environment variables for your account**.
4. Under **User variables**, select **New**.
5. Enter `OPENAI_API_KEY` as the variable name.
6. Paste your key as the variable value.
7. Select **OK** on every open window.
8. Close and reopen your terminal.

**macOS and Linux — temporary, for the current terminal window only:**

```bash
export OPENAI_API_KEY="sk-..."
```

**macOS and Linux — permanent:**

1. Find your shell's startup file. zsh, the default on current macOS, uses `~/.zshrc`. bash uses `~/.bashrc` or `~/.bash_profile`.
2. Open the file in a text editor.
3. Add this line at the end of the file:

   ```bash
   export OPENAI_API_KEY="sk-..."
   ```

4. Save the file.
5. Run `source ~/.zshrc`, using your own file name, or open a new terminal window.

Replace `OPENAI_API_KEY` and the example value with the variable name and key for your chosen provider: `GEMINI_API_KEY` or `OPENROUTER_API_KEY`. To store more than one key, repeat these steps for each variable.

#### Default backend and model

If you do not pass `--backend`, the CLI picks one for you. It checks for a key in this fixed order: `OPENAI_API_KEY`, then `GEMINI_API_KEY`, then `OPENROUTER_API_KEY`. The first key it finds sets the backend for that run.

No environment variable changes this order. Two methods control the choice instead:

- Store only the key for the provider you want.
- Add `--backend openai`, `--backend gemini`, or `--backend openrouter` to your request. This flag always wins over the automatic order.

OpenAI and Gemini each run one fixed image model. You cannot change it, and `--model` with either backend is an error by design.

OpenRouter accepts a `--model` flag:

```
/visualkan --backend openrouter --model bytedance-seed/seedream-4.5 How async/await works
/visualkan --backend openrouter --model black-forest-labs/flux-1-schnell How async/await works
/visualkan --backend openrouter --model krea/krea-image How async/await works
```

No environment variable sets the model either. Include `--model` in your request each time you want a model other than the default, `bytedance-seed/seedream-4.5`. Run `visualkan controls` for the full list of supported models.

### 3. Node.js 24 or later

Visualkan ships as an npm package, and the `visualkan` CLI performs the API calls:

```bash
node --version    # must be v24 or later
```

If this command fails, or reports an older version, install Node.js from [nodejs.org](https://nodejs.org). The installer matches your operating system automatically.

Antigravity and Codex users who rely on the native subscription backend still need Node to install the skill, but the CLI is not involved in generation.

## Compatibility

This skill supports any platform that reads markdown skill definitions, including every platform compatible with [Open Agent Standard](https://agentskills.io). See [Prerequisites](#prerequisites) for the full list of compatible platforms.

Antigravity and Codex CLI use native subscription image generation, with no API key needed. Every other platform uses an API key, or OpenRouter. See [Image Generation Backend](#2-image-generation-backend).

## Installation

Visualkan needs [Node.js](https://nodejs.org) 24 or later, and nothing else.

### Open a terminal

Run every command below inside a terminal window.

- **Windows**: Press the Windows key. Type `powershell`. Select **Windows PowerShell**.
- **macOS**: Press Command+Space. Type `terminal`. Press Return.
- **Linux**: Open your terminal application from the applications menu, or press Ctrl+Alt+T.

### 1. Install the CLI

```bash
npm install -g @dapih/visualkan
```

If this command reports a permission error on macOS or Linux, run it again with `sudo`:

```bash
sudo npm install -g @dapih/visualkan
```

### 2. Install the skill into your platform

```bash
visualkan install claude
```

Replace `claude` with your platform:

| Platform | Command | Installs to |
|---|---|---|
| Claude Code | `visualkan install claude` | `~/.claude/skills/visualkan/` |
| Antigravity | `visualkan install antigravity` | `~/.gemini/config/skills/visualkan/` |
| Gemini CLI | `visualkan install gemini` | `~/.gemini/skills/visualkan/` |
| Codex CLI | `visualkan install codex` | `~/.codex/skills/visualkan/` |
| Open Agent Standard | `visualkan install agents` | `~/.agents/skills/visualkan/` |
| OpenClaw | `visualkan install openclaw` | `~/clawd/skills/visualkan/` |

Use `visualkan install agents` for Cursor, GitHub Copilot, ChatGPT desktop, OpenCode, Windsurf, Roo Code, and Trae.

One command installs two skills. `visualkan` goes to the directory in the table, and `visualkan-wizard` goes to a sibling directory beside it. The wizard needs that layout, so do not move either directory by hand.

### Project scope

To install into one project instead of your home directory, pass `--project`:

```bash
visualkan install claude --project /path/to/your-project
```

OpenClaw supports global scope only.

### Other commands

```bash
visualkan status               # show where both skills are installed
visualkan controls             # print every control and its legal values
visualkan uninstall claude     # remove both skills
visualkan help                 # full usage
```

`visualkan controls` prints the catalog from the code, so it never goes stale. It also reports which backends this machine can reach, without printing a key.

### Upgrading

```bash
npm install -g @dapih/visualkan@latest
visualkan install claude
```

The second command overwrites the installed skill with the new version. Run it for each platform you use.

## Usage

```
/visualkan [--style S] [--draw-level L] [--complexity C] [--size WxH] [--mode M] [--output DIR] [--prefix NAME] <content>
```

### The wizard

If you do not want to remember the controls, start the wizard instead:

```
/visualkan-wizard
```

It asks for the style, the draw level, the complexity, and the content, one question at a time. Every question shows the legal values and marks the default, and every question offers "accept the remaining defaults". It then states the plan and waits for your approval before it spends anything.

The wizard runs only when you name it. A plain request to visualize something goes to `/visualkan` as before.

### When the request is too thin

`/visualkan` reads the content before it generates. If the content cannot fill the sections that the chosen complexity needs, it asks up to three questions instead of inventing sections. `--complexity simple` needs 3 sections, `moderate` needs 5, and `detailed` needs 8.

After those questions, it states the plan and waits for approval. A request that already carries enough content never stops for either step.

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

### Controls

Run `visualkan controls` to print this table from the code. The table below repeats it for readers of this file.

| Control | Values | Default | Description |
|--------|--------|---------|-------------|
| `--style` | `whiteboard`, `infographic`, `presentation`, `diagram`, `mindmap`, `mindmap-structured`, `mockup` | `whiteboard` | Visual style |
| `--device` | `mobile`, `desktop`, `tablet` | `mobile` | Device frame for mockup style |
| `--draw-level` | `sketch`, `normal`, `polished` | `normal` | Hand-drawn roughness vs clean precision |
| `--complexity` | `simple`, `moderate`, `detailed` | `moderate` | Number of sections (3-4, 5-7, or 8-12) |
| `--size` | `1024x1024`, `1536x1024`, `1024x1536` | Style-dependent | Image dimensions. With `--backend openrouter`, only the orientation is sent, because that API takes an aspect ratio and each model sets its own pixel count. |
| `--mode` | `single`, `multi-frame` | `single` | One image or a progressive series |
| `--from` | `mermaid`, `mermaid-file PATH` | (none) | Parse Mermaid input (inline or from a file) |
| `--backend` | `native`, `openai`, `gemini`, `openrouter` | Auto-detected | Image generation backend. Auto-detects native subscription in Antigravity/Codex, or available API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`). |
| `--model` | Model slug / name | `bytedance-seed/seedream-4.5` | **`--backend openrouter` only.** Model to use: `bytedance-seed/seedream-4.5`, `black-forest-labs/flux-1-schnell`, `krea/krea-image`, `qwen/qwen-image`, `riverflow`, etc. With any other backend this flag is an error, because those backends run a fixed model. |
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

### Output files

Files are named `<prefix>-<n>.<ext>`, and the number increases for each new image.

Every backend is asked for PNG. A backend can answer with a different format. The CLI reads the returned bytes and gives the file the matching extension, so the name always states the true format. For example, `bytedance-seed/seedream-4.5` returns JPEG, and the file is named `.jpg`.

The CLI writes the saved path to stdout. Read that path instead of assuming the extension.

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

See [CHANGELOG.md](CHANGELOG.md) for every release, including the upstream `visual-explainer` history.

## License

MIT — see [LICENSE](LICENSE) for details.
