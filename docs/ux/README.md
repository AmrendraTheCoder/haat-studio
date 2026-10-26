# Haat Studio — UX & design

How Haat Studio is designed, and why. Start here; each file goes deeper. The same
story, with pictures, is in the app at **/design**.

| File | What's in it |
|---|---|
| [01-users.md](01-users.md) | Who it's for, what they're trying to get done, and the constraints we design around |
| [02-journeys.md](02-journeys.md) | The end-to-end journey from garment to posted, and every state each flow can be in |
| [03-screens.md](03-screens.md) | Screen by screen: what's on it, and why each choice was made |
| [04-design-system.md](04-design-system.md) | Colours, type, components, states, and the voice we write in |
| [05-usability-testing.md](05-usability-testing.md) | How we tested, what broke, what we changed — and the plan for testing with real sellers |
| [06-accessibility.md](06-accessibility.md) | WCAG 2.1 AA audit: before, after, and what's still open |
| [07-design-critique.md](07-design-critique.md) | Structured critique of the current design and the priorities that follow |

## The two-minute version

**Who:** small clothing sellers in India who sell through Instagram and WhatsApp,
mostly from a phone, with no budget for a photoshoot or a designer.

**The job:** *"Help me post this product so it sells — today, without a shoot."*

**What we built for that job — photo, post, plan:**

1. **Photo** — upload a flat garment photo, get it worn by a model.
2. **Post** — put the shop name, price and offer on it, get a caption, share it.
3. **Plan** — answer ten questions, get who buys, what to post and what to charge.

### The principles every screen follows

| Principle | What it means in the product |
|---|---|
| **One decision per screen** | The studio is three steps, not one form. Each step asks one thing. |
| **Never a dead button** | A disabled button always says why, in words, right under it. |
| **Say the cost before the click** | "Takes about 15–30 seconds and uses a little of today's free GPU time." |
| **Show the real work** | The "how it's being made" panel shows only stages the server actually reported. No fake progress bar. |
| **Never invent a result** | Empty example slots say they're empty. Test output is labelled. Template captions say they're templates. |
| **The seller's words are exact** | Prices and shop names are drawn as real text by our code — an AI never retypes them. |
| **Phone first, one hand** | Every control is at least 44 × 44 px; the main action sticks to the bottom of the screen. |
| **Recover, don't scold** | Every error says what happened and offers the next step: try again, change the photo, reconnect. |

### How we know it works

- Walked every flow as a seller would, on a 375 px phone screen and a laptop,
  with real try-ons on real garments (see [05](05-usability-testing.md)).
- Automated WCAG checks on every page: **0 contrast failures and 0 undersized
  controls** after fixes, from 10 low-contrast text styles and 36+ undersized
  controls before — see [06](06-accessibility.md).
- Keyboard-only and screen-reader behaviour verified for the studio, the result
  and the full-screen view.

### What we don't know yet

These documents are honest about it: the personas are **assumptions**, not
findings — no seller has used the app yet. [05](05-usability-testing.md) has the
plan to test with five real sellers, which is the next step for the UX.
