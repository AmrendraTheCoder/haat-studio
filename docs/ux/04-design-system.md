# 04 · Design system

Haat's look is ported from stiche-v2 (which took it from Marquee): **cream
risograph paper, warm ink, one magenta splash.** It reads as a craft-market
stall, not a tech dashboard — which is who it's for. Tokens live in
`src/app/globals.css`; components in `src/components/`.

## Tokens

### Colour

| Token | Value | Use | Contrast |
|---|---|---|---|
| `paper` | oklch(92% .028 88) | Page background | — |
| `paper-2` / `paper-3` | 88% / 84% | Cards, raised areas | — |
| `paper-glow` | 95% | Inputs, chips, fields | — |
| `ink` | oklch(15% .012 60) | Headings, body, primary buttons | 15.5:1 on paper |
| `ink-2` | 30% | Secondary text | > 9:1 |
| `ink-3` | 46% | Hints, labels, captions | 5.6:1 on paper (was 4.4:1 — fixed) |
| `accent-strong` | oklch(52% .22 8) | "After", share, offer, required `*` | ≥ 4.5:1 with cream text |
| `accent` / `accent-wash` | 70% / 87% | Decorative splash, drag-over state | not used for text |
| `marigold` / `marigold-wash` | 72% / 93% | Warnings, "heads up" notes | text on it is ink |
| `good` | 45% | "Ready", "no GPU used" | 5.5:1 |
| `danger` / `danger-wash` | 48% / 90% | Errors | 5.2:1 |
| `line` / `line-strong` | 76% / 50% | Borders | — |

**Rules:** one accent per screen area; colour never carries meaning alone (✓/✗
and words accompany green/red); fixed light theme so a projector and a phone
look the same.

### Type

| Role | Font | Size |
|---|---|---|
| Display (hero, section heads) | Inter Variable 800, tracking −0.05em, lowercase | `--text-mega` clamp(44–96 px), `--text-giant` clamp(40–88 px) |
| Headings | Inter 700–800 | 24–40 px |
| Body | Inter 400–500 | 16 px (14 px on desktop forms) |
| Labels, kickers, data | Geist Mono 500 | 12 px uppercase, tracked |
| Smallest | `text-2xs` | **11 px** — nothing smaller anywhere |

Fonts are bundled (no Google Fonts call), so the app renders identically offline.

### Space, shape, motion

- Spacing on Tailwind's 4 px scale; cards pad 20–24 px; page gutter 16 px on phones.
- Radius: 12 px controls, 16 px cards, 24 px photos, pill buttons.
- Motion: one entrance (`rise`, 0.45 s spring), the marquee ticker, the scallop
  border, a scan shimmer while generating. All disabled under `prefers-reduced-motion`.

## Components

### Button — `btn-primary`, `btn-ghost`

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

## Token audit (this pass)

| Check | Before | After |
|---|---|---|
| Hard-coded colours in components | 4 copies of the warning background | 0 — `marigold-wash` token |
| Text below 11 px | 13 places at 9–10 px | 0 — `text-2xs` (11 px) |
| Text failing AA contrast | 4 tokens | 0 |
| Controls under 44 px | 36+ | 0 (inline text links exempt) |
