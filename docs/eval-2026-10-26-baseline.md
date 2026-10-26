# Baseline eval — 26 October 2026

The first real try-ons from Haat Studio. Engine: FASHN VTON 1.5 on its official
Hugging Face ZeroGPU Space, free account token. Settings: Balanced (30 steps),
guidance 1.5, seed 42, flat-lay garment photos. Every request went through
`studio().start()`; the last one went through the app's own `/api/tryon` route.

Photos are not committed (see "Licensing" in the README). They are in
`eval/reports/2026-10-26-07-47-balanced/` and `data/results/` on the machine
that ran them, and the three passing results are featured on the landing page.

## Scores

1 = wrong, 5 = indistinguishable from the product. Scored by eye from full-size
crops, by Claude; to be confirmed by a second person.

| Garment | Model (wearing) | Colour | Print / pattern | Neckline / waist | Sleeves / length | Shape & fit | No artifacts | Total s | Queue s |
|---|---|---|---|---|---|---|---|---|---|
| Black logo tee | Standing · men's (tee + chinos) | 5 | 5 — logo text reproduced exactly | 5 | 5 | 5 | 5 | 30.8 | 4.3 |
| Navy eyelet crop top | Standing · women's (dress) | 5 | 4 — eyelet lace kept on the sleeves, body smoothed | 5 | 5 | 4 | 5 | 13.5 | 3.0 |
| White tiered skirt | Standing · women's (dress) | 3 | 2 | 1 | 2 | 1 | 2 | 13.5 | 3.1 |
| White tiered skirt | Casual · women's (tee + shorts) | 5 | 5 — dot pattern kept | 5 — smocked waistband kept | 5 | 5 | 4 — tee hem reshaped into a band | 31.7 | 4.3 |

## Findings

1. **Free generation works.** Four of four requests returned an image. No quota
   or queue failures on a free account at this volume.
2. **Speed:** about 13 s when the Space's GPU worker is warm, about 30 s when it
   is cold. Queue time was 3–4 s each time.
3. **Tops are strong.** Colour, neckline, sleeve shape and even printed text
   survive. A logo is the hardest test for a generative model and it passed.
4. **Bottoms fail on a model in a dress.** With no separate bottom to replace,
   the skirt blended into the dress (total score 11/30). The same skirt on a
   model in a tee and shorts scored 29/30. The garment was fine; the model
   choice was wrong.
5. **Output size** is 576 px wide; height follows the model photo's aspect
   (576×823 for these presets).

## What changed because of this

- Presets now record what the model is wearing (`separates` or `one-piece`)
  and which categories they suit. The studio marks each preset ✓/✗ for the
  chosen category, warns on a mismatch with a one-click switch to the best
  match, and reminds uploaders that a bottom needs a model in separates.
- The tiered-skirt sample now pairs with the model in shorts.
- Test-engine results now get their own cache keys. Before, an echo test run
  and a real run with the same inputs shared a key — and therefore a URL the
  browser caches forever — so the landing page briefly showed the echo image
  in place of the real black-tee result.

## Next measurements

- Real Indian garments from a seller (kurti, shirt, salwar) on the presets that suit them.
- Fast (20) vs Balanced (30) vs Best (50) steps on the same garment: is the extra GPU time visible?
- A second seed per garment, to see how much results vary.
