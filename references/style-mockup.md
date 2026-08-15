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
