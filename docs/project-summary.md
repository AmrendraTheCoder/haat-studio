# Haat Studio — project summary

**One line:** an AI assistant that turns one photo of a garment into a ready-to-post
Instagram post — the garment worn by a model, with the price and a caption — and
tells a small seller what to post and charge, using only free services.

## The problem

India has millions of small sellers who sell clothes through Instagram and WhatsApp
— home boutiques, resellers, local makers. They compete with brands that have
photoshoots, models, designers and marketing teams. A small seller usually has:

- **Flat photos of the product**, often on a bed or a hanger. Shoppers buy far more
  confidently when they see the garment worn.
- **No budget** for a model shoot (thousands of rupees per day) or a designer.
- **No time or data** to work out what to post, when, and at what price.

## Who uses it (use case)

*Priya runs a kurti business from home in Jaipur. She has 40 new pieces for Diwali.*

1. She photographs a kurti laid flat on her bed with her phone.
2. **Try-on studio:** she uploads it, says it's a top, picks a model. About 15 seconds
   later she has the kurti worn by a model, and compares it with a before/after slider.
3. **Post maker:** she types the name, ₹799 price and ₹999 MRP. The app sets them on
   the photo as a post with "20% off" and "DM to order", in Instagram's 4:5 size, and
   writes a Hinglish caption with hashtags. She downloads it and posts.
4. **Market research:** once, she answers ten questions about her shop. She learns who
   her buyers are, what to post each day this week, that her lowest price leaves
   only a 20% margin, and that Diwali is 13 days away.

What used to need a photographer, a model, a designer and a marketer takes her a
few minutes and costs nothing.

## What we built

| Tool | What it does | Phase |
|---|---|---|
| **Try-on studio** | Garment photo → the same garment on a model. Before/after slider, full-screen, downloads in Instagram's three sizes. | 1–3 |
| **Post maker** | Shop name, price, MRP, offer and call-to-action set as real text on the photo. 3 templates × 3 sizes × 3 colour themes. AI caption and hashtags in English or Hinglish. | 4 |
| **Market research** | Ten-question questionnaire → buyers, trends, pricing advice, content ideas, a 7-day post plan, hashtags, exact profit per piece, upcoming selling days. Printable. | 5 |
| **Deployment** | Production build, Docker image, passcode protection for a public link, deployment guide. | 6 |

Plus: a landing page, real examples, a "how it works" panel that shows each step
live while a photo is made, and a test engine for checking every screen without
using GPU time.

## How it works

```
 Seller's phone/laptop                Our server (Next.js)                       Free services
 ─────────────────────                ────────────────────                       ─────────────
 garment photo  ──────────▶  1. prepare photo (upright, white bg,
                                resize, remove GPS data)
                             2. already made this exact photo?  ── yes ─▶ instant, no GPU
                             3. one job at a time (protect quota)
                             4. try-on engine  ───────────────────────────▶  FASHN VTON 1.5 on
                                                                              Hugging Face GPUs
 live progress  ◀──────────  5. save result                       ◀───────  (≈13 s warm)
 before/after, downloads

 post details   ──────────▶  caption request  ────────────────────────────▶  Groq / Gemini
 post image  (drawn in the browser — exact text, never by an image AI)         (free text AI)

 10 answers     ──────────▶  research report = AI part (checked format)  ───▶  Groq / Gemini
                                              + calculated part (profit, dates)
```

**Technology:** Next.js 16 and React 19 (website and server), TypeScript, Tailwind
CSS, the Gradio client (to call the AI on Hugging Face), sharp (image processing),
zod (checking every input and every AI answer), Vitest (41 automated tests), Docker.

**The AI models (not trained by us):**
- *FASHN VTON 1.5* — an open-source virtual try-on model (Apache-2.0), run on
  Hugging Face's free "ZeroGPU" service.
- *Llama 3.3 70B* (via Groq) or *Gemini 2.5 Flash* — free text AI for captions and research.

Our work is everything around them: preparing inputs, protecting the free quota,
checking outputs, the three tools, and measuring quality.

