---
name: visualkan-wizard
description: Walks the user through the Visualkan Controls one at a time, then starts the run. Use ONLY when the user names this skill directly, for example "/visualkan-wizard" or "run the visualkan wizard". Do NOT use this for a request to visualize, explain, diagram, sketch, or draw something. The visualkan skill owns those requests.
argument-hint: "(no arguments — the wizard asks for everything)"
allowed-tools: Bash, Read, Write, Glob, Grep
---

Guide the user through the Visualkan Controls, one step at a time, then start the run. Use this skill only when the user names it. A plain request to visualize something belongs to the `visualkan` skill.

## Why this skill exists

The `visualkan` skill takes nine flags. A user who does not know them has to read the documentation before every run. This skill replaces that reading with a short sequence of choices.

## Step 1: Read the Control catalog

Run this command:

```bash
visualkan controls
```

The output lists every Control, every legal value, and the default. It also reports which Backends this environment can reach.

Never write the value lists into this file, and never recite them from memory. The command prints them from the code, so the command cannot be out of date.

If `visualkan` is not on PATH, stop and tell the user to run this:

```bash
npm install -g visualkan
```

## Step 2: Ask for the Controls

Ask one question at a time. Present the values as a numbered list. Mark the default. Accept a number or a name.

Offer this escape on every question: "Accept the remaining defaults." If the user takes it, stop asking and go to Step 3.

Ask in this order:

1. **Style.** Show all seven, each with the one-line description from `visualkan controls`.
2. **Device.** Ask this only if the user chose `mockup`. Skip it otherwise.
3. **Draw Level.** Show the three values with their descriptions.
4. **Complexity.** Show the three values with their Section counts.
5. **Backend.** Ask this only if `visualkan controls` reports more than one available Backend. Skip it otherwise, because there is no choice to make.

Do not ask about Mode. Multi-frame runs call the image API three to five times, and a user who needs this skill cannot judge that cost. A user who wants multi-frame can pass `--mode multi-frame` to the `visualkan` skill.

Do not ask about `--size`, `--output`, or `--prefix`. The defaults are correct for almost every run.

## Step 3: Ask for the Content

Ask what the user wants to explain. Accept any of these:

- A topic, in the user's own words
- A path to a file to read
- A Mermaid diagram, inline or as a `.mmd` path

Do not judge the answer here. The next skill tests whether the Content can fill the Sections that the chosen Complexity needs.

## Step 4: Hand the run to the visualkan skill

Read the sibling skill file at `../visualkan/SKILL.md`, relative to this file. Both skills install into the same parent directory, so that path resolves on every platform.

Follow that file from **Step 2: Analyze the content**, with the Controls and the Content that this wizard collected.

State that the Wizard started this run, because the confirmation step in that file depends on it.

Do not construct the Image Prompt here. Do not call the image API here. The style templates live in the other file, and one copy of them is the point.

## What this skill never does

- It never reads `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `OPENROUTER_API_KEY`. `visualkan controls` reports Backend availability without exposing a key. See ADR 0004.
- It never generates an image before the user approves the plan. The approval step lives in `../visualkan/SKILL.md`.
- It never copies the Control values or the style templates into this file. Two copies drift apart.
