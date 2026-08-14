# --model applies to the openrouter backend only

`--model` selects an image generation model, but only the `openrouter` backend reads it. The `openai` backend hardcodes `gpt-image-2` in its request body, the `gemini` backend hardcodes its model in the endpoint URL, and the `native` backend uses whatever model the host platform provides. We considered making `--model` universal, so that every backend accepted it and defined a default. We rejected that: it commits Visualkan to tracking the model catalogue of three vendors, and the two hardcoded backends would need a supported-model list that goes stale on every vendor release.

Visualkan therefore treats `--model` with any backend other than `openrouter` as an error rather than ignoring it. A silently discarded flag is worse than a rejected one, because the user believes the model changed when it did not.

## Consequences

- A new OpenAI or Gemini image model requires editing the skill. This is deliberate, and it is the cost we accepted in exchange for not maintaining three model catalogues.
- `native` remains a Backend value alongside three API vendors even though it is a route rather than a vendor. Universal `--model` would have dissolved that asymmetry by making Backend mean "route" and Model mean "which model on that route". It stays unresolved, and it is cosmetic.
- Reversing this is backward compatible. Accepting `--model` everywhere later would break no existing command.
