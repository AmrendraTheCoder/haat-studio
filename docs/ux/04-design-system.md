# 04 · Design system

**2026-11 redesign:** warm white surfaces, warm near-black ink and one brand
colour, rani pink, for the main action and the payoff moments — a calm product
look in the spirit of admin consoles, in Haat's own colours. The working pages sit
in an app shell (sidebar: Try-on Studio, Post Maker, Market Research, Library,
Help; top bar: breadcrumbs, free-GPU chip, language, Help drawer) and use the full
width beside it. Tokens live in `src/app/globals.css`; components in
`src/components/`. Token names are unchanged from the first (cream risograph)
version, so every screen picked up the new values.

## Tokens

### Colour

| Token | Value | Use | Contrast |
|---|---|---|---|
| `paper` | oklch(98.4% .004 85) | Page background | — |
| `paper-glow` | white | Cards, inputs, raised surfaces | — |
| `paper-2` / `paper-3` | 96.4% / 92.8% | Subtle fills, image wells, skeletons | — |
| `ink` | oklch(21% .012 60) | Headings, body | 16:1 on white |
| `ink-2` | 38% | Secondary text | 10:1 |
| `ink-3` | 50% | Hints, labels | 5.4:1 on white, 4.9:1 on paper-2 |
| `accent-strong` | oklch(50% .19 358) | Primary buttons, links, kickers, selected options | 6:1 with white |
| `accent-deep` / `accent-wash` | 43% / 96.5% | Primary hover / selected backgrounds | text on wash is ink |
| `marigold` / `marigold-wash` | 76% / 97% | Warnings, "check" quality states | text on it is ink |
| `good` / `danger` | 48% / 50% (+ washes) | Pass / fail, ready / error | 5.6:1 / 5.5:1 |
| `line` / `line-strong` | 91% / 66% | Card borders / input borders (3:1, WCAG 1.4.11) | — |

### Type

Calibri, with **Carlito** (its open, metric-compatible twin, `@fontsource/carlito`)
bundled because Calibri may not be redistributed; Noto Sans Devanagari for Hindi.
Scale: 11 (floor) · 12 · 14 · 16 · 20 · 24 · 32 · 40, plus one display size
(clamp 40–60 px) for the landing hero. Weights 400 and 700. Figures are tabular in
tables, chips, inputs and definition lists.

### Space, shape, motion

- Spacing on Tailwind's 4 px scale; cards pad 20–24 px; page gutter 16 px on phones.
- Radius: 8 px buttons and inputs, 12 px options, 16 px cards, 28 px photo frames.
- Motion: one entrance (`rise`, 0.45 s spring), the marquee ticker, the scallop
  border, a scan shimmer while generating. All disabled under `prefers-reduced-motion`.

## Components

### Button — `btn-primary` (rani pink), `btn-ghost` (white, bordered), `btn-light` (on dark bands)

| Variant | Use when |
|---|---|
| Primary (ink pill) | The one next step: Continue, Create photo, Download |
| Ghost (outlined pill) | Alternatives: Back, Another variation, Write caption |

States: default · hover (ink-2 / paper-2) · focus (2 px ink ring) · disabled
(40% opacity **plus a reason line beneath**). Minimum 44 px tall.
✅ One primary per area. ❌ A disabled button with no reason.

### Choice cards — `Choices` (radio group)

Large tappable cards with icon, title and hint. `role="radiogroup"`/`radio`,
one Tab stop per group, arrow keys move and select (WAI-ARIA pattern), selected
= ink fill. ✅ For 2–4 mutually exclusive options. ❌ For more than 4 — use chips.

### Chips — research `Pick`, report labels

Pill toggles for multi-select (`aria-pressed`) or status labels (`chip`). 44 px tall when interactive.

### Drop zone — `Dropzone`

Tap, drag-drop or paste an image. Shows the preview with Replace / Remove.
Validates type, size, HEIC and dimensions before upload; multiple files → uses
the first and says so. The hidden file input is `aria-hidden`; the visible
button is the control.

### Stepper — `Stepper`

Three steps; ✓ only when that step's inputs are actually complete; unreachable
steps explain why; all steps lock while a photo is being made.

### Action bar — `ActionBar`

Holds the step's main buttons. Sticky to the bottom on phones, inline on
desktop. Always renders the reason line when the main action is blocked, or the
expected cost when it isn't.

### Notice — `Notice`

`info` (paper-glow), `warn` (marigold-wash), `error` (danger-wash, `role="alert"`).
Always says what happened and what to do.

### Before/after — `BeforeAfter`

Drag (mouse, touch, pen) or arrow keys (Shift = 10 %, Home/End). `role="slider"`
with value. Same object-fit for both images so they align.

### Live pipeline — `Pipeline`

Derived only from server events; never animated on a timer. Stage dots:
done ✓ · active (pulsing accent) · skipped – · failed !. One polite
screen-reader announcement per stage change.

### Placeholder — `Placeholder`

Dashed frame + plain words where real content will go. The rule: **never an
imitation of a result.**

### Full-screen view — `Lightbox`

Modal dialog; focus starts on Close, Tab is trapped inside, Esc closes and
returns focus to the opener; page scroll locked while open.

## Voice and tone

**Plain, warm, specific — like a helpful shopkeeper, not a system.**

| ✅ We write | ❌ Not |
|---|---|
| "This product photo is HEIC. Export it as JPEG first (on iPhone: Settings → Camera → Formats → Most Compatible)." | "Unsupported file format." |
| "Today's free GPU quota is used up. It refills in about 14 min." | "Error 429: quota exceeded." |
| "At your lowest price you keep only 20%." | "Margin below threshold." |
| "Wearing a dress: good for tops and dresses, not for skirts." | "Incompatible preset." |
| "Make it a post →" | "Proceed to post generation" |

- Lead with what the seller can do next.
- Say the number ("about 15–30 seconds", "₹99 per piece").
- Label AI help as AI, and templates as templates.
- English that a Hindi speaker reads easily: short sentences, no idioms.
- Hindi as people speak it, not textbook Hindi: keep everyday English shop words
  (फ़ोटो, ऑर्डर, DM, MRP) rather than formal coinages.
- Devanagari gets Noto Sans Devanagari, more line height on headings, and no
  monospace or letter-spacing (both break its joined letters) — see `:lang(hi)` in `globals.css`.

## Token audit (this pass)

| Check | Before | After |
|---|---|---|
| Hard-coded colours in components | 4 copies of the warning background | 0 — `marigold-wash` token |
| Text below 11 px | 13 places at 9–10 px | 0 — `text-2xs` (11 px) |
| Text failing AA contrast | 4 tokens | 0 |
| Controls under 44 px | 36+ | 0 (inline text links exempt) |

## Added in the 2026-11 redesign

- **App shell** (`src/components/site/AppShell.tsx`) — sidebar, breadcrumbs, quota chip, Help drawer.
- **Review step** in the studio, the post maker ("Review and download") and research ("Review your answers"): every choice with an Edit link, then the one primary action.
- **Help everywhere** — `HelpTip` "?" buttons (44 px hit area, `aria-describedby`, Esc closes) and the Help drawer / `/help` page, from `help.topics` in both languages.
- **Library** (`/library`) — every saved photo, sort / filter / grid or list.
- **Quality checks** on the result — pass / check / fail per output guardrail.
- Pure UI logic in `src/lib/ui/` (filters, review values, quality summary, library sort) is unit-tested in `tests/ui.test.ts`.
