# A Node CLI owns transport and policy

Visualkan required `make` and `jq` to install, and `curl`, `jq`, and `base64` to generate. On Windows that is four Unix tools to copy two files and decode a PNG, and `jq` in particular is rarely already installed. We considered replacing only `jq`, keeping the shell pipeline otherwise, and we considered a `uv`-based Python helper. We chose a single zero-dependency Node CLI, published to npm, because Node 24 supplies `fetch`, `Buffer`, `path.join`, and a test runner in one runtime that this audience almost always has already — several of the host assistants are themselves distributed through npm.

The CLI owns transport and policy: backend detection, API key validation, the `--model` rule from ADR 0003, size selection, the HTTP request, response parsing, and writing the file. The agent keeps content analysis and prompt construction, which is the part that needs a model. `SKILL.md` states the boundary and forbids the agent from reading API keys, choosing a backend, calling `curl`, or parsing with `jq`.

## Consequences

- Two defects became unreachable rather than fixed. Paths are built with `path.join`, so the 0.1.0 quoting fix for home directories containing a space is no longer needed. Payloads are built with `JSON.stringify`, so a prompt containing quotes or apostrophes can no longer corrupt the request — the previous design produced invalid JSON for essentially every prompt, because the templates instruct the agent to quote every label.
- Policy that was prose is now enforced. An agent could ignore a paragraph asking it to reject `--model`; it cannot ignore a thrown error.
- The `native` backend deliberately does not use the CLI. Antigravity and Codex generate images with their own `generate_image` tool, so the CLI rejects `--backend native` and points the caller back to that tool.
- Node 24 is a hard floor, which excludes users on Node 22 even though the code would run there. `engines` makes this a warning rather than a block.
- There is no fallback to `jq` or Python. A user without Node cannot use the API backends and must use the `native` backend or install Node. This was chosen deliberately: a fallback chain means several code paths that all need testing and debugging, and the failures would be rare and hard to reproduce.
- Visualkan is no longer only markdown. It is an npm package, so releases now carry publication risk that a file copy did not.
