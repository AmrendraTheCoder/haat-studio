// Two-speaker deck: Person A (photo pipeline, slides 2-5), Person B (text AI, research data, running safely, slides 6-9).
// Every number comes from a file in this project; each slide names its source at the bottom.
// Run: NODE_PATH=<haat-studio>/node_modules:<dir with pptxgenjs> node build-team-deck.cjs <haat-studio dir> <out.pptx> <pptx skill dir>
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const [ROOT, OUT, SKILL] = process.argv.slice(2);
const { applyTheme } = require(path.join(SKILL, "scripts/apply_theme.js"));
const R = (p) => path.join(ROOT, p);
const SHOT = (n) => R(`docs/btp-report/figures/team/${n}.png`);

// Colours taken from the app itself: cream paper, near-black ink, Haat magenta.
const THEME = {
  name: "Haat Studio",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1A1512", lt1: "FFFFFF", dk2: "6B5E55", lt2: "F4EEE3",
    accent1: "C8105A", accent2: "2F6F4E", accent3: "D98E04", accent4: "8A7A6B", accent5: "B9AC9C", accent6: "E6DCCB",
    hlink: "C8105A", folHlink: "6B5E55",
  },
};
const H = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Haat Studio: the system behind the try-on";
pres.author = "Mini project team";
const C = pres.SchemeColor;

pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: H.dk1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.7, y: 1.25, w: 7.6, h: 1.9, fontSize: 38, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "Title" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.7, y: 3.2, w: 7.4, h: 0.9, fontSize: 17, color: C.accent6, valign: "top", margin: 0 }, text: "Subtitle" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: H.lt2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.66, w: 12.1, h: 0.72, fontSize: 26, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "Title" } },
    { line: { x: 0.6, y: 6.93, w: 12.13, h: 0, line: { color: H.accent6, width: 0.75 } } },
  ],
  slideNumber: { x: 12.13, y: 7.02, w: 0.6, h: 0.28, fontSize: 9, color: H.accent4, align: "right" },
});

// ---------- helpers ----------
let n = 0;
const name = (s) => `${s} ${++n}`;
function text(s, t, o) {
  s.addText(t, { isTextBox: true, margin: 0, valign: "top", color: C.text1, fontSize: 13, objectName: name("Text"), ...o });
}
function box(s, x, y, w, h, fill = C.background1, line = null) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.06, fill: { color: fill }, line: line ? { color: line, width: 0.75 } : { color: fill, width: 0 }, objectName: name("Card") });
}
function kicker(s, label) {
  text(s, label, { x: 0.6, y: 0.36, w: 12, h: 0.28, fontSize: 11, bold: true, color: C.accent1, charSpacing: 1.5 });
}
function source(s, t) {
  text(s, t, { x: 0.6, y: 7.0, w: 11.3, h: 0.3, fontSize: 9, color: C.accent4, valign: "middle" });
}
function shot(s, file, x, y, w, alt) {
  const m = sizes[file];
  const h = (w * m.height) / m.width;
  s.addShape(pres.ShapeType.rect, { x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06, fill: { color: H.accent6 }, line: { color: H.accent5, width: 0.5 }, objectName: name("Frame") });
  s.addImage({ path: file, x, y, w, h, altText: alt, objectName: name("Screenshot") });
  return h;
}
function stat(s, big, label, x, y, w, h, color = C.accent1) {
  box(s, x, y, w, h);
  text(s, big, { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.62, fontSize: 28, bold: true, color, fontFace: THEME.headFontFace, valign: "middle" });
  text(s, label, { x: x + 0.2, y: y + 0.76, w: w - 0.4, h: h - 0.84, fontSize: 12, color: C.text2 });
}
function arrowRight(s, x, y, w = 0.16, h = 0.22, color = C.accent4) {
  s.addShape(pres.ShapeType.triangle, { x, y, w: h, h: w, rotate: 90, fill: { color }, line: { color, width: 0 }, objectName: name("Arrow") });
}
function arrowDown(s, x, y, color = C.accent4) {
  s.addShape(pres.ShapeType.triangle, { x, y, w: 0.22, h: 0.14, rotate: 180, fill: { color }, line: { color, width: 0 }, objectName: name("Arrow") });
}
const axis = () => ({
  catAxisLabelColor: H.dk2, valAxisLabelColor: H.dk2, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
  catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", dataLabelFontSize: 10, dataLabelColor: H.dk1,
  legendFontFace: "+mn-lt", legendFontSize: 11, legendColor: H.dk2, titleFontFace: "+mn-lt", titleFontSize: 13, titleColor: H.dk1,
  valGridLine: { color: H.accent6, size: 0.5 }, catGridLine: { style: "none" }, catAxisLineColor: H.accent5, valAxisLineShow: false,
  plotArea: { fill: { color: H.lt1 } }, chartArea: { fill: { color: H.lt1 }, roundedCorners: false },
});

const sizes = {};
const shots = ["shot-beforeafter", "shot-saved", "shot-exports", "shot-quota", "shot-ai-banner", "shot-numbers"].map(SHOT);

