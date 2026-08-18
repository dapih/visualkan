Visualkan Controls v0.7.1

--style          Default: whiteboard
  whiteboard          1536x1024  Hand-drawn teaching board. Markers, doodles, arrows, one color per Section.
  infographic         1024x1536  Numbered editorial layout. Portrait, icon per Section, best for text-heavy Content.
  presentation        1536x1024  One keynote slide. A single dominant visual and 2 to 5 takeaways.
  diagram             1024x1024  Technical figure. Boxes, arrows, exact labels, engineering documentation.
  mindmap             1536x1024  Radial and colorful. Organic branches from a center, vibrant at every Draw Level.
  mindmap-structured  1536x1024  XMind style. Muted palette, badges and counts, ready for a board pack.
  mockup              1024x1536  UI wireframe inside a device frame. Pair it with --device.

--draw-level     Default: normal
  sketch              Rough and hand-drawn. Playful, visibly made by a person.
  normal              Balanced. Clean execution that still reads as drawn.
  polished            Precise and professional. Exact geometry and typesetting.

--complexity     Default: moderate
  simple              3 to 4 Sections
  moderate            5 to 7 Sections
  detailed            8 to 12 Sections

--device         Default: mobile. Applies to --style mockup only.
  mobile              Phone frame, portrait.
  desktop             Browser window, landscape.
  tablet              Tablet frame, portrait.

--mode           Default: single
  single              One Frame. One call to the image API.
  multi-frame         Three to five Frames that build up. One call for each, so the cost multiplies.

--backend        Default: the first available in this list
  openai              OpenAI gpt-image-2      OPENAI_API_KEY
  gemini              Gemini Nano Banana 2    GEMINI_API_KEY
  openrouter          OpenRouter              OPENROUTER_API_KEY
  native              Any platform with its own generate_image tool. Only the agent can detect it.
  Auto-detect chooses the first backend above whose key is set.

--model          Applies to --backend openrouter only. See ADR 0003.
  default             bytedance-seed/seedream-4.5

--size, --output, --prefix, --from   See `visualkan help`.
