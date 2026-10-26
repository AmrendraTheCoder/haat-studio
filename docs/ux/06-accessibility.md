# 06 · Accessibility audit

**Standard:** WCAG 2.1 AA (plus 2.5.5 target size, AAA, because users are on
phones) · **Date:** 26 Oct 2026 · **Pages:** `/`, `/studio` (all steps, result,
full screen), `/studio/post`, `/research`, `/research/<id>`

**Method:** an in-page script measured contrast for every text element against
its real background, sizes of every interactive element, accessible names,
labels and landmarks; keyboard checks used real key presses; screen-reader
behaviour was checked through the ARIA tree and live-region output (not yet
with VoiceOver on a device).

## Summary

| | Before | After |
|---|---|---|
| Text styles below contrast minimum | 10 (across 3 pages) | **0** |
| Interactive elements under 44 × 44 px | 36+ | **0** (inline text links exempt) |
| Unnamed links | 3 | **0** |
| Radio groups without arrow-key support | 6 | **0** |
| Silent progress for screen readers | yes | announced per stage |

## Findings and fixes

### Perceivable

| # | Issue | WCAG | Severity | Fix |
|---|---|---|---|---|
| 1 | Grey hint text 4.36:1 on paper (3.86:1 on cards) | 1.4.3 | 🟡 | `ink-3` 52% → 46%: 5.6:1 / 5.0:1 |
| 2 | Green "ready" status 3.61:1 | 1.4.3 | 🟡 | `good` 55% → 45%: 5.5:1 |
| 3 | Red error text 3.91:1 on its wash | 1.4.3 | 🟡 | `danger` 55% → 48%: 5.2:1 |
| 4 | Cream "After" label on magenta 3.81:1 | 1.4.3 | 🟡 | `accent-strong` 58% → 52% |
| 5 | Example photos were links with no name | 1.1.1 / 2.4.4 | 🟡 | `aria-label="Open this example in the studio"` |
| 6 | Text as small as 9 px | 1.4.4 (readability) | 🟢 | 11 px minimum (`text-2xs`) |

### Operable

| # | Issue | WCAG | Severity | Fix |
|---|---|---|---|---|
| 7 | Header/footer links 20 px tall; step tabs 32 px; inputs 38 px; chips 34 px | 2.5.5 | 🟡 | 44 px minimum on buttons, inputs, chips, tabs, links |
| 8 | Radio options: every option a Tab stop, arrows inert | 2.1.1 / ARIA pattern | 🟡 | Roving tab index; arrows/Home/End move and select |
| 9 | Full-screen view: Tab escaped to the page; focus lost on close | 2.4.3 | 🟡 | Focus trap; Esc closes; focus returns to the button |
| 10 | iPhone zoomed the page on input focus | usability on touch | 🟢 | 16 px inputs on phones |

### Understandable

| # | Issue | WCAG | Severity | Fix |
|---|---|---|---|---|
| 11 | Field errors not tied to their fields | 3.3.1 | 🟡 | `aria-invalid` + `aria-describedby` → the error is read with the field |
| 12 | Required `*` read aloud as "star" | 3.3.2 | 🟢 | `*` hidden; `aria-required` on the field |
| 13 | Choice-group errors appeared silently | 3.3.1 | 🟢 | `role="alert"` |

### Robust

| # | Issue | WCAG | Severity | Fix |
|---|---|---|---|---|
| 14 | Generation progress not announced | 4.1.3 | 🟡 | Polite live region, one message per stage |
| 15 | After generating, focus stayed on a button from a previous screen | 2.4.3 | 🟡 | Focus moves to the "Ready to post." heading |
| 16 | Hidden file input exposed to assistive tech | 4.1.2 | 🟢 | `aria-hidden`; the visible button is the control |

## Keyboard map (verified)

| Element | Tab | Enter / Space | Esc | Arrows |
|---|---|---|---|---|
| Drop zone | focusable | opens the file picker | — | — |
| Category / photo type / quality | one stop per group | selects | — | move + select |
| Model cards | one stop | selects | — | move + select |
| Continue / Create | focusable; disabled with reason | acts | — | — |
| Before/after slider | focusable | — | — | ← → 2 %, Shift 10 %, Home/End |
| Full-screen view | trapped inside | buttons act | closes, returns focus | — |
| Post maker size/look/colour | one stop per group | selects | — | move + select |

## Still open

- **Real screen-reader test** with VoiceOver (iOS) and TalkBack (Android).
- **200% zoom and large system text** not yet tested on devices.
- **The post canvas** is an image: it has a label, and every word on it is also
  in the form fields, but the composed post isn't described as a whole.
- **Generated-photo alt text** is generic ("After"); it could name the garment and model.
- **Language:** the interface is English only (`lang="en"`); Hindi content would need `lang="hi"`.
