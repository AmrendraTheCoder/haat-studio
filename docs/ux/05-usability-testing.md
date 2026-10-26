# 05 · Usability testing

Two parts: what we've already tested and changed (expert walkthroughs with
the real app and real try-ons), and the plan for testing with real sellers —
which hasn't happened yet and is the next step.

## Part A — What we tested (26 Oct 2026)

**Method:** cognitive walkthrough of every flow as each persona, on a 375 × 812
phone viewport and a 1366 px laptop, using the real app with real try-ons on
the free GPU; keyboard-only passes using real key presses; automated
accessibility checks on every page. Sessions run by the developer with Claude —
**not** a substitute for watching real sellers (Part B).

### Tasks walked

| # | Task | Result |
|---|---|---|
| 1 | Upload a garment photo from the phone (incl. wrong files) | ✅ Every wrong file got a specific message *before* upload: tiny image, text file, iPhone HEIC, two files at once |
| 2 | Choose category and photo type | ✅ Continue stays disabled with a reason until a category is chosen; works by arrow keys after the fix below |
| 3 | Pick a model for a skirt | ⚠️ → ✅ Original failure (skirt on a model in a dress blended into the dress, 11/30) led to ✓/✗ suitability and a switch suggestion |
| 4 | Create a photo and wait | ✅ 34 s real run; stages and queue position shown; screen reader hears 5 short updates; focus moves to the result |
| 5 | Leave mid-generation and come back | ✅ Reload reconnects to the running job via the link |
| 6 | Ask for the same photo again | ✅ Instant, "no GPU used" |
| 7 | Free quota runs out (simulated) | ✅ Plain message with the refill time, and three ways forward |
| 8 | Turn the photo into a post and download it | ✅ 1080 × 1350 PNG; long prices and names never collide (after fix) |
| 9 | Get a Hinglish caption | ✅ Gemini caption with the exact price; invented prices are rejected |
| 10 | Fill the research questionnaire, read the report | ✅ Errors per answer; report in ~9 s; calculated vs AI parts labelled |
| 11 | Use the full-screen view by keyboard | ✅ after fix: focus trapped, Esc closes, focus returns |

### What broke, and what we changed

| Finding | Severity | Seen in task | Change | Verified |
|---|---|---|---|---|
| On the result, four download tiles came **before** "Make it a post" — the seller's real goal was buried | 🔴 | 8 | "Make it a post →" moved to the top; downloads relabelled "Or download just the photo" | ✅ |
| Phone users had to download, then find the file, then open Instagram | 🟡 | 8 | "Share to Instagram, WhatsApp…" opens the phone's share sheet; the caption is put on the clipboard | ✅ where the browser supports it |
| No hint of time or cost before pressing Create | 🟡 | 4 | "Takes about 15–30 seconds and uses a little of today's free GPU time." | ✅ |
| Tapping an input on iPhone zoomed the whole page (text < 16 px) | 🟡 | 1, 8, 10 | Inputs are 16 px on phones | ✅ |
| Radio options were separate Tab stops and arrows did nothing | 🟡 | 2 | One Tab stop per group, arrows move and select | ✅ real key presses |
| Full-screen view let Tab escape behind it and lost focus on close | 🟡 | 11 | Focus trap, Esc, focus returns to the opener | ✅ |
| Progress was silent to screen readers | 🟡 | 4 | One polite announcement per stage | ✅ |
| Saved shop details were wiped when the post maker loaded | 🔴 | 8 | Save only after reading what's stored | ✅ |
| Post preview could stay blank in background tabs | 🟡 | 8 | Redraw on a short timer; download redraws first | ✅ |
| Long prices (₹1,29,999 + MRP) ran into the order button | 🟡 | 8 | Panel laid out top-down with the button on its own row | ✅ |
| Research hashtags for kurtis appeared on a tee's caption | 🟢 | 9 | Only the shop's local tags carry over | ✅ |
| A focus ring boxed the "Ready to post." heading after focus moved there | 🟢 | 4 | No ring on headings the app focuses | ✅ |
| Grey hint text, green status and red errors under 4.5:1 contrast | 🟡 | all | Tokens darkened (see [06](06-accessibility.md)) | ✅ |
| Many controls under 44 px | 🟡 | all | 44 px minimum everywhere | ✅ |

## Part B — Plan: testing with real sellers

**Goal:** find out whether real sellers can go from a garment to a posted post
on their own phone, and whether they trust the result enough to post it.

**Participants:** 5 sellers (Nielsen: 5 users find most usability problems) —
2 like Priya (home boutique, ethnic wear), 2 like Imran (reseller), 1 like
Meena (maker, new to apps). Recruit through Instagram DMs and a local market;
offer a free month of posts made for them.

**Setup:** their own phone, their own garment, the deployed link with a
passcode. 30 minutes each, in person or on a video call with screen share.
Think aloud. Recorded with consent.

**Script**

1. *Warm-up (5 min):* "How do you photograph and post a new piece today? What's the hardest part?"
2. *Tasks (20 min), no help unless stuck for 2 minutes:*
   1. "Here's a kurti you sell. Get a photo of it on a model."
   2. "Would you post this? Why or why not?" ← the trust question
   3. "Make it into a post with your price and send it to yourself on WhatsApp."
   4. "Find out what you should post on Wednesday."
3. *Wrap-up (5 min):* "What would stop you using this? What would you pay for?"

**What we measure**

| Measure | Target |
|---|---|
| Task completion without help | ≥ 4 of 5 on tasks 1 and 3 |
| Time from upload to shared post | < 3 minutes |
| "Would you post this photo?" | ≥ 3 of 5 say yes for at least one of their garments |
| Garment fidelity score (colour, print, shape — 1–5) | ≥ 4 average, scored by the seller |
| Errors that needed our help | Every one becomes a fix |

**Synthesis:** affinity-map observations into themes; impact/effort matrix to
pick fixes; update [01-users.md](01-users.md) from proto-personas to real ones.
