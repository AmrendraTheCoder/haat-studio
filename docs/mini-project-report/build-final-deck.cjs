// The mini-project presentation. Every chart is native PowerPoint and every number comes from
// generated/deck-data.json, which build.py writes from the project's result files.
// When the LoRA comparison has run, slide 11 fills itself in; until then it says "pending".
// Run (after build.py):
//   NODE_PATH=<haat-studio>/node_modules:<dir with pptxgenjs> node build-final-deck.cjs <haat-studio> <out.pptx> <pptx skill dir>
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const [ROOT, OUT, SKILL] = process.argv.slice(2);
const { applyTheme } = require(path.join(SKILL, "scripts/apply_theme.js"));
const R = (p) => path.join(ROOT, p);
const D = JSON.parse(fs.readFileSync(R("docs/mini-project-report/generated/deck-data.json")));
const V = D.V;
const F = D.flags;
const SHOT = (n) => R(`docs/btp-report/figures/team/${n}.png`);

const THEME = {
  name: "Haat Studio",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: { dk1: "1A1512", lt1: "FFFFFF", dk2: "6B5E55", lt2: "F4EEE3", accent1: "C8105A", accent2: "2F6F4E", accent3: "D98E04", accent4: "8A7A6B", accent5: "B9AC9C", accent6: "E6DCCB", hlink: "C8105A", folHlink: "6B5E55" },
};
const H = THEME.colors;
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Garment-to-Model Virtual Try-On for Small Online Sellers";
pres.author = "Amrendra Vikram Singh, Avirat Kaushik";
const C = pres.SchemeColor;

pres.defineSlideMaster({
  title: "TITLE_DARK", background: { color: H.dk1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.7, y: 1.2, w: 8.0, h: 1.9, fontSize: 31, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "Title" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.7, y: 3.15, w: 7.4, h: 1.0, fontSize: 16, color: C.accent6, valign: "top", margin: 0 }, text: "Subtitle" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT", background: { color: H.lt2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.62, w: 12.1, h: 0.72, fontSize: 25, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "Title" } },
    { line: { x: 0.6, y: 6.93, w: 12.13, h: 0, line: { color: H.accent6, width: 0.75 } } },
  ],
  slideNumber: { x: 12.13, y: 7.02, w: 0.6, h: 0.28, fontSize: 9, color: H.accent4, align: "right" },
});

let n = 0;
const nm = (s) => `${s} ${++n}`;
const text = (s, t, o) => s.addText(t, { isTextBox: true, margin: 0, valign: "top", color: C.text1, fontSize: 13, objectName: nm("Text"), ...o });
const box = (s, x, y, w, h, fill = C.background1, line = null) =>
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.06, fill: { color: fill }, line: line ? { color: line, width: 0.75 } : { color: fill, width: 0 }, objectName: nm("Card") });
const kicker = (s, t) => text(s, t, { x: 0.6, y: 0.33, w: 12, h: 0.28, fontSize: 11, bold: true, color: C.accent1, charSpacing: 1.5 });
const source = (s, t) => text(s, t, { x: 0.6, y: 7.0, w: 11.3, h: 0.3, fontSize: 9, color: C.accent4, valign: "middle" });
const stat = (s, big, label, x, y, w, h, color = C.accent1, size = 26) => {
  box(s, x, y, w, h);
  text(s, big, { x: x + 0.18, y: y + 0.1, w: w - 0.36, h: 0.6, fontSize: size, bold: true, color, fontFace: "Arial", valign: "middle" });
  text(s, label, { x: x + 0.18, y: y + 0.72, w: w - 0.36, h: h - 0.8, fontSize: 11, color: C.text2 });
};
const arrowR = (s, x, y, color = C.accent4) => s.addShape(pres.ShapeType.triangle, { x, y, w: 0.2, h: 0.15, rotate: 90, fill: { color }, line: { color, width: 0 }, objectName: nm("Arrow") });
const arrowD = (s, x, y, color = C.accent4) => s.addShape(pres.ShapeType.triangle, { x, y, w: 0.2, h: 0.13, rotate: 180, fill: { color }, line: { color, width: 0 }, objectName: nm("Arrow") });
const bullets = (s, items, o) => text(s, items.map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })), { fontSize: 12, paraSpaceAfter: 4, ...o });
const axis = () => ({
  catAxisLabelColor: H.dk2, valAxisLabelColor: H.dk2, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
  dataLabelFontFace: "+mn-lt", dataLabelFontSize: 9, dataLabelColor: H.dk1, legendFontFace: "+mn-lt", legendFontSize: 10, legendColor: H.dk2, titleFontFace: "+mn-lt", titleFontSize: 12, titleColor: H.dk1,
  valGridLine: { color: H.accent6, size: 0.5 }, catGridLine: { style: "none" }, catAxisLineColor: H.accent5, valAxisLineShow: false,
  plotArea: { fill: { color: H.lt1 } }, chartArea: { fill: { color: H.lt1 }, roundedCorners: false },
});
const sizes = {};
const img = (s, file, x, y, w, alt) => {
  const m = sizes[file];
  const h = (w * m.height) / m.width;
  s.addShape(pres.ShapeType.rect, { x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06, fill: { color: H.accent6 }, line: { color: H.accent5, width: 0.5 }, objectName: nm("Frame") });
  s.addImage({ path: file, x, y, w, h, altText: alt, objectName: nm("Image") });
  return h;
};
const rs = (x) => `₹${Number(x).toLocaleString("en-IN")}`;