## What it costs

**₹0.** Hugging Face account, token and daily GPU time are free; Groq and Google
AI Studio keys are free with no card; the website runs on a laptop or a free
Hugging Face Space. When the free GPU time runs out, the app pauses and says when it
refills — it never charges. (The paid alternative, FASHN's API, would cost $0.075 per
photo; we don't use it.)

## Results (measured, 26 Oct 2026)

| Garment | Score /30 | Time |
|---|---|---|
| Black logo T-shirt | 30 — even the logo letters reproduced exactly | 31 s (GPU cold) |
| Navy lace crop top | 28 — shape, colour and lace sleeves kept | 13.5 s |
| White tiered skirt on a model in a dress | 11 — failed: blended into the dress | 13.5 s |
| Same skirt on a model in T-shirt and shorts | 29 | 32 s |

4 of 4 generations succeeded on the free tier. The skirt result taught us that a
bottom can only replace a bottom — so the app now marks each model ✓/✗ for the
chosen garment type and warns before a wasted generation. Full write-up:
[eval-2026-10-26-baseline.md](eval-2026-10-26-baseline.md).

## Engineering decisions worth noting

- **Never show an invented result.** Empty example slots say they're empty; test
  output is labelled and can never be featured; template captions and reports say
  they're templates.
- **Check the AI, don't trust it.** Every AI answer must match a strict format; a
  caption that mentions a price the seller didn't give is thrown away.
- **Maths and dates are code, not AI.** Profit, margins and festival dates are
  calculated, because a language model can get numbers wrong.
- **Text on images is layout, not AI.** Image AIs misspell words and prices, so post
  text is drawn by our own code.
- **Protect the free quota.** Saved results are reused, double clicks are merged,
  one job runs at a time, stuck jobs are cancelled, and a public deployment needs a
  passcode.
- **Privacy.** GPS and camera data are stripped from photos before they leave the server.
- **Problems caught by testing and fixed:** location data in phone photos, wasted
  GPU on re-uploaded photos, test images shown in place of real ones because of
  browser caching, saved shop details wiped on page load, and layouts where long
  prices collided with buttons.

## Honest limits

- The try-on model works at about 576 px width, so large Instagram sizes are enlarged.
- Tested on Western sample garments so far. Kurtis, sarees and lehengas still need
  real photos from sellers (Phase 3). Sarees are likely beyond this model.
- Market research uses the AI's general knowledge — it has no live internet access,
  and the report says so.
- The free GPU allows a handful of photos a day per account.
- One component of the try-on pipeline is licensed for research only, so this is a
  research demo, not a commercial product yet.
- No user accounts yet: results are saved on the server, not per user.

## Five-minute demo script

1. **Home page (30 s).** "Small sellers can't afford model shoots." Drag the hero's
   before/after slider.
2. **Studio (90 s).** Pick the navy crop top sample → Continue → point out the ✓/✗
   model hints → Create. While it runs, read the live "how it's being made" panel
   (upload → prepare → check saved → GPU queue → generate → saved). Show the result
   and drag the slider.
3. **Post maker (60 s).** "Make it a post" → type name, ₹799, MRP ₹999, "Diwali sale" →
   switch Post / Story / Square and the three looks → Write caption (Hinglish) → Download.
4. **Research (60 s).** Open a prepared report: buyers, week plan, the calculated
   profit with its warning, "Diwali in 13 days".
5. **Under the hood (60 s).** The baseline table and the skirt lesson; "₹0 to run";
   41 tests; what's next.

*Before presenting:* generate one photo to warm the GPU, prepare a research report,
and keep the featured examples on the home page as a fallback if the internet is slow.

## What's next

1. Phase 3 with real sellers' garments: kurtis, salwar suits, sarees; Indian model presets.
2. Photo checks before generating (blur, cut-off garment, cluttered background).
3. Sharper output (upscaling) for full-size Instagram posts.
4. Accounts and cloud storage so many sellers can use one deployment.
5. Live web data for research (prices and trends from real listings).
