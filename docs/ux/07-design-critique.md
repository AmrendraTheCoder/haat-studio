# 07 · Design critique

**Stage:** working product, refinement. **Lens:** a small seller on a phone.

## Overall impression

It looks like a craft brand, not a tech tool — warm, confident, honest — and
the core loop (photo → post → share) is short. The biggest remaining
opportunity is **language and first-time guidance**: the UI is English-only for
users who often think in Hindi, and nothing teaches a first-timer what a good
garment photo looks like before they take one.

## Usability

| Finding | Severity | Recommendation |
|---|---|---|
| Posting was buried below downloads on the result | 🔴 → fixed | "Make it a post" is now the primary action |
| UI is English-only | 🟡 open | Add a Hindi toggle; start with the studio's three steps and errors |
| No example of a *good* garment photo before uploading | 🟡 open | Show a small "good vs bad" photo strip in step 1 (flat, whole garment, plain background vs folded, cropped, cluttered) |
| Research is ten questions on one long page | 🟢 open | Fine on desktop; on phones consider one section per screen with a progress bar |
| "New product" clears the current product without undo | 🟢 open | Keep the last product for a few seconds with "Undo" |
| Results are 576 px wide, enlarged for Instagram | 🟡 open | Phase 3 upscaling; until then the download note says so |
| No accounts — results live on one server | 🟡 open | Phase 6+: sign-in and per-seller storage |

## Visual hierarchy

- **What draws the eye first:** the huge lowercase headline, then the
  before/after photo — correct: claim, then proof.
- **Reading flow (studio):** stepper → question headline → the big drop zone →
  choices → bottom action. One clear path per screen.
- **Emphasis:** one ink primary per area; magenta reserved for "After", offers
  and sharing — the moments of payoff. Hints are quieter (ink-3) but now legible.

## Consistency

| Element | Status |
|---|---|
| Buttons | Two variants used everywhere; 44 px; same disabled-with-reason pattern |
| Option groups | Same radio-card component and keyboard behaviour in studio and post maker |
| Notices | Same three tones with the same structure: what happened + what to do |
| Colour | All from tokens (one hard-coded wash removed this pass) |
| Type | Inter + Geist Mono only; one smallest size (11 px) |

## Accessibility

- **Contrast:** all text passes AA after this pass.
- **Touch targets:** all ≥ 44 px.
- **Text readability:** 16 px body on phones; 11 px floor for labels.

## What works well

- **Proof first.** A real, draggable before/after on the home page does more
  than any sentence could.
- **Honest by design.** Placeholders, labelled AI, labelled templates, labelled
  test output, "calculated" vs "AI" in the report — trust is earned, not claimed.
- **Errors that help.** Every failure names the cause and the next step,
  including the exact iPhone setting for HEIC.
- **Waiting that feels like work.** The live pipeline turns 20 seconds of
  uncertainty into a visible process.
- **The seller's numbers are sacred.** Prices are drawn by code and checked in
  AI captions; the discount is calculated, not typed.

## Priority recommendations

1. **Hindi interface** — the biggest barrier for sellers like Meena; start
   with the studio, errors and captions UI.
2. **Test with five real sellers** ([05](05-usability-testing.md) Part B) — every
   persona here is still an assumption.
3. **"Good photo" guidance before upload** — the cheapest way to raise output
   quality is better input; pair with Phase 3 photo checks.