(async () => {
  const sharp = require("sharp");
  const files = { ba: SHOT("shot-beforeafter"), saved: SHOT("shot-saved"), numbers: SHOT("shot-numbers"), sheet: R("ml/data/pairs/pairs-sheet.jpg"), skirt: R("docs/btp-report/figures/skirt-on-separates.jpg"),
    uiReview: R("docs/btp-report/figures/ui/studio-review.png"), uiResult: R("docs/btp-report/figures/ui/studio-result.png"), uiProduct: R("docs/btp-report/figures/ui/studio-product.png") };
  for (const [k, f] of Object.entries(files)) if (fs.existsSync(f)) sizes[f] = await sharp(f).metadata();

  // 1 ------------------------------------------------------------------ title
  let s = pres.addSlide({ masterName: "TITLE_DARK" });
  text(s, "MINI PROJECT · 5TH SEMESTER · LNMIIT JAIPUR", { x: 0.7, y: 0.65, w: 8, h: 0.3, fontSize: 11, bold: true, color: C.accent5, charSpacing: 1.5 });
  s.addText("Garment-to-Model Virtual Try-On\nfor Small Online Sellers", { placeholder: "title" });
  s.addText("A serving system for FASHN VTON 1.5, a LoRA adaptation pipeline, and catalogue-driven content engines", { placeholder: "body" });
  text(s, [
    { text: "Amrendra Vikram Singh", options: { bold: true, color: C.background1 } }, { text: "   24UEC092", options: { color: C.accent5, breakLine: true } },
    { text: "Avirat Kaushik", options: { bold: true, color: C.background1 } }, { text: "   24UCS235", options: { color: C.accent5, breakLine: true } },
    { text: " ", options: { fontSize: 6, breakLine: true } },
    { text: "Guide: Dr. Nishant Gupta", options: { color: C.accent6 } },
  ], { x: 0.7, y: 4.75, w: 7, h: 1.6, fontSize: 15, paraSpaceAfter: 3 });
  const baH = 6.0, baW = (baH * sizes[files.ba].width) / sizes[files.ba].height;
  s.addImage({ path: files.ba, x: 12.63 - baW, y: 0.7, w: baW, h: baH, altText: "The app's before-and-after view of a real try-on", objectName: nm("Image") });
  text(s, "A real result: before | after", { x: 12.63 - baW, y: 6.8, w: baW, h: 0.3, fontSize: 11, color: C.accent5, align: "center" });
  s.addNotes("Introduce the team and the guide. One sentence: a seller's flat garment photo becomes an on-model photo, an Instagram post and a pricing plan, on free services; we also built the pipeline to adapt the try-on model to the seller's own garments.");

  // 2 ------------------------------------------------------------------ problem
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "THE PROBLEM");
  s.addText("A seller has one flat photo. A buyer wants to see it worn.", { placeholder: "title" });
  const probs = [["Photo", "A model shoot costs thousands of rupees a day. We generate the on-model photo from the flat one.", "Try-on studio"], ["Post", "The photo becomes an Instagram post: price, MRP, offer and a caption in English, Hinglish or Hindi.", "Post maker"], ["Plan", "Who buys, at what price, which words and hashtags, and when to post, with every number computed in code.", "Research + engines"]];
  probs.forEach(([hd, b, tag], i) => {
    const x = 0.6 + i * 2.85;
    box(s, x, 1.65, 2.65, 3.2);
    text(s, String(i + 1), { x: x + 0.22, y: 1.8, w: 0.5, h: 0.5, fontSize: 24, bold: true, color: C.accent1 });
    text(s, hd, { x: x + 0.22, y: 2.35, w: 2.2, h: 0.45, fontSize: 20, bold: true });
    text(s, b, { x: x + 0.22, y: 2.85, w: 2.25, h: 1.5, fontSize: 12, color: C.text2 });
    text(s, tag, { x: x + 0.22, y: 4.4, w: 2.2, h: 0.3, fontSize: 11, bold: true, color: C.accent2 });
    if (i < 2) arrowR(s, x + 2.68, 3.15);
  });
  stat(s, `${V.MedTotal} s`, "median time for a new photo on the free GPU", 9.3, 1.65, 3.43, 1.0);
  stat(s, "₹0", "every service used is a free tier", 9.3, 2.75, 3.43, 1.0, C.accent2);
  stat(s, "972M", "parameters in the open try-on model we serve and adapt", 9.3, 3.85, 3.43, 1.0, C.text1);
  box(s, 0.6, 5.1, 12.13, 1.65, C.text1);
  text(s, "Three problems this project solves", { x: 0.85, y: 5.2, w: 6, h: 0.35, fontSize: 13, bold: true, color: C.accent3 });
  bullets(s, ["Generate the photo for free, on a shared GPU with a tiny, partly unpublished daily quota", "Adapt the model to the seller's own garments, although it was released without training code", "Turn the photo into a post and a price the seller can trust: no invented prices, no wrong arithmetic"], { x: 0.85, y: 5.58, w: 11.6, h: 1.1, color: C.background1 });
  s.addNotes("Photo, post, plan. The model is FASHN AI's open model; our work is the system around it, the training method it lacked, the adaptation pipeline, and the content engines.");

  // 2b ----------------------------------------------------------------- the product
  if (sizes[files.uiReview] && sizes[files.uiResult]) {
    s = pres.addSlide({ masterName: "CONTENT" });
    kicker(s, "THE PRODUCT");
    s.addText("A guided studio: choose, review, create, check", { placeholder: "title" });
    const shotW = 5.95;
    const h1 = img(s, files.uiReview, 0.6, 1.6, shotW, "The Review step: every choice with an Edit link, the time and the free quota it will use");
    const h2 = img(s, files.uiResult, 6.78, 1.6, shotW, "The result screen with the before/after slider and the quality checks");
    text(s, [{ text: "Review before anything is spent. ", options: { bold: true } }, { text: "Every choice with an Edit link; time and the free quota it will use." }], { x: 0.6, y: 1.72 + h1, w: shotW, h: 0.55, fontSize: 11.5, color: C.text2 });
    text(s, [{ text: "Checked before it is shown. ", options: { bold: true } }, { text: "Five quality checks on every photo; here a correct warning on a skirt over a dress." }], { x: 6.78, y: 1.72 + h2, w: shotW, h: 0.55, fontSize: 11.5, color: C.text2 });
    box(s, 0.6, 6.15, 12.13, 0.62, C.text1);
    text(s, `Sidebar app · 38 sample garments with search · model filters · "?" help on every control · English and Hindi · ${D.tests.app} automated tests`, { x: 0.85, y: 6.15, w: 11.7, h: 0.62, fontSize: 12, color: C.background1, valign: "middle" });
    source(s, "Screenshots of the running application (Next.js 16, localhost). Report section 3.8.");
    s.addNotes("This is the product sellers use. The studio guides them through product, model and a review step that shows exactly what will be spent before anything runs. Every result goes through automatic quality checks; here the app correctly warns that a skirt put on a model in a dress may not look right.");
  }

  // 3 ------------------------------------------------------------------ pipeline
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "THE PIPELINE, END TO END");
  s.addText("Three pipelines share one codebase", { placeholder: "title" });
  const lane = (y, label, col, steps) => {
    text(s, label, { x: 0.6, y, w: 1.75, h: 1.2, fontSize: 13, bold: true, color: col, valign: "middle" });
    const w = (12.73 - 2.45 - (steps.length - 1) * 0.25) / steps.length;
    steps.forEach(([hd, sub], i) => {
      const x = 2.45 + i * (w + 0.25);
      box(s, x, y, w, 1.2, i === steps.length - 1 ? C.text1 : C.background1);
      text(s, [{ text: hd, options: { bold: true, fontSize: 12, breakLine: true, color: i === steps.length - 1 ? C.background1 : C.text1 } }, { text: sub, options: { fontSize: 10, color: i === steps.length - 1 ? C.accent6 : C.text2 } }], { x: x + 0.1, y, w: w - 0.2, h: 1.2, align: "center", valign: "middle" });
      if (i < steps.length - 1) arrowR(s, x + w + 0.03, y + 0.52);
    });
  };
  lane(1.6, "Photo\n(serving)", C.accent1, [["API route", "passcode, settings, photos"], ["prepareImage", "upright, white, ≤1536 px, no GPS"], ["studio.start", "key → running? → saved? → lock"], ["FASHN VTON 1.5", "free ZeroGPU, Gradio"], ["Save + stream", "NDJSON, live events"]]);
  lane(3.35, "Model\n(adaptation)", C.accent3, [["Retail catalogue", "listings + photos"], ["build_pairs", "pose + image guardrails"], ["train_lora", "96 adapters, 1% params"], ["evaluate + compare", "base vs LoRA, 95% CI"], ["Adapter", `${V.AdapterMb} MB → new engine`]]);
  lane(5.1, "Plan\n(content)", C.accent2, [["Catalogue analysis", "clean, demand, tiers"], ["Engines", "price, title, hashtags, GEO"], ["completeJSON", "validated text AI"], ["Guardrails", "price check, maths in code"], ["Post + plan", "for the seller"]]);
  source(s, "Code: src/lib/tryon (serving), ml/ (adaptation), analysis/ and src/lib/llm (content). Report chapters 3–6.");
  s.addNotes("Walk the three lanes. Top: how one photo is made. Middle: how the model is adapted offline, ending in an adapter that becomes a new engine. Bottom: how the post and the plan are made; numbers always come from code.");

  // 4 ------------------------------------------------------------------ orchestration + timing
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "SERVING THE MODEL");
  s.addText(`One entry point, cheapest check first: a new photo takes ${V.MedTotal} s`, { placeholder: "title" });
  const st5 = [["1", "Make the key", "sha256 of photos + settings"], ["2", "Already running?", "join that job: no 2nd GPU run"], ["3", "Already saved?", `answer in ${V.CacheMs} ms, no GPU`], ["4", "GPU lock", "one generation at a time"], ["5", "Engine chain", "FASHN; errors sorted by kind"]];
  st5.forEach(([k, hd, sub], i) => {
    const y = 1.62 + i * 0.66;
    box(s, 0.6, y, 4.6, 0.56, i === 2 ? C.text1 : C.background1);
    text(s, k, { x: 0.75, y, w: 0.35, h: 0.56, fontSize: 15, bold: true, color: C.accent1, valign: "middle" });
    text(s, [{ text: hd, options: { bold: true, breakLine: true, color: i === 2 ? C.background1 : C.text1 } }, { text: sub, options: { fontSize: 10, color: i === 2 ? C.accent6 : C.text2 } }], { x: 1.15, y, w: 3.95, h: 0.56, fontSize: 12, valign: "middle" });
  });
  box(s, 0.6, 5.05, 4.6, 1.7);
  text(s, "When something fails", { x: 0.8, y: 5.12, w: 4.2, h: 0.3, fontSize: 12, bold: true });
  bullets(s, ["Bad photo → stop: every engine would reject it", "Quota, timeout, outage → try the next engine", "240 s limit → cancel our place in the queue", "All attempts → one sentence for the seller"], { x: 0.8, y: 5.45, w: 4.3, h: 1.25, fontSize: 11 });
  s.addChart(pres.charts.BAR, [{ name: "Waiting in the queue", labels: D.runs.labels, values: D.runs.queue }, { name: "Running on the GPU", labels: D.runs.labels, values: D.runs.gpu }], {
    x: 5.45, y: 1.6, w: 7.28, h: 5.15, barDir: "bar", barGrouping: "stacked", chartColors: [H.accent3, H.accent1], barGapWidthPct: 45, showValue: true, dataLabelPosition: "ctr", dataLabelColor: H.lt1, dataLabelFormatCode: "0.0",
    showLegend: true, legendPos: "t", showTitle: true, title: `All ${V.NRuns} real generations: seconds from Create to finished`, catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: 40, valAxisMajorUnit: 10, ...axis(), objectName: nm("Chart"),
  });
  source(s, `Source: data/results/*/meta.json, 26–27 Oct 2026. Median ${V.MedGpu} s running on the GPU, ${V.MedQueue} s in the queue.`);
  s.addNotes("Every try-on goes through studio.start, so no route can skip these checks. A double click joins the running job; a repeat request comes from disk; only then do we wait for the GPU. The chart is all ten real photos: amber is waiting, magenta is the model running.");

  // 5 ------------------------------------------------------------------ cache + quota
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "PROTECTING THE FREE GPU");
  s.addText(`Repeat requests are free; the hidden daily limit is ${V.RunsLimit} photos`, { placeholder: "title" });
  s.addChart(pres.charts.BAR, [{ name: "ms", labels: [`Saved result: ${V.CacheMs} ms`, `New photo: ${Number(D.cache[1]).toLocaleString("en-US")} ms`], values: D.cache }], {
    x: 0.6, y: 1.6, w: 5.9, h: 2.4, barDir: "bar", chartColors: [H.accent2, H.accent1], showValue: false, valAxisLogScaleBase: 10, valAxisMinVal: 0.01, valAxisMaxVal: 100000, valAxisLabelFormatCode: "#,##0.##",
    showLegend: false, barGapWidthPct: 50, showTitle: true, title: "Time to answer, ms (log scale)", ...axis(), objectName: nm("Chart"),
  });
  const hs = img(s, files.saved, 0.65, 4.2, 3.2, "The app saying: No GPU used, loaded from saved photos");
  text(s, `About ${V.CacheRatio}× faster than a new photo. The key is a hash of both photos and the settings, so a clean JPEG is never re-saved.`, { x: 4.05, y: 4.2, w: 2.45, h: hs + 0.6, fontSize: 11, color: C.text2 });
  text(s, `${V.NPrepUntouched} of ${V.NPrepPhotos} photos in our runs passed through untouched; the rest were rotated, resized or stripped of GPS data.`, { x: 0.6, y: 5.35, w: 5.9, h: 0.6, fontSize: 11, color: C.text2 });
  s.addChart(pres.charts.LINE, [{ name: "left by GPU time (300 s/day, 60 s reserved)", labels: D.quota.x.map(String), values: D.quota.byTime }, { name: `left by run limit (learned: ${D.quota.limit})`, labels: D.quota.x.map(String), values: D.quota.byRuns }], {
    x: 6.8, y: 1.6, w: 5.93, h: 4.35, chartColors: [H.accent3, H.accent1], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6, showLegend: true, legendPos: "b", valAxisMinVal: 0, valAxisMaxVal: 10, valAxisMajorUnit: 2,
    showTitle: true, title: "Photos left in the day, after each photo made", showCatAxisTitle: true, catAxisTitle: "photos made today", catAxisTitleFontSize: 10, catAxisTitleColor: H.dk2, ...axis(), objectName: nm("Chart"),
  });
  box(s, 6.8, 6.08, 5.93, 0.72, C.text1);
  text(s, `Real: Hugging Face refused our 9th photo on 26 Oct after only ${V.UsedAtRefusal} s of GPU time ("runs limit"). The app read the message and now shows about ${V.RunsLimit} photos a day.`, { x: 6.98, y: 6.08, w: 5.6, h: 0.72, fontSize: 11, color: C.background1, valign: "middle" });
  source(s, "Source: cache time measured 26 Nov 2026 (25 look-ups); data/gpu-quota.json; src/lib/quota.ts.");
  s.addNotes("The cache answers a repeat request in a third of a millisecond. The quota: each call must have 60 seconds free to start and uses about 26. By time the day allows 10 photos, but Hugging Face also has an unpublished run limit; it refused our ninth photo, and the app learned the limit from that message.");

  // 6 ------------------------------------------------------------------ the model
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "THE MODEL (FASHN AI'S), LAYER BY LAYER");
  s.addText("How the garment gets onto the person: it is read, not pasted", { placeholder: "title" });
  const lay = [["Person stream", "noisy image + photo + pose\n7 channels → 3,456 tokens", C.background1], ["Garment stream", "garment photo + pose\n4 channels → 3,456 tokens", C.background1], ["4 patch-mixer blocks", "person tokens only", C.background1], ["8 double-stream blocks", "ONE joint attention over all 6,912 tokens", C.text1], ["16 single-stream blocks", "both sequences, shared weights", C.background1], ["Final layer", "person tokens → velocity image", C.background1]];
  box(s, 0.6, 1.65, 3.0, 0.95, lay[0][2]); text(s, [{ text: lay[0][0], options: { bold: true, breakLine: true } }, { text: lay[0][1], options: { fontSize: 10, color: C.text2 } }], { x: 0.7, y: 1.65, w: 2.8, h: 0.95, fontSize: 12, align: "center", valign: "middle" });
  box(s, 3.85, 1.65, 3.0, 0.95, lay[1][2]); text(s, [{ text: lay[1][0], options: { bold: true, breakLine: true } }, { text: lay[1][1], options: { fontSize: 10, color: C.text2 } }], { x: 3.95, y: 1.65, w: 2.8, h: 0.95, fontSize: 12, align: "center", valign: "middle" });
  box(s, 0.6, 2.85, 3.0, 0.6); text(s, [{ text: lay[2][0], options: { bold: true, breakLine: true } }, { text: lay[2][1], options: { fontSize: 10, color: C.text2 } }], { x: 0.7, y: 2.85, w: 2.8, h: 0.6, fontSize: 12, align: "center", valign: "middle" });
  arrowD(s, 2.0, 2.66); arrowD(s, 2.0, 3.5); arrowD(s, 5.25, 3.5);
  [[3, 3.7, C.text1], [4, 4.55, C.background1], [5, 5.4, C.background1]].forEach(([i, y, fill], j) => {
    box(s, 0.6, y, 6.25, 0.65, fill);
    const dark = fill === C.text1;
    text(s, [{ text: lay[i][0] + "   ", options: { bold: true, color: dark ? C.accent3 : C.text1 } }, { text: lay[i][1], options: { fontSize: 11, color: dark ? C.background1 : C.text2 } }], { x: 0.8, y, w: 5.9, h: 0.65, fontSize: 13, valign: "middle", align: "center" });
    if (j < 2) arrowD(s, 3.63, y + 0.68);
  });
  text(s, "Red in the report's diagram = where our LoRA adapters attach (double- and single-stream blocks).", { x: 0.6, y: 6.15, w: 6.25, h: 0.6, fontSize: 10.5, italic: true, color: C.accent2 });
  stat(s, "6,912", "tokens per pass: two images in 12×12-pixel patches, raw pixels, no VAE, so logo text survives", 7.15, 1.65, 2.7, 1.55);
  stat(s, "60", "image passes per photo: 30 rectified-flow steps, each run with and without the garment (guidance 1.5)", 10.03, 1.65, 2.7, 1.55, C.text1);
  box(s, 7.15, 3.35, 5.58, 3.4);
  text(s, "Why colour stays true (no separate colour step)", { x: 7.35, y: 3.45, w: 5.2, h: 0.35, fontSize: 13, bold: true });
  bullets(s, ["The garment's real pixel values enter the network directly", "Guidance pushes every step towards the garment", "The last step runs without guidance, so colour does not over-saturate", "Joint attention: a chest token reads the garment token that holds the logo; nothing is warped or pasted", "Segmentation-free mode: the model decides what to replace, which is why a skirt needs a model in separates"], { x: 7.35, y: 3.85, w: 5.2, h: 2.85, fontSize: 11.5 });
  source(s, "Source: fashn-vton 1.5.0 source (tryon_mmdit.py, pipeline.py); 971,813,808 parameters counted on the released weights. Report chapter 4.");
  s.addNotes("The network is FASHN AI's. Both photos are cut into small squares; in the eight double-stream blocks every square of the person can look at every square of the garment, which is how the logo ends up on the chest. Generation goes from noise to photo in 30 steps; each step runs twice for guidance, so 60 passes.");

  // 7 ------------------------------------------------------------------ objective proof
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "MAKING THE MODEL TRAINABLE");
  s.addText(`The missing training method, rebuilt and proved: ${V.LossRatio}× lower loss`, { placeholder: "title" });
  s.addChart(pres.charts.BAR, [{ name: "Reconstructed objective (ours)", labels: D.recon.t.map((t) => `t = ${t}`), values: D.recon.ours }, { name: "Reversed convention", labels: D.recon.t.map((t) => `t = ${t}`), values: D.recon.rev }], {
    x: 0.6, y: 1.6, w: 6.9, h: 5.15, barDir: "col", chartColors: [H.accent2, H.accent3], showLegend: true, legendPos: "b", valAxisLogScaleBase: 10, valAxisMinVal: 0.001, valAxisMaxVal: 10,
    showTitle: true, title: "Loss of the released, untouched model (log scale)", ...axis(), objectName: nm("Chart"),
  });
  box(s, 7.8, 1.65, 4.93, 2.3, C.text1);
  text(s, [{ text: "The objective (from the sampler)", options: { bold: true, color: C.accent3, breakLine: true } },
    { text: "x_t = (1 − t)·noise + t·photo", options: { fontFace: "Courier New", color: C.background1, breakLine: true } },
    { text: "target velocity = photo − noise", options: { fontFace: "Courier New", color: C.background1, breakLine: true } },
    { text: "loss weight: garment pixels ×2, padding ×0 (our design)", options: { color: C.accent6, fontSize: 11 } }], { x: 8.0, y: 1.75, w: 4.55, h: 2.1, fontSize: 13, paraSpaceAfter: 6 });
  const pf = [[`${V.LossRatio}×`, "lower loss under our convention on the real weights"], [V.EquivDiff, "difference (of 255) between our code and FASHN's: identical"], [V.ParserDiff, "change when the non-commercial parser is removed: not needed"]];
  pf.forEach(([b, l], i) => {
    const y = 4.12 + i * 0.9;
    box(s, 7.8, y, 4.93, 0.8);
    text(s, String(b), { x: 7.95, y, w: 1.3, h: 0.8, fontSize: 22, bold: true, color: C.accent2, valign: "middle" });
    text(s, l, { x: 9.3, y, w: 3.3, h: 0.8, fontSize: 11, color: C.text2, valign: "middle" });
  });
  source(s, "Source: ml/runs/real-check/report.json (checks on the released weights, Apple M3). Report chapters 5.2 and 7.4.");
  s.addNotes("FASHN released no training code. The sampler tells us what the model was trained to predict: the direction from noise to photo. Proof: the untouched model's loss is tiny under our convention and 863 times higher under the opposite one. A trained model is only good at the task it was trained on.");

  // 8 ------------------------------------------------------------------ LoRA layering
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "WHAT WE ADDED: LoRA ADAPTER LAYERS");
  s.addText(`${V.LoraLayers} trainable layers beside the frozen model: ${V.LoraPct}% of it`, { placeholder: "title" });
  box(s, 0.6, 1.6, 5.6, 3.4);
  const blk = (label, sub, x, y, w, fill, col) => { s.addShape(pres.ShapeType.roundRect, { x, y, w, h: 0.85, rectRadius: 0.06, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: nm("Block") }); text(s, [{ text: label, options: { bold: true, breakLine: true } }, { text: sub, options: { fontSize: 10 } }], { x, y, w, h: 0.85, align: "center", valign: "middle", fontSize: 13, color: col }); };
  text(s, "x", { x: 0.8, y: 3.0, w: 0.4, h: 0.4, fontSize: 16, bold: true, valign: "middle" });
  blk("Frozen layer W", "original weights", 1.6, 1.95, 2.8, C.text1, C.background1);
  blk("A", "in → 16", 1.6, 3.75, 1.25, C.accent1, C.background1);
  blk("B", "16 → out, starts at 0", 3.05, 3.75, 1.35, C.accent1, C.background1);
  arrowR(s, 1.3, 3.13); arrowR(s, 4.55, 2.28); arrowR(s, 4.55, 4.08);
  s.addShape(pres.ShapeType.ellipse, { x: 4.95, y: 2.95, w: 0.55, h: 0.55, fill: { color: C.accent2 }, line: { color: C.accent2, width: 0 }, objectName: nm("Plus") });
  text(s, "+", { x: 4.95, y: 2.95, w: 0.55, h: 0.55, fontSize: 20, bold: true, color: C.background1, align: "center", valign: "middle" });
  text(s, "y", { x: 5.65, y: 3.0, w: 0.4, h: 0.4, fontSize: 16, bold: true, valign: "middle" });
  text(s, "y = W·x + (α/r)·B·A·x,  r = 16. B starts at zero, so training starts from exactly the original model.", { x: 0.8, y: 4.65, w: 5.2, h: 0.32, fontSize: 10.5, color: C.text2 });
  s.addTable([
    [{ text: "Where", options: { bold: true, color: H.lt1, fill: { color: H.dk1 } } }, { text: "Layers", options: { bold: true, color: H.lt1, fill: { color: H.dk1 } } }, { text: "Adapters", options: { bold: true, color: H.lt1, fill: { color: H.dk1 } } }, { text: "Parameters", options: { bold: true, color: H.lt1, fill: { color: H.dk1 }, align: "right" } }],
    ["8 double-stream", "QKV, output, MLP ×2, both streams", "64", { text: "5,242,880", options: { align: "right" } }],
    ["16 single-stream", "fused linear1, linear2", "32", { text: "4,587,520", options: { align: "right" } }],
    [{ text: "Total", options: { bold: true } }, "", { text: String(V.LoraLayers), options: { bold: true } }, { text: V.TrainParams, options: { bold: true, align: "right" } }],
  ], { x: 6.5, y: 1.6, w: 6.23, colW: [1.55, 2.38, 0.95, 1.35], fontSize: 11, fontFace: "Calibri", color: H.dk1, fill: { color: H.lt1 }, border: { type: "solid", color: H.accent6, pt: 0.75 }, rowH: 0.42, objectName: nm("Table") });
  box(s, 6.5, 3.55, 6.23, 1.45);
  text(s, "Three decisions specific to this model", { x: 6.7, y: 3.6, w: 5.9, h: 0.3, fontSize: 12, bold: true });
  bullets(s, ["Adapters in float32 over a bf16 model: small updates vanish in bf16", "Modulation layers frozen: they drive every sampling step", "New categories (saree = 4, lehenga = 5) start as copies of one-pieces"], { x: 6.7, y: 3.92, w: 5.95, h: 1.05, fontSize: 11 });
  stat(s, `${V.TrainParamsM}M`, "trainable parameters out of 972M", 0.6, 5.2, 3.95, 1.55);
  stat(s, `${V.AdapterMb} MB`, `adapter file, ${V.AdapterPct}% of the ${V.BaseMb} MB model`, 4.69, 5.2, 3.95, 1.55, C.accent2);
  stat(s, "2× loss", "on garment pixels: a wrong print is a wrong product (our loss design)", 8.78, 5.2, 3.95, 1.55, C.text1);
  source(s, "Source: ml/haat_ft/lora.py; parameter count on the real model (ml/runs/microrun/report.json). Report chapter 5.3.");
  s.addNotes("This is what 'adding layers' means precisely: beside 96 existing layers we add two small matrices A and B. The original 972 million weights never change. Only 1% of the parameters train, and the result is a 37.5 MB file that can be merged in or removed.");

  // 9 ------------------------------------------------------------------ compute cost
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "COMPUTE COST OF ADAPTING THE MODEL");
  s.addText(`Training memory falls ${V.StateRatio}× with LoRA; running the model costs the same`, { placeholder: "title" });
  s.addChart(pres.charts.BAR, [{ name: "GB", labels: ["Full fine-tune", "LoRA (ours)"], values: [D.compute.full_gb, D.compute.lora_gb] }], {
    x: 0.6, y: 1.6, w: 4.0, h: 4.3, barDir: "col", chartColors: [H.accent5, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '0.0" GB"', showLegend: false, valAxisMinVal: 0,
    showTitle: true, title: "Training state in memory\n(weights + gradients + Adam)", ...axis(), objectName: nm("Chart"),
  });
  s.addChart(pres.charts.BAR, [{ name: "MB", labels: ["Full model", "LoRA adapter"], values: [D.compute.base_mb, D.compute.adapter_mb] }], {
    x: 4.8, y: 1.6, w: 4.0, h: 4.3, barDir: "col", chartColors: [H.accent5, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '#,##0.0" MB"', showLegend: false, valAxisMinVal: 0,
    showTitle: true, title: "What has to be stored or shipped", ...axis(), objectName: nm("Chart"),
  });
  box(s, 9.05, 1.6, 3.68, 4.3);
  text(s, "Read it correctly", { x: 9.25, y: 1.7, w: 3.3, h: 0.35, fontSize: 13, bold: true, color: C.accent1 });
  bullets(s, ["LoRA makes TRAINING cheaper: one 16 GB GPU is enough", "It does not make a photo faster: still 60 passes through 972M parameters", "Merged after training, the adapter adds zero inference cost", "The 2.1 GB is mostly the frozen bf16 model itself"], { x: 9.25, y: 2.1, w: 3.35, h: 3.7, fontSize: 12, paraSpaceAfter: 8 });
  box(s, 0.6, 6.05, 12.13, 0.72, C.text1);
  text(s, "Measured on our 8 GB laptop: LoRA training runs at half resolution (7 s/step, 3.26 GB); a full-resolution step did not fit (8.6 GB of swap, no step in 8 min). Full training needs a CUDA GPU ≥ 16 GB.", { x: 0.8, y: 6.05, w: 11.7, h: 0.72, fontSize: 11.5, color: C.background1, valign: "middle" });
  source(s, "Computed from parameter counts (16 bytes per trained parameter: fp32 weight, gradient, Adam m and v; 2 bytes per frozen bf16 parameter); activations excluded.");
  s.addNotes("Be precise here. LoRA cuts the cost of training and shipping the change, not the cost of making a photo. Full fine-tuning would need about 15.7 GB just for weights, gradients and optimiser state; LoRA needs about 2.1 GB, most of it the frozen model.");

  // 10 ----------------------------------------------------------------- data pipeline + guardrails
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "DATA FOR THE NEW MODEL: POSE AND IMAGE GUARDRAILS");
  s.addText(F.ifPairs ? `${V.PairsN} guarded training pairs from ${V.PairsProducts} products; no split leak` : "Catalogue photos become training pairs only through guardrails", { placeholder: "title" });
  const rules = ["Detector confidence ≥ 0.6: no 'person' found inside a print", "One person; shoulders and hips inside the frame: no close-ups", "Face visible and body facing the camera: no back views", "Shoulder width ≥ 0.45 × torso; person ≥ 45% of the height", "Garment-only: light plain backdrop, ≤ 2 edges touched: no swatches", "Same photo never in two products; split by product family"];
  box(s, 0.6, 1.6, 4.9, 3.85);
  text(s, "Guardrails (each one fixed a real failure)", { x: 0.8, y: 1.68, w: 4.5, h: 0.3, fontSize: 12, bold: true });
  bullets(s, rules, { x: 0.8, y: 2.02, w: 4.55, h: 3.35, fontSize: 11, paraSpaceAfter: 5 });
  if (F.ifPairs) {
    s.addChart(pres.charts.BAR, [{ name: "count", labels: D.pairs.stages, values: D.pairs.values }], {
      x: 5.75, y: 1.6, w: 3.4, h: 3.85, barDir: "col", chartColors: [H.accent5, H.accent1, H.accent3, H.accent2], showValue: true, dataLabelPosition: "outEnd", showLegend: false, showTitle: true, title: "Photos → pairs", ...axis(), objectName: nm("Chart"),
    });
    s.addChart(pres.charts.BAR, [{ name: "rejected", labels: D.pairs.reasons.map((r) => r[0]), values: D.pairs.reasons.map((r) => r[1]) }], {
      x: 9.35, y: 1.6, w: 3.38, h: 3.85, barDir: "bar", chartColors: [H.accent3], showValue: true, dataLabelPosition: "outEnd", showLegend: false, showTitle: true, title: "Why photos were rejected", catAxisLabelFontSize: 8, ...axis(), objectName: nm("Chart"),
    });
  } else {
    box(s, 5.75, 1.6, 6.98, 3.85, C.background1, H.accent5);
    text(s, "Pair counts appear here when the full run's qc.json exists.", { x: 5.95, y: 3.2, w: 6.6, h: 0.6, fontSize: 14, color: C.text2, align: "center" });
  }
  if (fs.existsSync(files.sheet) && sizes[files.sheet]) {
    // first row of the contact sheet (4 pairs), at its true proportions
    const m = sizes[files.sheet], rowH = m.height / 2;
    const row = await sharp(files.sheet).extract({ left: 0, top: 0, width: m.width, height: Math.round(rowH) }).jpeg({ quality: 88 }).toBuffer();
    const h = 1.25, w = (h * m.width) / rowH;
    s.addImage({ data: "image/jpeg;base64," + row.toString("base64"), x: 0.6 + (12.13 - w) / 2, y: 5.58, w, h, altText: "Sample training pairs: garment photo then target photo", objectName: nm("Image") });
  }
  source(s, "Source: ml/scripts/build_pairs.py on public Amazon.in listings (men's T-shirts, women's tops); ml/data/pairs/qc.json. Each pair: garment input, then the target photo.");
  s.addNotes("To train the new model we need pairs: the garment alone, and the same garment worn. A catalogue has both, but unlabelled, and full of back views and close-ups. We use FASHN's own pose model as a guardrail. Every rule here was added because a test run picked exactly that kind of wrong photo before the rule existed.");

  // 11 ----------------------------------------------------------------- old vs new
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "OLD MODEL vs NEW MODEL (BASE vs BASE + LoRA)");
  s.addText(F.ifLora ? `Old vs new on ${V.LcN} unseen garments: denoising error ${V.LcDlRel}% (${V.LcDlVerdict})` : "How the new model will be judged; no improvement claimed yet", { placeholder: "title" });
  const hdr = ["Metric", "Base", "Base + LoRA", "Difference [95% CI]", "LoRA better", "Verdict"].map((t) => ({ text: t, options: { bold: true, color: H.lt1, fill: { color: H.dk1 } } }));
  const row = (m, k) => F.ifLora ? [m, V[`Lc${k}Base`], V[`Lc${k}Lora`], `${V[`Lc${k}Diff`]} ${V[`Lc${k}Ci`]}`, `${V[`Lc${k}Win`]}%`, V[`Lc${k}Verdict`]] : [m, "pending", "pending", "pending", "pending", "pending"];
  s.addTable([hdr, row("Denoising error ↓", "Dl"), row("PSNR (dB) ↑", "Psnr"), row("SSIM ↑", "Ssim"), row("Garment-pixel L1 ↓", "Gl"), row("Pose drift ↓", "Pd"), row("Colour ΔE ↓", "Cd")], {
    x: 0.6, y: 1.6, w: 7.6, colW: [1.55, 0.8, 0.95, 2.3, 0.85, 1.15], fontSize: 9.5, fontFace: "Calibri", color: H.dk1, fill: { color: H.lt1 }, border: { type: "solid", color: H.accent6, pt: 0.75 }, rowH: 0.32, objectName: nm("Table"),
  });
  box(s, 0.6, 4.6, 7.6, 2.15);
  text(s, F.ifLora ? `The run: ${V.LcSteps} steps on the laptop, half resolution, ${V.LcTrainMin} min; ${V.LcN} held-out garments` : "The evaluation (automated: evaluate.py → compare_lora.py)", { x: 0.8, y: 4.66, w: 7.2, h: 0.3, fontSize: 12, bold: true });
  bullets(s, ["Same held-out garments, same noise and seed for both models (one network, adapter on/off)", "Denoising error on every held-out pair; PSNR, SSIM and garment-pixel L1 on generated images", "Paired difference with a 95% bootstrap interval (10,000 resamples) and a Wilcoxon test", "Claim rule: improvement only if the interval excludes zero and Wilcoxon p < 0.05", "Side-by-side images kept for every generated garment: numbers can miss a wrong logo"], { x: 0.8, y: 4.98, w: 7.25, h: 1.75, fontSize: 10.5, paraSpaceAfter: 2 });
  if (F.ifLora) {
    const m = D.lora.metrics;
    const two = (k, title, fmt, y) => m[k] && s.addChart(pres.charts.BAR, [{ name: "Base", labels: [title], values: [m[k].base] }, { name: "Base + LoRA", labels: [title], values: [m[k].lora] }], { x: 8.5, y, w: 4.23, h: 2.5, barDir: "col", chartColors: [H.accent5, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: fmt, showLegend: true, legendPos: "b", showTitle: true, title: `${title}: ${m[k].verdict}`, valAxisMinVal: 0, ...axis(), objectName: nm("Chart") });
    two("denoise_loss", "Denoising error (lower is better)", "0.00000", 1.6);
    two(m.psnr ? "psnr" : "garment_l1", m.psnr ? "PSNR, dB (higher is better)" : "Garment-pixel error", m.psnr ? "0.00" : "0.000", 4.25);
  } else {
    box(s, 8.5, 1.6, 4.23, 5.15, C.text1);
    text(s, [{ text: "Status", options: { bold: true, color: C.accent3, breakLine: true } }, { text: "Pairs, training, evaluation and comparison scripts are built and tested. The run needs a CUDA GPU with ≥ 16 GB.", options: { color: C.background1, breakLine: true } }, { text: " ", options: { breakLine: true } }, { text: "When it runs, this slide, the report's Chapter 7.9 and the abstract fill in automatically from lora_comparison.json.", options: { color: C.accent6 } }], { x: 8.7, y: 1.8, w: 3.85, h: 4.8, fontSize: 13, paraSpaceAfter: 6 });
  }
  source(s, "Source: ml/scripts/evaluate.py, compare_lora.py → docs/mini-project-report/results/lora_comparison.json. Report sections 5.7 and 7.9.");
  s.addNotes(F.ifLora ? "Read the table: base against the adapted model on garments it never saw. The verdict column applies our rule: only an interval that excludes zero counts as an improvement." : "Say plainly: the comparison is set up and automated but has not run; it needs a CUDA GPU. We do not claim an improvement until the confidence interval excludes zero. The same script fills this slide when the run is done.");

  // 11b ---------------------------------------------------------------- guardrails + evals
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "GUARDRAILS AND EVALS FOR THE MODEL");
  s.addText("Every photo the model makes is checked before the seller sees it", { placeholder: "title" });
  const gh = ["Check", "What it measures", "Effect"].map((x) => ({ text: x, options: { bold: true, color: H.lt1, fill: { color: H.dk1 } } }));
  s.addTable([gh,
    ["Blank", "the image is one flat colour", { text: "reject", options: { bold: true, color: H.accent1 } }],
    ["Unchanged", "model photo came back as it was", { text: "reject", options: { bold: true, color: H.accent1 } }],
    ["Old outfit", "garment area closer to the old clothes than to the new garment (ΔE)", { text: "warn", options: { bold: true, color: H.accent3 } }],
    ["Shape", "aspect ratio differs from the model photo", { text: "warn", options: { bold: true, color: H.accent3 } }],
    ["Face", "head region changed", { text: "warn", options: { bold: true, color: H.accent3 } }],
  ], { x: 0.6, y: 1.6, w: 6.4, colW: [1.3, 4.1, 1.0], fontSize: 11, fontFace: "Calibri", color: H.dk1, fill: { color: H.lt1 }, border: { type: "solid", color: H.accent6, pt: 0.75 }, rowH: 0.46, objectName: nm("Table") });
  box(s, 0.6, 4.6, 6.4, 2.15, C.text1);
  text(s, [{ text: F.ifAppGuard ? `On our ${V.AgN} real generations (${V.AgMs} ms each)` : "Calibrated on our real generations", options: { bold: true, color: C.accent3, breakLine: true } },
    { text: "Warned on both photos of the skirt on a model in a dress (the 11/30 failure) and on one upload whose garment was a phone screenshot. No good result was rejected. A rejected result falls through to the next engine; a warning is shown on the result page.", options: { color: C.background1 } }], { x: 0.8, y: 4.68, w: 6.05, h: 2.0, fontSize: 12, paraSpaceAfter: 6 });
  if (F.ifModelGuard) {
    s.addChart(pres.charts.BAR, [{ name: "Base", labels: ["passed all guardrails (%)"], values: [Number(V.GrBaseRate)] }, { name: "Base + LoRA", labels: ["passed all guardrails (%)"], values: [Number(V.GrLoraRate)] }], {
      x: 7.25, y: 1.6, w: 5.48, h: 2.6, barDir: "col", chartColors: [H.accent5, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '0"%"', showLegend: true, legendPos: "b", valAxisMinVal: 0, valAxisMaxVal: 100,
      showTitle: true, title: `Model guardrail pass rate, ${V.GrBaseN} held-out outputs`, ...axis(), objectName: nm("Chart"),
    });
    const ev = [["Pose drift", `${V.LcPdBase} → ${V.LcPdLora}`, V.LcPdVerdict], ["Colour ΔE", `${V.LcCdBase} → ${V.LcCdLora}`, V.LcCdVerdict]];
    ev.forEach(([k, v, verdict], i) => stat(s, v, `${k} (base → LoRA, lower is better): ${verdict}`, 7.25 + i * 2.79, 4.35, 2.69, 1.45, C.accent2, 20));
    text(s, "Pose drift = body keypoints of output vs real photo (FASHN's own pose model); colour ΔE on the garment's pixels.", { x: 7.25, y: 5.95, w: 5.48, h: 0.8, fontSize: 10.5, color: C.text2 });
  } else {
    box(s, 7.25, 1.6, 5.48, 5.15);
    text(s, "Model-level evals (guardrail_eval.py)", { x: 7.45, y: 1.7, w: 5.1, h: 0.35, fontSize: 13, bold: true });
    bullets(s, ["Pose drift: body keypoints of the output vs the real photo", "Garment colour error: ΔE on the garment's pixels", "Blank or unchanged outputs", "Pass rate for base and for base + LoRA on held-out garments"], { x: 7.45, y: 2.15, w: 5.1, h: 3.0, fontSize: 12 });
  }
  source(s, "Source: src/lib/tryon/quality.ts + scripts/guardrail-audit.ts (app); ml/scripts/guardrail_eval.py (model). Report sections 3.8, 5.7 and 7.9.");
  s.addNotes("Two kinds of guardrail. In the app, every generated photo is checked in about 25 milliseconds before it is saved: a blank or unchanged photo is rejected, and three softer checks add a warning. We calibrated them on our real photos, and they catch the known skirt failure without flagging good results. For the model, the evaluation also measures whether the person's pose and the garment's colour are kept, and how often each model passes all checks.");

  // 12 ----------------------------------------------------------------- quality so far
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "OUTPUT QUALITY MEASURED SO FAR");
  s.addText("The skirt went from 11/30 to 29/30 by changing how the model is used", { placeholder: "title" });
  s.addChart(pres.charts.BAR, [{ name: "Score out of 30", labels: D.rubric.labels, values: D.rubric.totals }], {
    x: 0.6, y: 1.6, w: 6.6, h: 4.25, barDir: "col", chartColors: [H.accent2, H.accent2, H.accent3, H.accent2], showValue: true, dataLabelPosition: "outEnd", showLegend: false, valAxisMinVal: 0, valAxisMaxVal: 30, valAxisMajorUnit: 5,
    showTitle: true, title: "Rubric: colour, print, neckline, length, shape, artefacts (5 points each)", ...axis(), objectName: nm("Chart"),
  });
  text(s, "Scored by an AI assistant from crops; not yet confirmed by a human rater. Four images: a baseline, not a benchmark.", { x: 0.6, y: 5.95, w: 6.6, h: 0.8, fontSize: 11, italic: true, color: C.accent1 });
  if (sizes[files.skirt]) {
    const w = 5.25;
    img(s, files.skirt, 7.48, 1.65, w, "The tiered skirt on a model wearing separates");
  }
  box(s, 7.45, 4.45, 5.28, 2.3, C.text1);
  text(s, [{ text: "Why it failed, and the fix", options: { bold: true, color: C.accent3, breakLine: true } }, { text: "A skirt replaces a bottom garment. On a model in a dress there is none, so the skirt merged into the dress. The app now records what each preset model wears and marks it ✓/✗ for the garment type. The model itself is unchanged.", options: { color: C.background1 } }], { x: 7.65, y: 4.55, w: 4.9, h: 2.1, fontSize: 12, paraSpaceAfter: 5 });
  source(s, "Source: docs/eval-2026-10-26-baseline.md (balanced, 30 steps, seed 42). Report section 7.3.");
  s.addNotes("Tops are strong: the logo tee scored 30 of 30 with the letters exact. The skirt failed on a model in a dress and scored 29 on a model in separates. This is the only measured quality improvement so far, and it came from the system, not from training.");

  // 13 ----------------------------------------------------------------- market data
  if (D.market) {
    const K = ["tshirt", "top", "saree", "kurta-set"].filter((k) => D.market[k]);
    const COL = { tshirt: H.accent1, top: H.accent5, saree: H.accent3, "kurta-set": H.accent2 };
    s = pres.addSlide({ masterName: "CONTENT" });
    kicker(s, "MARKET RESEARCH FROM REAL LISTINGS");
    s.addText(`${V.MkTotalClean} listings, 4 categories: prices, discounts, ratings`, { placeholder: "title" });
    s.addChart(pres.charts.BAR, K.map((k) => ({ name: D.market[k].label, labels: D.market[k].hist_labels, values: D.market[k].hist })), {
      x: 0.6, y: 1.6, w: 6.6, h: 3.55, barDir: "col", chartColors: K.map((k) => COL[k]), showLegend: true, legendPos: "t", showValue: false, barGapWidthPct: 25, catAxisLabelFontSize: 8,
      showTitle: true, title: "Share of listings by selling price (%), ₹ thousands", ...axis(), objectName: nm("Chart"),
    });
    const hdr2 = ["", "Listings", "Median price", "Median discount", "≥50% off", "Stars"].map((x) => ({ text: x, options: { bold: true, color: H.lt1, fill: { color: H.dk1 } } }));
    s.addTable([hdr2, ...K.map((k) => { const c = D.market[k]; return [{ text: c.label, options: { bold: true } }, c.n.toLocaleString("en-IN"), rs(c.med), `${c.disc}%`, `${c.disc50}%`, String(c.stars)]; })], {
      x: 7.4, y: 1.6, w: 5.33, colW: [1.35, 0.85, 0.85, 0.8, 0.75, 0.73], fontSize: 10.5, fontFace: "Calibri", color: H.dk1, fill: { color: H.lt1 }, border: { type: "solid", color: H.accent6, pt: 0.75 }, rowH: 0.5, objectName: nm("Table"),
    });
    text(s, `Total ratings: ${V.MkTotalRatings}. Ratings stand in for sales, which are not public.`, { x: 7.4, y: 4.3, w: 5.33, h: 0.6, fontSize: 11, color: C.text2 });
    box(s, 0.6, 5.3, 12.13, 1.47, C.text1);
    text(s, "What the data says", { x: 0.85, y: 5.36, w: 6, h: 0.3, fontSize: 12, bold: true, color: C.accent3 });
    bullets(s, [`Discounting is the norm: median ${V.MkTeeDisc}–${V.MkKurtaDisc}% off MRP; ${V.MkKurtaDiscHalf}% of kurta sets claim 50% off or more`, `Price and discount are at most weakly related to demand (all |ρ| ≤ ${V.MkMaxRho}): undercutting does not buy sales`, `Amazon demand is concentrated (top 10 brands ${V.MkTeeTopTen}% of T-shirt ratings); Myntra ethnic wear is spread out (${V.MkKurtaTopTen}%): room for small sellers`], { x: 0.85, y: 5.68, w: 11.7, h: 1.05, fontSize: 11, color: C.background1, paraSpaceAfter: 2 });
    source(s, "Source: analysis/market.py on public Amazon.in (T-shirts, tops) and Myntra (sarees, kurta sets) listings, Oct 2026; one listing per product family, 3×IQR price outliers removed.");
    s.addNotes("Real marketplace data at scale: a quarter of a million listings. Two findings matter for a seller: everyone shows huge discounts, and neither price nor discount relates to how much a listing sells. Ethnic wear on Myntra is not dominated by a few brands, which is good news for small sellers.");

    // 14 --------------------------------------------------------------- what sells
    const sa = D.market.saree, ku = D.market["kurta-set"];
    s = pres.addSlide({ masterName: "CONTENT" });
    kicker(s, "WHAT BUYERS WANT, AND WHAT THEY SEARCH");
    s.addText("Demand by price tier, by attribute, and by search word", { placeholder: "title" });
    const tn = ["value", "mid", "premium"];
    s.addChart(pres.charts.BAR, K.map((k) => ({ name: D.market[k].label, labels: tn, values: tn.map((x) => D.market[k].tiers[x][1]) })), {
      x: 0.6, y: 1.6, w: 4.4, h: 5.15, barDir: "col", chartColors: K.map((k) => COL[k]), showValue: false, showLegend: true, legendPos: "b", valAxisMaxVal: 60, valAxisMinVal: 0,
      showTitle: true, title: "Share of demand by price tier (%)\n(each tier = one third of listings)", ...axis(), objectName: nm("Chart"),
    });
    const lf = (sa ? sa.lift.fabric.map((r) => [`saree: ${r[0]}`, r[1]]) : []).concat(ku ? ku.lift.pattern.map((r) => [`kurta: ${r[0]}`, r[1]]) : []).sort((x, y) => y[1] - x[1]).slice(0, 8);
    s.addChart(pres.charts.BAR, [{ name: "lift", labels: lf.map((r) => r[0]), values: lf.map((r) => r[1]) }], {
      x: 5.2, y: 1.6, w: 3.85, h: 5.15, barDir: "bar", chartColors: [H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", showLegend: false, catAxisOrientation: "maxMin", catAxisLabelFontSize: 9,
      showTitle: true, title: "Demand ÷ supply (>1 = buyers want more)", ...axis(), objectName: nm("Chart"),
    });
    const kw = (ku || D.market.tshirt).kw;
    s.addChart(pres.charts.BAR, [{ name: "score", labels: kw.map((k) => k[0]), values: kw.map((k) => k[1]) }], {
      x: 9.25, y: 1.6, w: 3.48, h: 5.15, barDir: "bar", chartColors: [H.accent3], showValue: false, showLegend: false, catAxisOrientation: "maxMin",
      showTitle: true, title: `${ku ? "Kurta-set" : "T-shirt"} title words by demand`, ...axis(), objectName: nm("Chart"),
    });
    source(s, "Demand share and lift use log(1 + ratings) so one bestseller cannot dominate; lift shown for values with ≥ 5 listings. Report section 7.7.");
    s.addNotes("Left: where demand sits by price; value-tier sarees and kurta sets get the most demand. Middle: fabrics and patterns buyers want more of than sellers offer. Right: the words buyers of kurta sets search; they search for what is included, dupatta and trousers, which the title engine uses.");
  }

  // 15 ----------------------------------------------------------------- engines
  if (D.example) {
    const ex = D.example, pr = ex.pricing;
    s = pres.addSlide({ masterName: "CONTENT" });
    kicker(s, "CONTENT ENGINES: PRICE, TITLE, HASHTAGS, POSITIONING, GEO");
    s.addText(`Worked example: an embroidered ${ex.input.product_noun} from ${ex.input.city}, cost ${rs(ex.input.cost)}`, { placeholder: "title" });
    s.addChart([
      { type: pres.charts.BAR, data: [{ name: "comparable listings (₹)", labels: ["25th pct", "median", "75th pct", "band low", "band high"], values: [pr.comparable_price.p25, pr.comparable_price.median, pr.comparable_price.p75, pr.recommended_band[0], pr.recommended_band[1]] }], options: { chartColors: [H.accent5, H.accent5, H.accent5, H.accent1, H.accent1], barGapWidthPct: 45, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '"₹"#,##0' } },
      { type: pres.charts.LINE, data: [{ name: `30%-margin floor ₹${pr.floor_for_30pct_margin}`, labels: ["25th pct", "median", "75th pct", "band low", "band high"], values: Array(5).fill(pr.floor_for_30pct_margin) }], options: { chartColors: [H.accent2], lineSize: 2, lineDataSymbol: "none", lineDash: "dash", showValue: false } },
    ], { x: 0.6, y: 1.6, w: 5.3, h: 3.75, showLegend: true, legendPos: "b", valAxisMinVal: 0, showTitle: true, title: `Pricing engine: ${pr.comparables} comparable listings`, ...axis(), objectName: nm("Chart") });
    box(s, 0.6, 5.5, 5.3, 1.27, C.text1);
    text(s, [{ text: `Recommended ${rs(pr.recommended_band[0])}–${rs(pr.recommended_band[1])} (${pr.position} tier). `, options: { bold: true, color: C.background1 } }, { text: pr.warning ? `Margin ${pr.margin_at_band[0]}–${pr.margin_at_band[1]}%: the low end is thin, so price at ${rs(pr.floor_for_30pct_margin)} or more.` : `Margin ${pr.margin_at_band[0]}–${pr.margin_at_band[1]}% at a ${rs(ex.input.cost)} cost; never below ${rs(pr.floor_for_30pct_margin)} (30% floor).`, options: { color: C.accent6 } }], { x: 0.8, y: 5.5, w: 4.95, h: 1.27, fontSize: 12, valign: "middle" });
    const eng = [["Title (SEO)", ex.seo.title, `${ex.seo.title_chars} chars; best sellers' median ${Math.round(ex.seo.benchmark_title_chars)}. Built only from the product's real attributes.`],
      ["Hashtags", ex.hashtags.tags.join(" "), "Broad + niche + local + occasion; English letters; never a feature the product lacks."],
      ["Positioning", ex.positioning.statement, `Under-supplied: ${ex.positioning.under_supplied.slice(0, 3).map((u) => u.value.toLowerCase() + " " + u.attribute).join(", ")}.`],
      ["GEO (location + calendar)", `${ex.geo.local_tags.join(" ")}`, `Next moments: ${ex.geo.moments.slice(0, 3).map((m) => `${m.name} (${m.days_away} d)`).join(", ")}.`]];
    eng.forEach(([hd, main, sub], i) => {
      const y = 1.6 + i * 1.3;
      box(s, 6.15, y, 6.58, 1.2);
      text(s, hd, { x: 6.33, y: y + 0.08, w: 6.2, h: 0.28, fontSize: 11, bold: true, color: C.accent1 });
      text(s, main, { x: 6.33, y: y + 0.36, w: 6.25, h: 0.48, fontSize: hd === "Hashtags" ? 9.5 : 11, bold: hd !== "Hashtags", fontFace: hd === "Hashtags" ? "Courier New" : undefined });
      text(s, sub, { x: 6.33, y: y + 0.84, w: 6.25, h: 0.32, fontSize: 9.5, color: C.text2 });
    });
    source(s, "Source: analysis/market.py engines on the catalogue statistics; analysis/example_seller.json. No language model is involved in any number.");
    s.addNotes("Every number here comes from the catalogue and the seller's cost, not from a language model. The pricing engine finds the comparable listings and recommends the middle band, with the margin at both ends. The title uses the words buyers search, in the order they search them. Hashtags never claim a feature the product doesn't have. GEO here means location: local tags and the dated festival calendar.");
  }

  // 15b ---------------------------------------------------------------- after integration
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "HOW A PHOTO IS PRODUCED AFTER INTEGRATION");
  s.addText("The adapted model becomes one more engine; nothing else changes", { placeholder: "title" });
  const flow2 = [["Upload", "garment + model"], ["Guards", "passcode, settings, model suits garment?"], ["prepareImage", "upright, white, no GPS"], ["studio.start", "cache, sharing, lock"], ["fashn-lora (new)", "base + merged adapter, own Space"], ["Engines", "price, title, hashtags, calendar"], ["Post", "caption checked, 4:5 / 1:1 / 9:16"]];
  const fw2 = 1.6, fg2 = (12.13 - 7 * fw2) / 6;
  flow2.forEach(([hd, sub], i) => {
    const x = 0.6 + i * (fw2 + fg2), hot = i === 4;
    box(s, x, 1.62, fw2, 1.05, hot ? C.accent1 : C.background1);
    text(s, [{ text: hd, options: { bold: true, fontSize: 11.5, breakLine: true, color: hot ? C.background1 : C.text1 } }, { text: sub, options: { fontSize: 9.5, color: hot ? C.background1 : C.text2 } }], { x: x + 0.08, y: 1.62, w: fw2 - 0.16, h: 1.05, align: "center", valign: "middle" });
    if (i < 6) arrowR(s, x + fw2 + fg2 / 2 - 0.09, 2.05);
  });
  text(s, "If our Space is down or out of quota, the chain falls back to FASHN's own Space: the seller still gets a photo.", { x: 0.6, y: 2.78, w: 12.13, h: 0.3, fontSize: 11, italic: true, color: C.accent2 });
  const th = ["Layer", "Now", "After integration"].map((x) => ({ text: x, options: { bold: true, color: H.lt1, fill: { color: H.dk1 } } }));
  s.addTable([th,
    ["Try-on network", "FASHN VTON 1.5 as released", "same network + merged LoRA adapter; saree and lehenga categories"],
    ["Licence", "non-commercial parser loaded (unused)", "parser removed: whole pipeline Apache-2.0"],
    ["Inference cost", `60 passes, ~${V.MedTotal} s on the free GPU`, "identical: a merged adapter adds no computation"],
    ["Fallback", "one real engine", "FASHN's Space as the second engine"],
    ["Content", "captions + research report", "plus price band, SEO title, hashtags, positioning, calendar"],
    ["Evaluation", "rubric on 4 images", "base vs adapter on held-out garments, 95% CI, per adapter"],
  ], { x: 0.6, y: 3.2, w: 12.13, colW: [2.1, 4.2, 5.83], fontSize: 11, fontFace: "Calibri", color: H.dk1, fill: { color: H.lt1 }, border: { type: "solid", color: H.accent6, pt: 0.75 }, rowH: 0.48, objectName: nm("Table") });
  source(s, "Integration = one engine file in src/lib/tryon/ plus one registry line; adapter served from a copy of FASHN's Gradio Space with attach_lora. Report section 5.9.");
  s.addNotes("This is the end state. The adapted model is served from our own Space and added as an engine; the cache, the lock, the error chain and the content engines stay exactly as they are. Running cost does not change, because the adapter is merged into the weights.");

  // 16 ----------------------------------------------------------------- text AI + safety
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "TEXT AI, SECURITY AND TESTS");
  s.addText("Language models write words; code computes numbers", { placeholder: "title" });
  const ch = [["Groq · Llama 3.3 70B", C.background1], ["Gemini 2.5 Flash", C.background1], ["Labelled template", C.accent6]];
  ch.forEach(([t, f], i) => { const x = 0.6 + i * 2.1; box(s, x, 1.65, 1.9, 0.55, f, H.accent5); text(s, t, { x, y: 1.65, w: 1.9, h: 0.55, fontSize: 11.5, bold: true, align: "center", valign: "middle" }); if (i < 2) arrowR(s, x + 1.92, 1.85); });
  text(s, "completeJSON(): the only place text AI is called. JSON mode, 45 s timeout, zod-validated; a badly shaped answer counts as a failure. In our deployment only the Gemini key is set, so Groq is skipped.", { x: 0.6, y: 2.35, w: 6.2, h: 0.9, fontSize: 11.5, color: C.text2 });
  box(s, 0.6, 3.35, 6.2, 3.4, C.text1);
  text(s, "Guardrails on generated text", { x: 0.8, y: 3.43, w: 5.8, h: 0.3, fontSize: 12, bold: true, color: C.accent3 });
  bullets(s, ["Any rupee amount other than the seller's price or MRP → answer rejected (₹, Rs, INR, Devanagari)", "Margins, price bands and festival dates computed in code, never by the model", "Hashtags in English letters, built from the product's real attributes", "The model is told it has no internet; made-up statistics and brands are forbidden", "No MRP suggestions: inflating an MRP to show a bigger discount is never proposed", "Every report says who wrote it: AI model or template"], { x: 0.8, y: 3.78, w: 5.85, h: 2.95, fontSize: 11, color: C.background1, paraSpaceAfter: 3 });
  s.addChart(pres.charts.BAR, [{ name: "tests", labels: ["Application (no network)", "Fine-tuning kit (no GPU)"], values: [D.tests.app, D.tests.ml] }], {
    x: 7.05, y: 1.6, w: 5.68, h: 2.6, barDir: "bar", chartColors: [H.accent2], showValue: true, dataLabelPosition: "outEnd", showLegend: false, showTitle: true, title: "Automated tests, all passing", valAxisMinVal: 0, ...axis(), objectName: nm("Chart"),
  });
  box(s, 7.05, 4.35, 5.68, 2.4);
  text(s, "Security", { x: 7.25, y: 4.42, w: 5.3, h: 0.3, fontSize: 12, bold: true });
  bullets(s, ["Passcode on every route that creates something, compared in constant time", "API keys stay in one .env on the server, re-read on every call", "Photos stripped of GPS metadata; no buyer data collected", "Not yet: user accounts, locked report links, encryption at rest"], { x: 7.25, y: 4.75, w: 5.35, h: 1.95, fontSize: 11, paraSpaceAfter: 3 });
  source(s, "Source: src/lib/llm/index.ts, src/lib/posts/caption.ts, src/lib/guard.ts; npm test and pytest (results/tests.json).");
  s.addNotes("One function talks to the language models and checks every answer. A caption that quotes a price the seller didn't give is thrown away. All arithmetic and dates are code. Tests run without network or GPU, using fake providers.");

  // 17 ----------------------------------------------------------------- conclusion
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "WHERE IT STANDS");
  s.addText("Done and measured, pending, and next", { placeholder: "title" });
  const cols = [["Done and measured", C.accent2, [`Serving: ${V.MedTotal} s per photo, ${V.CacheMs} ms when cached, quota learned`, `Training objective proved (${V.LossRatio}× lower loss)`, `LoRA: ${V.LoraLayers} adapters, ${V.LoraPct}% params, ${V.StateRatio}× less training memory`, F.ifPairs ? `${V.PairsN} guarded training pairs, no split leak` : "Pair pipeline with pose guardrails", ...(F.ifLora ? [`LoRA vs base, held-out: PSNR ${V.LcPsnrDiff} dB, pose drift ${V.LcPdRel}%, denoising ${V.LcDlRel}%`] : []), "Guardrails on every photo + model evals", "Catalogue analysis + 5 content engines", `${D.tests.app} + ${D.tests.ml} tests passing`]],
    ["Pending", C.accent3, F.ifLora ? ["Full-resolution training on a CUDA GPU", "Cleaner pairs: drop multipacks and banners", "Human raters for the rubric", "Sarees and lehengas (one photo per product today)"] : ["Base vs LoRA on held-out garments (needs a ≥16 GB CUDA GPU)", "Human raters for the rubric", "Indian garments: sarees, lehengas"]],
    ["Next", C.accent1, ["Serve the adapter as a second engine (one file)", "Connect the engines to the post maker", "Regional demand from sellers' own sales data", "Sharper output (upscaling) and photo checks"]]];
  cols.forEach(([hd, col, items], i) => {
    const x = 0.6 + i * 4.1;
    box(s, x, 1.6, 3.93, 4.4);
    s.addShape(pres.ShapeType.rect, { x, y: 1.6, w: 3.93, h: 0.08, fill: { color: col }, line: { color: col, width: 0 }, objectName: nm("Rule") });
    text(s, hd, { x: x + 0.22, y: 1.8, w: 3.5, h: 0.4, fontSize: 17, bold: true, color: col });
    bullets(s, items, { x: x + 0.22, y: 2.3, w: 3.55, h: 3.6, fontSize: 12, paraSpaceAfter: 6 });
  });
  box(s, 0.6, 6.12, 12.13, 0.66, C.text1);
  text(s, [{ text: "Stated plainly: ", options: { bold: true, color: C.accent3 } }, { text: F.ifLora ? "LoRA improved PSNR, SSIM, pose and denoising on unseen garments (laptop, half resolution); garment colour shows no clear change yet." : "no improvement from fine-tuning is claimed yet; the method, data and evaluation are ready for the GPU run.", options: { color: C.background1 } }], { x: 0.85, y: 6.12, w: 11.7, h: 0.66, fontSize: 13, valign: "middle" });
  s.addNotes("Close on the honest position: what is measured, what is pending and why (data and a GPU, not method), and what comes next. Ask for access to a 16 GB GPU for the training run.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