(async () => {
  const sharp = require("sharp");
  for (const f of shots) sizes[f] = await sharp(f).metadata();

  // ---- real data ----
  const runs = fs.readdirSync(R("data/results")).filter((k) => /^[0-9a-f]{32}$/.test(k))
    .map((k) => JSON.parse(fs.readFileSync(R(`data/results/${k}/meta.json`))))
    .filter((m) => m.engine === "fashn-space")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const label = { tops: "top", bottoms: "bottom", "one-pieces": "dress" };
  const runLabels = runs.map((m, i) => `${i + 1} · ${label[m.settings.category]}`);
  const queue = runs.map((m) => +(m.queueMs / 1000).toFixed(1));
  const gpu = runs.map((m) => +((m.totalMs - m.queueMs) / 1000).toFixed(1));
  const total = runs.map((m) => m.totalMs / 1000);
  const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  const prep = runs.flatMap((m) => [m.prep.garment, m.prep.person]);
  const changed = prep.filter((p) => p.resized || p.stripped || p.rotated || p.flattened).length;
  const reports = fs.readdirSync(R("data/research")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(R(`data/research/${f}`))));
  const ai = reports.find((r) => r.via.startsWith("gemini") && r.answers.language !== "hi");
  const tpl = reports.find((r) => r.via === "template");
  const tags = (r) => Object.values(r.findings.hashtags).flat().length;
  const ledger = JSON.parse(fs.readFileSync(R("data/gpu-quota.json")));
  if (runs.length !== 10 || !ai || !tpl) throw new Error("data on disk changed: re-check the slide wording");

  // 1 ================================================================ title
  let s = pres.addSlide({ masterName: "TITLE_DARK" });
  text(s, "MINI PROJECT · 5TH SEMESTER · LNMIIT JAIPUR", { x: 0.7, y: 0.7, w: 8, h: 0.3, fontSize: 11, bold: true, color: C.accent5, charSpacing: 1.5 });
  s.addText("Haat Studio: the system behind the try-on", { placeholder: "title" });
  s.addText("How one garment photo becomes an on-model photo, a caption and a market plan, using free services only", { placeholder: "body" });
  const speakers = [
    ["PERSON A", "The photo pipeline", "Engine and orchestration · photo cleaning · cache and storage · live progress", "Slides 2 to 5"],
    ["PERSON B", "Intelligence, and running safely", "Text AI · market-research data · quota · security · tests", "Slides 6 to 9"],
  ];
  speakers.forEach(([who, what, detail, slides], i) => {
    const y = 4.45 + i * 1.18;
    s.addShape(pres.ShapeType.rect, { x: 0.7, y, w: 0.06, h: 0.98, fill: { color: i ? C.accent3 : C.accent1 }, line: { color: i ? C.accent3 : C.accent1, width: 0 }, objectName: name("Rule") });
    text(s, [
      { text: `${who}  `, options: { bold: true, color: i ? C.accent3 : C.accent1, fontSize: 11, charSpacing: 1.5 } },
      { text: slides, options: { color: C.accent5, fontSize: 11, breakLine: true } },
      { text: what, options: { bold: true, color: C.background1, fontSize: 17, breakLine: true } },
      { text: detail, options: { color: C.accent6, fontSize: 12 } },
    ], { x: 0.95, y, w: 7.2, h: 0.98, valign: "middle", paraSpaceAfter: 2 });
  });
  text(s, "Faculty guide: Dr. Nishant Gupta", { x: 0.7, y: 6.85, w: 7, h: 0.3, fontSize: 11, color: C.accent5 });
  const baH = 6.1, baW = (baH * sizes[shots[0]].width) / sizes[shots[0]].height;
  s.addImage({ path: shots[0], x: 12.63 - baW, y: 0.7, w: baW, h: baH, altText: "The app's before-and-after view: the model photo on the left half, the generated try-on on the right half", objectName: name("Screenshot") });
  text(s, "A real result in the app: before | after", { x: 12.63 - baW, y: 6.85, w: baW, h: 0.3, fontSize: 11, color: C.accent5, align: "center" });
  s.addNotes("PERSON A opens. 'Sir, our project is Haat Studio. A seller gives one photo of a garment, and the system makes an on-model photo, a caption for Instagram, and a market plan, all on free services. I will explain how the photo gets made. My partner will explain the text AI, where the research data comes from, and how we keep it safe on free services.' Point at the screenshot: it is from the running app, the left half is the original model photo, the right half is our result.");

  // 2 ================================================================ A1: request journey + timing
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "PERSON A  ·  1 / 4  ·  HOW A TRY-ON GETS MADE");
  s.addText("A new photo takes about 32 seconds, and most of that is GPU time", { placeholder: "title" });
  const flow = [["Browser", "garment + model + settings"], ["API route", "passcode, settings, photos"], ["prepareImage()", "clean both photos"], ["studio.start()", "cache, lock, engines"], ["FASHN VTON 1.5", "free GPU, Hugging Face"], ["Save to disk", "data/results/<key>"], ["Stream back", "live, line by line"]];
  const fw = 1.5, fg = (12.13 - 7 * fw) / 6;
  flow.forEach(([hd, sub], i) => {
    const x = 0.6 + i * (fw + fg);
    const hot = i === 3 || i === 4;
    box(s, x, 1.62, fw, 0.82, hot ? C.text1 : C.background1);
    text(s, [{ text: hd, options: { bold: true, fontSize: 12, color: hot ? C.background1 : C.text1, breakLine: true } }, { text: sub, options: { fontSize: 10, color: hot ? C.accent6 : C.text2 } }], { x: x + 0.1, y: 1.62, w: fw - 0.2, h: 0.82, valign: "middle", align: "center" });
    if (i < 6) arrowRight(s, x + fw + fg / 2 - 0.08, 1.92);
  });
  s.addChart(pres.charts.BAR, [
    { name: "Waiting in the queue", labels: runLabels, values: queue },
    { name: "Running on the GPU", labels: runLabels, values: gpu },
  ], {
    x: 0.6, y: 2.72, w: 8.05, h: 4.05, barDir: "bar", barGrouping: "stacked", chartColors: [H.accent3, H.accent1], barGapWidthPct: 45,
    showValue: true, dataLabelPosition: "ctr", dataLabelColor: H.lt1, dataLabelFormatCode: "0.0", showLegend: true, legendPos: "t",
    showTitle: true, title: "Our 10 real photos: seconds from 'Create' to finished", catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: 40, valAxisMajorUnit: 10,
    ...axis(), objectName: name("Chart"),
  });
  stat(s, `${Math.round(med(total))} s`, "median time for a new photo, from pressing Create to the finished image", 8.95, 2.72, 3.78, 1.25);
  stat(s, `${Math.round(med(gpu))} s`, "of that is the model running on the free GPU", 8.95, 4.12, 3.78, 1.25, C.text1);
  stat(s, `${med(queue).toFixed(1)} s`, "waiting in Hugging Face's queue for a GPU", 8.95, 5.52, 3.78, 1.25, C.accent3);
  source(s, `Source: meta.json of all ${runs.length} real generations in data/results, 26 to 27 Oct 2026. Bad input never reaches this chart: it gets an instant 400 error before streaming starts.`);
  s.addNotes(`PERSON A. Top row first: 'This is the journey of one request, left to right. The route checks the passcode, the settings and the photos. Bad input comes back at once as a plain error, so the seller can tell "fix your photo" from "the engine failed". Only a valid request starts the live stream.'\n\nThen the chart: 'These are all ${runs.length} real photos we made. Each bar is one photo. Amber is time waiting in Hugging Face's queue, magenta is the model actually running. The median is about 32 seconds, and about 26 of that is GPU. Two photos took only 13.5 seconds, so speed varies with the shared GPU.' If asked why: we do not know exactly; it is a shared free GPU.`);

  // 3 ================================================================ A2: studio.start + engines
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "PERSON A  ·  2 / 4  ·  THE TRY-ON ENGINE AND ORCHESTRATION");
  s.addText("studio.start(): one way in, and the cheapest check runs first", { placeholder: "title" });
  const steps = [["1", "Make the key", "sha256 of both photos + settings", "a name tag for this exact request"], ["2", "Already running?", "join that job", "a double-click never runs the GPU twice"], ["3", "Already saved?", "load it from disk", "0 GPU seconds, under 1 ms"], ["4", "GPU lock", "wait for our turn", "one photo at a time on the free GPU"], ["5", "Engine chain", "run FASHN VTON 1.5", "about 32 s"]];
  text(s, [{ text: "Step", options: { bold: true } }], { x: 0.75, y: 1.62, w: 0.6, h: 0.3, fontSize: 11, color: C.text2 });
  text(s, "Check", { x: 1.3, y: 1.62, w: 2.2, h: 0.3, fontSize: 11, bold: true, color: C.text2 });
  text(s, "What happens, and why it matters", { x: 3.55, y: 1.62, w: 3.3, h: 0.3, fontSize: 11, bold: true, color: C.text2 });
  steps.forEach(([k, hd, a, b], i) => {
    const y = 1.95 + i * 0.6;
    box(s, 0.6, y, 6.3, 0.52, i === 2 ? C.text1 : C.background1);
    const dark = i === 2;
    text(s, k, { x: 0.75, y, w: 0.4, h: 0.52, fontSize: 15, bold: true, color: C.accent1, valign: "middle" });
    text(s, hd, { x: 1.3, y, w: 2.2, h: 0.52, fontSize: 13, bold: true, valign: "middle", color: dark ? C.background1 : C.text1 });
    text(s, [{ text: a, options: { breakLine: true, color: dark ? C.background1 : C.text1 } }, { text: b, options: { color: dark ? C.accent6 : C.text2, fontSize: 11 } }], { x: 3.55, y, w: 3.25, h: 0.52, fontSize: 12, valign: "middle" });
  });
  text(s, "Memory first, then disk, then the GPU: the cheapest check always runs first.", { x: 0.6, y: 4.98, w: 6.3, h: 0.3, fontSize: 12, italic: true, color: C.accent2 });
  box(s, 0.6, 5.38, 6.3, 1.42, C.background1);
  text(s, "When an engine fails", { x: 0.8, y: 5.46, w: 5.9, h: 0.3, fontSize: 13, bold: true });
  text(s, [
    { text: "input", options: { bold: true, color: C.accent1 } }, { text: " (a bad photo) → stop: every engine would reject it", options: { breakLine: true } },
    { text: "quota · timeout · unavailable · unknown", options: { bold: true, color: C.accent3 } }, { text: " → try the next engine", options: { breakLine: true } },
    { text: "After 240 s we cancel our place in the queue, so no quota is spent after we stop listening.", options: { color: C.text2 } },
  ], { x: 0.8, y: 5.78, w: 5.95, h: 0.98, fontSize: 12, paraSpaceAfter: 3 });
  s.addChart(pres.charts.BAR, [{ name: "Time to answer", labels: ["Saved result: 0.32 ms", `New photo: ${Math.round(med(total) * 1000).toLocaleString("en-US")} ms`], values: [0.32, Math.round(med(total) * 1000)] }], {
    x: 7.2, y: 1.62, w: 5.53, h: 3.2, barDir: "bar", chartColors: [H.accent2, H.accent1], showValue: false,
    valAxisLogScaleBase: 10, valAxisMinVal: 0.01, valAxisMaxVal: 100000, valAxisLabelFormatCode: "#,##0.##", showLegend: false, barGapWidthPct: 50,
    showTitle: true, title: "Time to answer, in milliseconds (log scale)", ...axis(), objectName: name("Chart"),
  });
  const hs = shot(s, shots[1], 7.25, 5.05, 3.4, "The app's result page saying: No GPU used, loaded from saved photos");
  text(s, "What the seller sees on a repeat request", { x: 10.85, y: 5.05, w: 1.88, h: hs, fontSize: 11, color: C.text2, valign: "middle" });
  text(s, "If every engine fails, explain() turns all the attempts into one sentence the seller can act on, e.g. “Today's free GPU quota is used up. It refills in about 14 min.”", { x: 7.2, y: 6.08, w: 5.53, h: 0.72, fontSize: 11, color: C.text2 });
  source(s, "Source: src/lib/tryon/studio.ts. Cache time measured on 26 Nov 2026: the T-shirt result looked up 25 times on this laptop, median 0.32 ms (photo check + key + disk lookup).");
  s.addNotes("PERSON A. 'Every try-on in the app goes through this one function, so no route can skip these protections. It checks in order of cost. Step 2: a double-click joins the job that is already running, so the GPU never runs twice for the same request. Step 3: a repeat request comes straight from disk. Only then do we wait for the GPU lock and run the model.'\n\nChart: 'This is measured. Answering a repeat request from the saved result takes about a third of a millisecond. A new photo takes about 32 seconds. The bar scale is logarithmic because the gap is about a hundred thousand times.' Point at the screenshot: the app tells the seller 'No GPU used'.\n\nErrors: 'A bad photo stops the chain because every engine would reject it. Anything else falls through to the next engine. Adding an engine, for example a paid API later, is one file plus one line in the registry.' Be honest: today there is only one real engine, so the fallback is built but has nothing to fall back to yet.");

  // 4 ================================================================ A3: prepareImage + cache key
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "PERSON A  ·  3 / 4  ·  IMAGES AND THE CACHE KEY");
  s.addText("Every photo is cleaned first, and clean photos are left untouched", { placeholder: "title" });
  const fixes = [["Turn it upright", "Phone photos are often stored sideways, with a rotate flag"], ["Transparency → white", "The model would turn transparent areas black"], ["Longest side ≤ 1,536 px", "The model works at about 576 px wide; more only costs upload time"], ["Remove metadata", "Phone photos can carry the GPS location of the seller's home"], ["Refuse HEIC, < 256 px, > 15 MB", "A clear message at once, before any GPU time"]];
  text(s, "prepareImage(): what it fixes, and why", { x: 0.6, y: 1.6, w: 6.4, h: 0.32, fontSize: 13, bold: true });
  fixes.forEach(([hd, why], i) => {
    const y = 1.98 + i * 0.6;
    box(s, 0.6, y, 6.4, 0.52);
    text(s, hd, { x: 0.8, y, w: 2.45, h: 0.52, fontSize: 12, bold: true, valign: "middle" });
    text(s, why, { x: 3.3, y, w: 3.6, h: 0.52, fontSize: 11, color: C.text2, valign: "middle" });
  });
  s.addChart(pres.charts.DOUGHNUT, [{ name: "Photos", labels: ["Left untouched", "Changed"], values: [prep.length - changed, changed] }], {
    x: 7.3, y: 1.55, w: 2.75, h: 2.6, holeSize: 58, chartColors: [H.accent2, H.accent1], showValue: true, showPercent: false, showLegend: false, showLabel: false,
    dataLabelColor: H.lt1, dataLabelFontSize: 13, dataLabelFontFace: "+mn-lt", dataLabelFontBold: true, showTitle: false, objectName: name("Chart"),
  });
  text(s, [
    { text: `${prep.length - changed} of ${prep.length}`, options: { bold: true, fontSize: 26, color: C.accent2, breakLine: true } },
    { text: `photos in our ${runs.length} real runs were already clean and passed through unchanged. ${changed} were changed: 2 resized, 2 had metadata removed.`, options: { fontSize: 12, color: C.text2 } },
  ], { x: 10.2, y: 1.75, w: 2.53, h: 2.3, paraSpaceAfter: 4 });
  box(s, 7.3, 4.25, 5.43, 0.92);
  text(s, [
    { text: "Measured: ", options: { bold: true } },
    { text: "a 2000 × 2500 transparent PNG became a 1229 × 1536 JPEG on white, 106 KB → 11 KB, in 94 ms." },
  ], { x: 7.5, y: 4.25, w: 5.1, h: 0.92, fontSize: 12, valign: "middle" });
  box(s, 0.6, 5.3, 12.13, 1.5, C.text1);
  text(s, "The cache key", { x: 0.85, y: 5.4, w: 3, h: 0.3, fontSize: 13, bold: true, color: C.accent3 });
  text(s, "key = sha256( garment | person | category | photoType | quality | seed )", { x: 0.85, y: 5.74, w: 7.8, h: 0.36, fontSize: 12, color: C.background1, fontFace: "Courier New" });
  text(s, [
    { text: "seed 42 → 2de42185…  ", options: { color: C.accent6 } }, { text: "saved, opens instantly", options: { color: C.accent5, breakLine: true } },
    { text: "seed 43 → 066bb07b…  ", options: { color: C.accent6 } }, { text: "new key, so a new variation", options: { color: C.accent5 } },
  ], { x: 0.85, y: 6.14, w: 7.6, h: 0.6, fontSize: 12, fontFace: "Courier New" });
  text(s, "Why clean photos are not re-saved: re-saving a JPEG changes its bytes, which changes the key, which misses the cache. Same photos + same settings → same key → instant, with no GPU.", { x: 8.75, y: 5.42, w: 3.8, h: 1.3, fontSize: 12, color: C.accent6, valign: "middle" });
  source(s, "Source: src/lib/tryon/image.ts and store.ts; prep flags from the 10 meta.json files; the PNG test and both keys were run on this laptop on 26 Nov 2026.");
  s.addNotes(`PERSON A. 'Before any GPU time is spent, both photos go through prepareImage. It turns phone photos upright, puts transparent images on white, shrinks very large photos, and removes metadata, because a phone photo can contain the GPS location of the seller's home.'\n\nChart: 'Of the ${prep.length} photos in our real runs, ${prep.length - changed} were already clean, and we did not touch them. This matters for the cache: if we re-saved a clean JPEG, its bytes would change, its key would change, and it would miss the cache.'\n\nKey: 'The key is the request: a hash of both photos and the settings. The same request always gets the same key and opens instantly. Changing only the seed gives a new key, which is how "Another variation" makes a new photo.'`);

  // 5 ================================================================ A4: storage + live progress
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "PERSON A  ·  4 / 4  ·  STORAGE AND LIVE PROGRESS");
  s.addText("Results are saved safely, and the seller sees only real progress", { placeholder: "title" });
  const tee = runs.find((m) => m.key === "2de42185dfdafbf0412dc5b29276dc35");
  const tq = tee.queueMs / 1000, tt = tee.totalMs / 1000;
  box(s, 0.6, 1.6, 7.0, 3.55, C.background1);
  text(s, "One real photo, event by event (the T-shirt, 26 Oct)", { x: 0.8, y: 1.68, w: 6.6, h: 0.3, fontSize: 13, bold: true });
  const gx = 2.75, gw = 4.55, scale = gw / 35, gy = 2.1, rs = 0.38;
  const ev = [["accepted", 0, 0], ["prepared", 0, 0], ["checked: not saved", 0, 0], ["queued", 0, tq], ["running", tq, tt], ["done", tt, tt]];
  ev.forEach(([lab, a, b], i) => {
    const y = gy + i * rs;
    text(s, lab, { x: 0.8, y, w: 1.75, h: 0.3, fontSize: 11, color: C.text2, valign: "middle", align: "right" });
    if (b > a) {
      const col = lab === "queued" ? C.accent3 : C.accent1;
      s.addShape(pres.ShapeType.rect, { x: gx + a * scale, y: y + 0.04, w: (b - a) * scale, h: 0.22, fill: { color: col }, line: { color: col, width: 0 }, objectName: name("Bar") });
      text(s, `${(b - a).toFixed(1)} s`, { x: gx + a * scale + 0.08, y, w: 1, h: 0.3, fontSize: 10, bold: true, color: C.background1, valign: "middle" });
    } else {
      s.addShape(pres.ShapeType.ellipse, { x: gx + a * scale - 0.08, y: y + 0.07, w: 0.16, h: 0.16, fill: { color: C.text1 }, line: { color: C.text1, width: 0 }, objectName: name("Event") });
    }
  });
  const axY = gy + 6 * rs + 0.02;
  s.addShape(pres.ShapeType.line, { x: gx, y: axY, w: gw, h: 0, line: { color: H.accent5, width: 0.75 }, objectName: name("Axis") });
  for (let t = 0; t <= 35; t += 5) text(s, `${t} s`, { x: gx + t * scale - 0.3, y: axY + 0.04, w: 0.6, h: 0.22, fontSize: 9, color: C.accent4, align: "center" });
  text(s, "Each line of the NDJSON stream is one event with the server's timestamp. The panel draws only these: no fake progress bar.", { x: 0.8, y: 4.66, w: 6.6, h: 0.45, fontSize: 11, color: C.text2 });
  box(s, 7.85, 1.6, 4.88, 1.75);
  text(s, "Saved to disk, safely", { x: 8.05, y: 1.68, w: 4.5, h: 0.3, fontSize: 13, bold: true });
  text(s, [
    { text: "data/results/<key>/", options: { fontFace: "Courier New", bold: true, breakLine: true } },
    { text: "result.png · garment.jpg · person.jpg · meta.json", options: { fontFace: "Courier New", fontSize: 10, color: C.text2, breakLine: true } },
    { text: "Written to a temporary folder, meta.json last, then renamed. A crash never leaves half a result.", options: {} },
  ], { x: 8.05, y: 2.0, w: 4.5, h: 1.3, fontSize: 11, paraSpaceAfter: 3 });
  box(s, 7.85, 3.45, 4.88, 1.7);
  text(s, "Closing the tab wastes nothing", { x: 8.05, y: 3.53, w: 4.5, h: 0.3, fontSize: 13, bold: true });
  text(s, [
    { text: "The job keeps running and the result is still saved. Opening /studio?r=<key> again:", options: { breakLine: true } },
    { text: "running → replay every event, then continue live", options: { bullet: true, breakLine: true } },
    { text: "finished → the saved result", options: { bullet: true, breakLine: true } },
    { text: "neither → 404, try again", options: { bullet: true } },
  ], { x: 8.05, y: 3.85, w: 4.55, h: 1.26, fontSize: 11, paraSpaceAfter: 1 });
  const he = shot(s, shots[2], 0.65, 5.4, 3.3, "The app's download buttons: Post 4:5 1080 by 1350, Square 1:1, Story 9:16, Original PNG");
  text(s, "Instagram sizes are made on request and never cropped: a blurred copy of the photo fills the margins.", { x: 4.2, y: 5.4, w: 3.4, h: he, fontSize: 11, color: C.text2, valign: "middle" });
  s.addShape(pres.ShapeType.roundRect, { x: 7.85, y: 5.4, w: 4.88, h: he, rectRadius: 0.06, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: name("Handoff") });
  text(s, [{ text: "Handing over to Person B", options: { bold: true, breakLine: true } }, { text: "Every new photo spends free GPU time. Next: how that time is tracked, and the text AI." }], { x: 8.05, y: 5.4, w: 4.5, h: he, fontSize: 12, color: C.background1, valign: "middle" });
  source(s, "Source: queue and run times from data/results/2de42185…/meta.json; src/lib/tryon/stream.ts, store.ts, app/api/tryon/[key]/route.ts.");
  s.addNotes(`PERSON A. 'This is one real photo, the T-shirt from slide 1, event by event. The first three events happen at once. Then it waited ${tq.toFixed(1)} seconds in the queue and ran for ${(tt - tq).toFixed(1)} seconds. The server sends each event as one line with its own timestamp, and the panel only shows events that really happened.'\n\n'Results are written to a temporary folder and renamed into place, with meta.json last, so a crash never leaves half a result. If the seller closes the tab, the job keeps running and the photo is still saved. Every event is remembered, so a page that reconnects sees the whole story.'\n\nHandoff: 'Every new photo spends free GPU time. My partner will now show how we track it, and how the text AI works.'`);

  // 6 ================================================================ B1: completeJSON
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "PERSON B  ·  1 / 4  ·  THE TEXT-AI LAYER (CAPTIONS AND RESEARCH)");
  s.addText("One function talks to the text AI, and it checks every answer", { placeholder: "title" });
  text(s, "completeJSON(): the only place the app calls a text AI", { x: 0.6, y: 1.6, w: 6.3, h: 0.32, fontSize: 13, bold: true });
  const chain = [["Groq · Llama 3.3 70B", C.background1, C.text1], ["Gemini 2.5 Flash", C.background1, C.text1], ["Labelled template", C.accent6, C.text1]];
  chain.forEach(([t, fill, col], i) => {
    const x = 0.6 + i * 2.15;
    box(s, x, 2.0, 1.95, 0.5, fill, H.accent5);
    text(s, t, { x, y: 2.0, w: 1.95, h: 0.5, fontSize: 12, bold: true, color: col, align: "center", valign: "middle" });
    if (i < 2) arrowRight(s, x + 1.98, 2.17);
  });
  text(s, "tried in order (LLM_CHAIN); a provider with no key is skipped", { x: 0.6, y: 2.55, w: 6.3, h: 0.26, fontSize: 10, color: C.text2 });
  const checks = [["Send", "POST /chat/completions in JSON mode, 45 s timeout"], ["Extract", "extractJSON(): strip ``` fences, take the {…} object"], ["Validate", "zod safeParse: is every field there, in the right shape?"], ["Return", "{ data, via: \"gemini/…\" }, or note the error and try the next"]];
  checks.forEach(([k, v], i) => {
    const y = 2.92 + i * 0.5;
    text(s, k, { x: 0.6, y, w: 1.05, h: 0.42, fontSize: 12, bold: true, color: C.accent1, valign: "middle" });
    box(s, 1.7, y, 5.2, 0.42);
    text(s, v, { x: 1.85, y, w: 5.0, h: 0.42, fontSize: 11, valign: "middle" });
  });
  text(s, "Every failure is recorded, not only the last. If all fail, LlmUnavailable is thrown and the caller uses its template.", { x: 0.6, y: 4.95, w: 6.3, h: 0.5, fontSize: 11, color: C.text2 });
  box(s, 0.6, 5.5, 6.3, 1.3, C.text1);
  text(s, "Three caption safety rules", { x: 0.8, y: 5.56, w: 5.9, h: 0.3, fontSize: 12, bold: true, color: C.accent3 });
  text(s, [
    { text: "Any rupee amount the seller didn't give (₹, Rs, INR, रु, Devanagari digits) → the answer is rejected", options: { bullet: true, breakLine: true } },
    { text: "Hashtags always in English letters: shoppers search #cottonkurti", options: { bullet: true, breakLine: true } },
    { text: "The template uses only what the seller typed: no claims", options: { bullet: true } },
  ], { x: 0.8, y: 5.86, w: 5.95, h: 0.9, fontSize: 11, color: C.background1, paraSpaceAfter: 1 });
  s.addChart(pres.charts.BAR, [
    { name: "Written by AI (Gemini)", labels: ["Trends", "Hashtags", "Content ideas", "Days planned"], values: [ai.findings.trends.length, tags(ai), ai.findings.contentIdeas.length, ai.findings.weekPlan.length] },
    { name: "Template (no AI)", labels: ["Trends", "Hashtags", "Content ideas", "Days planned"], values: [tpl.findings.trends.length, tags(tpl), tpl.findings.contentIdeas.length, tpl.findings.weekPlan.length] },
  ], {
    x: 7.2, y: 1.6, w: 5.53, h: 3.55, barDir: "col", chartColors: [H.accent1, H.accent5], showValue: true, dataLabelPosition: "outEnd", showLegend: true, legendPos: "b",
    showTitle: true, title: "Same seller, same answers: AI report vs template", valAxisMinVal: 0, valAxisMaxVal: 16, valAxisMajorUnit: 4, barGapWidthPct: 60, ...axis(), objectName: name("Chart"),
  });
  shot(s, shots[4], 7.25, 5.32, 5.43, "The report page banner: Written by AI (gemini/gemini-2.5-flash) from general knowledge, it has no live internet access");
  text(s, "Every report says who wrote it. A template report is labelled “starter plan”.", { x: 7.2, y: 6.0, w: 5.53, h: 0.42, fontSize: 11, color: C.text2 });
  source(s, `Source: src/lib/llm/index.ts, src/lib/posts/caption.ts; reports ${ai.id} (AI) and ${tpl.id} (template) in data/research, both for cotton kurtis in Jaipur, 26 Oct 2026.`);
  s.addNotes(`PERSON B opens. 'Thank you. Captions and market research both need a text AI. In the whole app there is only one function that talks to it: completeJSON. If we change the model, the key or the retry logic, we change one place.'\n\n'It tries free providers in order: Groq's Llama 3.3 70B, then Google's Gemini 2.5 Flash. Both are free and both speak the same OpenAI-style API, so one piece of code covers both. For each answer it pulls out the JSON and checks it against a zod schema. A badly shaped answer counts as a failure, the same as a network error.'\n\nBe exact: 'On our setup only the Gemini key is set, so Groq is skipped, and every AI answer so far came from Gemini.'\n\nChart: 'Same seller, same answers. The AI report gives more trends and twice the hashtags. When no AI answers, the seller still gets a template plan built only from their own answers, clearly labelled.'\n\nSafety: 'A caption that mentions any price the seller did not give is rejected. A wrong price is the most harmful mistake.' A real problem we found: Gemini spent its token budget on hidden thinking and returned empty answers, so for Gemini only we send reasoning_effort none.`);

  // 7 ================================================================ B2: research data sources
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "PERSON B  ·  2 / 4  ·  MARKET RESEARCH: WHERE THE DATA COMES FROM");
  s.addText("Three sources we can trust, and the data we chose not to collect", { placeholder: "title" });
  const srcs = [
    ["1", "The seller's own answers", "Product, city, price range, cost per piece, buyers, goal. The most reliable data: they know their own business.", "Checked by zod before anything runs", C.accent2],
    ["2", "Fixed facts in our code", "Festival dates we are sure of. Profit and margin maths. Never asked of the AI.", "Exact: marked “calculated” in the report", C.accent2],
    ["3", "The AI's general knowledge", "Buyer persona, trends, content ideas, hashtags. Not live data: the AI has no internet access.", "Shown as advice, never as fact", C.accent3],
  ];
  srcs.forEach(([k, hd, body, tag, col], i) => {
    const y = 1.6 + i * 1.22;
    box(s, 0.6, y, 4.55, 1.12);
    s.addShape(pres.ShapeType.rect, { x: 0.6, y, w: 0.07, h: 1.12, fill: { color: col }, line: { color: col, width: 0 }, objectName: name("Rule") });
    text(s, [{ text: `${k}  ${hd}`, options: { bold: true, fontSize: 13, breakLine: true } }, { text: body, options: { fontSize: 11, color: C.text2, breakLine: true } }, { text: tag, options: { fontSize: 11, bold: true, color: col } }], { x: 0.85, y: y + 0.06, w: 4.2, h: 1.02, paraSpaceAfter: 2 });
  });
  const mom = ai.moments;
  s.addChart(pres.charts.BAR, [{ name: "Days away", labels: mom.map((m) => m.name), values: mom.map((m) => m.daysAway) }], {
    x: 5.4, y: 1.6, w: 3.6, h: 3.56, barDir: "bar", chartColors: [H.accent2], showValue: true, dataLabelPosition: "outEnd", showLegend: false, catAxisOrientation: "maxMin",
    valAxisMinVal: 0, valAxisMaxVal: 80, valAxisMajorUnit: 20, barGapWidthPct: 45, showTitle: true, title: "Source 2: days to each festival", ...axis(), objectName: name("Chart"),
  });
  text(s, "upcomingMoments(): the next 75 days, from a list in code. Report date: 26 Oct.", { x: 5.4, y: 5.2, w: 3.6, h: 0.45, fontSize: 10, color: C.text2 });
  text(s, "Not used, and why", { x: 9.25, y: 1.6, w: 3.48, h: 0.32, fontSize: 13, bold: true });
  const notUsed = [["Scraping Instagram, Meesho, Amazon", "Against Meta's terms on automated data collection; gets blocked; collects other people's data"], ["Instagram Hashtag Search API", "30 hashtags per 7 days, a business account, and Meta's app review"], ["Google Trends API", "Still in alpha, for selected developers only"], ["Paid market-data tools", "Breaks our rule: free services only"]];
  notUsed.forEach(([hd, why], i) => {
    const y = 1.98 + i * 0.8;
    box(s, 9.25, y, 3.48, 0.72);
    text(s, [{ text: hd, options: { bold: true, breakLine: true, color: C.accent1 } }, { text: why, options: { color: C.text2, fontSize: 10 } }], { x: 9.4, y, w: 3.2, h: 0.72, fontSize: 11, valign: "middle" });
  });
  box(s, 0.6, 5.75, 12.13, 1.05, C.text1);
  text(s, "How the data is cleaned", { x: 0.85, y: 5.82, w: 3, h: 0.3, fontSize: 12, bold: true, color: C.accent3 });
  text(s, [
    { text: "Coming in: ", options: { bold: true, color: C.background1 } }, { text: "answersSchema (zod) checks every field; a mistake returns 400 with a list of the wrong fields.", options: { color: C.accent6, breakLine: true } },
    { text: "Coming back from the AI: ", options: { bold: true, color: C.background1 } }, { text: "extractJSON → findingsSchema (zod) → normalise(): hashtags get #, duplicates go, prices in order, week Mon to Sun.", options: { color: C.accent6 } },
  ], { x: 0.85, y: 6.12, w: 11.7, h: 0.66, fontSize: 11, paraSpaceAfter: 2 });
  source(s, `Source: src/lib/research/build.ts and schema.ts; festival days from report ${ai.id}. External limits: Meta's automated data collection terms, Instagram Graph API hashtag search docs, Google's Trends API alpha announcement (July 2025).`);
  s.addNotes("PERSON B. Say this clearly first: 'Sir, the research feature does not scrape anything and does not call any market-data API. That was a deliberate decision.'\n\n'The report is built from three sources. One: the seller's own answers, the most reliable data. Two: fixed facts in our code, like festival dates and the profit maths. The chart shows those dates for a report made on 26 October. Three: the AI's general knowledge, which we only show as advice, because it has no internet access.'\n\nRight column: 'Scraping Instagram or Meesho is against their terms and gets blocked, and it collects other people's data. Instagram's official hashtag API allows 30 hashtags a week and needs a business account and Meta's review. Google's Trends API is still alpha. Paid tools break our free-only rule.'\n\nBottom: 'Data is cleaned twice: the seller's input is checked by zod, and the AI's answer is checked and tidied before it is saved.'");

  // 8 ================================================================ B3: comparison
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "PERSON B  ·  3 / 4  ·  HOW WE COMPARE");
  s.addText("Compared in code: price against cost, and against the AI's range", { placeholder: "title" });
  const cost = ai.answers.costPerPiece, pts = [["Your lowest", ai.answers.priceMin], ["AI's lowest", ai.findings.pricing.minRupees], ["Your highest", ai.answers.priceMax], ["AI's highest", ai.findings.pricing.maxRupees]];
  const margin = (p) => Math.round(((p - cost) / p) * 100);
  const mlabels = pts.map(([l, p]) => `${l} ₹${p.toLocaleString("en-IN")}`);
  s.addChart([
    { type: pres.charts.BAR, data: [{ name: "Margin", labels: mlabels, values: pts.map(([, p]) => margin(p)) }], options: { chartColors: pts.map(([, p]) => (margin(p) < 30 ? H.accent3 : H.accent2)), barGapWidthPct: 55, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '0"%"' } },
    { type: pres.charts.LINE, data: [{ name: "“Thin margin” line: 30%", labels: mlabels, values: pts.map(() => 30) }], options: { chartColors: [H.accent1], lineSize: 2, lineDataSymbol: "none", lineDash: "dash", showValue: false } },
  ], {
    x: 0.6, y: 1.6, w: 6.55, h: 3.9, showValue: false, valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 20, valAxisLabelFormatCode: '0"%"',
    showLegend: true, legendPos: "b", showTitle: true, title: `Margin per piece at each price, cost ₹${cost} (cotton kurtis, Jaipur)`, ...axis(), objectName: name("Chart"),
  });
  // price-range infographic
  box(s, 7.45, 1.6, 5.28, 2.3, C.background1);
  text(s, "Where the seller stands, in rupees", { x: 7.65, y: 1.68, w: 4.9, h: 0.3, fontSize: 13, bold: true });
  const rx = 7.75, rw = 4.7, rmax = 1600, X = (v) => rx + (v / rmax) * rw;
  const rows = [["Your range", ai.answers.priceMin, ai.answers.priceMax, C.text1], ["AI suggests", ai.findings.pricing.minRupees, ai.findings.pricing.maxRupees, C.accent1]];
  rows.forEach(([l, a, b, col], i) => {
    const y = 2.18 + i * 0.55;
    s.addShape(pres.ShapeType.rect, { x: X(a), y, w: X(b) - X(a), h: 0.3, fill: { color: col }, line: { color: col, width: 0 }, objectName: name("Range") });
    text(s, `${l}: ₹${a}–₹${b.toLocaleString("en-IN")}`, { x: X(a) + 0.08, y, w: 3.2, h: 0.3, fontSize: 10, bold: true, color: C.background1, valign: "middle" });
  });
  s.addShape(pres.ShapeType.line, { x: X(cost), y: 2.08, w: 0, h: 1.25, line: { color: H.accent3, width: 2, dashType: "dash" }, objectName: name("Cost line") });
  text(s, `cost ₹${cost}`, { x: X(cost) - 1.15, y: 2.18, w: 1.08, h: 0.3, fontSize: 10, bold: true, color: C.accent3, align: "right", valign: "middle" });
  s.addShape(pres.ShapeType.line, { x: rx, y: 3.4, w: rw, h: 0, line: { color: H.accent5, width: 0.75 }, objectName: name("Axis") });
  for (let v = 0; v <= rmax; v += 400) text(s, `₹${v.toLocaleString("en-IN")}`, { x: X(v) - 0.35, y: 3.45, w: 0.7, h: 0.22, fontSize: 9, color: C.accent4, align: "center" });
  const hn = shot(s, shots[5], 7.5, 4.12, 5.18, "The report page: Your numbers, calculated: profit at 499 rupees is 99, a 20% margin; at 1,299 it is 899, 69%. Selling days coming up: Diwali in 13 days and more");
  text(s, [
    { text: "Saved as a code, not a sentence: ", options: { bold: true } },
    { text: '{ code: "thin", pct: 20 }', options: { fontFace: "Courier New" } },
    { text: ", so the same report shows in English or Hindi." },
  ], { x: 0.6, y: 5.62, w: 6.55, h: 0.5, fontSize: 11 });
  box(s, 0.6, 6.18, 6.55, 0.62, C.accent6);
  text(s, [{ text: "Stated plainly: ", options: { bold: true } }, { text: "we do not compare with competitors, because we have no legal source for their prices. This is a planning tool, not live market intelligence." }], { x: 0.78, y: 6.18, w: 6.25, h: 0.62, fontSize: 11, valign: "middle" });
  source(s, `Source: report ${ai.id} (Gemini 2.5 Flash, 26 Oct 2026); margins from economics() in src/lib/research/build.ts; screenshot of the same report in the running app.`);
  s.addNotes(`PERSON B. 'This is a real report: a seller of cotton kurtis in Jaipur, prices ₹${ai.answers.priceMin} to ₹${ai.answers.priceMax}, cost ₹${cost} per piece. The AI suggested ₹${ai.findings.pricing.minRupees} to ₹${ai.findings.pricing.maxRupees}.'\n\n'The chart is calculated in code, never by the AI, because language models make arithmetic mistakes. At the seller's lowest price the margin is only ${margin(ai.answers.priceMin)} percent, below our 30 percent line, so the report warns "thin margin". At the AI's lowest price it would be ${margin(ai.findings.pricing.minRupees)} percent.'\n\n'The warning is saved as a code, not a sentence, so one report can be shown in English or Hindi.'\n\nIf asked "so this isn't real market research?": 'Correct, sir. It is a guided planning tool. A small seller's first questions are: what is my margin, when should I sell, who should I sell to. It answers those correctly. Live market data is future work.'`);

  // 9 ================================================================ B4: quota, security, config, tests
  s = pres.addSlide({ masterName: "CONTENT" });
  kicker(s, "PERSON B  ·  4 / 4  ·  QUOTA, SECURITY, CONFIG AND TESTS");
  s.addText("Running on free services: the GPU allows about 8 photos a day", { placeholder: "title" });
  const per = 26, day = 300, reserve = 60, limit = ledger.runsLimit.runs;
  const made = Array.from({ length: 11 }, (_, i) => i);
  const byTime = made.map((k) => { const left = day - per * k; return left >= reserve ? Math.floor((left - reserve) / per) + 1 : 0; });
  const byRuns = made.map((k) => Math.max(0, limit - k));
  s.addChart(pres.charts.LINE, [
    { name: "Left by GPU time (300 s a day, 60 s reserved to start)", labels: made.map(String), values: byTime },
    { name: `Left by run limit (learned: ${limit})`, labels: made.map(String), values: byRuns },
  ], {
    x: 0.6, y: 1.6, w: 6.55, h: 3.7, chartColors: [H.accent3, H.accent1], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6, showLegend: true, legendPos: "b",
    valAxisMinVal: 0, valAxisMaxVal: 10, valAxisMajorUnit: 2, showTitle: true, title: "Photos left in the day, after each photo made", showCatAxisTitle: true, catAxisTitle: "photos made today",
    catAxisTitleFontSize: 11, catAxisTitleColor: H.dk2, ...axis(), objectName: name("Chart"),
  });
  const used = ledger.runs.filter((r) => r.at < ledger.refusal.at && r.at >= ledger.runs[0].at).reduce((a, r) => a + r.ms, 0) / 1000;
  text(s, [
    { text: "Real: ", options: { bold: true } },
    { text: `on 26 Oct Hugging Face refused the 9th photo (“runs limit”) with only ${Math.round(used)} s of 300 used. The app learned the limit from that message. photosLeft = min(by time, by runs).` },
  ], { x: 0.6, y: 5.38, w: 6.55, h: 0.62, fontSize: 11 });
  shot(s, shots[3], 0.65, 6.05, 2.95, "The quota card in the app: Free GPU time today, about 8 photos left, GPU time 0s of 5m 00s, photos 0 of 8");
  text(s, "The same numbers, shown to the seller in the app", { x: 3.8, y: 6.05, w: 3.3, h: 0.75, fontSize: 11, color: C.text2, valign: "middle" });
  box(s, 7.45, 1.6, 5.28, 2.62, C.background1);
  text(s, "Security", { x: 7.65, y: 1.68, w: 4.9, h: 0.3, fontSize: 13, bold: true });
  text(s, [
    { text: "Every route that creates something checks the passcode first; reads stay open", options: { bullet: true, breakLine: true } },
    { text: "Compared with timingSafeEqual, so timing can't reveal it", options: { bullet: true, breakLine: true } },
    { text: "AI and GPU keys stay in .env on the server, never sent to the browser", options: { bullet: true, breakLine: true } },
    { text: "No buyer's name or phone is ever collected", options: { bullet: true, breakLine: true } },
    { text: "One .env file, re-read on every call: a new key works without a restart", options: { bullet: true, breakLine: true } },
    { text: "Not yet: a real login, locked report links, encryption at rest", options: { bullet: true, color: C.accent1 } },
  ], { x: 7.65, y: 2.0, w: 4.95, h: 2.18, fontSize: 11, paraSpaceAfter: 3 });
  const tA = [["Quota maths + run limit", 9], ["Captions", 6], ["Research", 6], ["Passcode guard", 2], ["Text-AI chain", 2], ["Hindi strings", 1]];
  s.addChart(pres.charts.BAR, [{ name: "Tests", labels: tA.map((t) => t[0]), values: tA.map((t) => t[1]) }], {
    x: 7.45, y: 4.35, w: 5.28, h: 2.45, barDir: "bar", chartColors: [H.accent2], showValue: true, dataLabelPosition: "outEnd", showLegend: false, catAxisOrientation: "maxMin", barGapWidthPct: 35,
    valAxisMinVal: 0, valAxisMaxVal: 10, valAxisMajorUnit: 2, showTitle: true, title: "Person B's 26 of the app's 54 tests (all pass, no network)", ...axis(), objectName: name("Chart"),
  });
  source(s, "Source: src/lib/quota.ts (photosFitting), data/gpu-quota.json, src/lib/guard.ts, src/lib/env.ts; `npm test` on 26 Nov 2026: 4 files, 54 passed. Config: one .env, re-read on every call, so a new key works without a restart.");
  s.addNotes(`PERSON B. 'Hugging Face gives a free account 5 minutes of GPU a day, plus a limit on the number of runs that it does not publish, and it has no API to ask what is left. So the app keeps its own ledger.'\n\nChart: 'Each call needs 60 seconds free just to start, and a photo really uses about 26. The amber line is how many photos the time allows. The magenta line is the run limit. On 26 October Hugging Face refused our 9th photo with only about ${Math.round(used)} seconds used, saying "runs limit". The app read that message and learned the limit is ${limit}. It shows the smaller of the two.'\n\nSecurity: 'There is no login. Anyone with the link could spend our free quota, so every route that creates something checks a passcode first, compared in constant time. Keys never leave the server. What we have not done yet: real accounts, locking saved report links, encryption.'\n\nTests: 'My parts have 26 of the 54 tests. None of them uses the network: fake providers are passed in, so tests are fast and do not spend quota.'\n\nClose: 'Three principles: protect the free resources, never trust the AI blindly, and keep working when something fails.'`);

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
