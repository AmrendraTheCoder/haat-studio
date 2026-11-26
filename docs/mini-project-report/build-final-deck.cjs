// The mini-project presentation. Every chart is native PowerPoint and every number comes from
// generated/deck-data.json, which build.py writes from the project's result files.
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
const FIG = (n) => R(`docs/mini-project-report/generated/fig/${n}`);
const REPO = "github.com/AmrendraTheCoder/haat-studio";

// ---------------------------------------------------------------- theme
const THEME = {
  name: "Haat Studio",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: { dk1: "1C1917", lt1: "FFFFFF", dk2: "5F5650", lt2: "F6F1EA", accent1: "C8105A", accent2: "2F6F4E", accent3: "D98E04", accent4: "8C8279", accent5: "CFC6BB", accent6: "ECE5DA", hlink: "C8105A", folHlink: "5F5650" },
};
const H = THEME.colors;
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Haat Studio: Garment-to-Model Virtual Try-On for Small Online Sellers";
pres.author = "Amrendra Vikram Singh, Avirat Kaushik";
const C = pres.SchemeColor;
const W = 13.333, MX = 0.7, CW = W - 2 * MX; // margins and content width

pres.defineSlideMaster({ title: "TITLE", background: { color: H.dk1 }, objects: [] });
pres.defineSlideMaster({
  title: "SECTION", background: { color: H.dk1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: MX, y: 3.05, w: 11.5, h: 1.2, fontSize: 44, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "Section" } },
    { placeholder: { options: { name: "body", type: "body", x: MX, y: 4.35, w: 10.5, h: 1.0, fontSize: 20, color: C.accent5, valign: "top", align: "left", margin: 0 }, text: "What this section covers" } },
  ],
  slideNumber: { x: W - MX - 0.6, y: 6.95, w: 0.6, h: 0.3, fontSize: 11, color: H.accent4, align: "right" },
});
pres.defineSlideMaster({
  title: "CONTENT", background: { color: H.lt2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: MX, y: 0.72, w: CW, h: 0.82, fontSize: 28, bold: true, color: C.text1, valign: "top", align: "left", margin: 0 }, text: "Title" } },
    { text: { text: "Haat Studio", options: { x: MX, y: 6.98, w: 3, h: 0.28, fontSize: 10, bold: true, color: H.accent4, margin: 0, valign: "middle" } } },
  ],
  slideNumber: { x: W - MX - 0.6, y: 6.98, w: 0.6, h: 0.28, fontSize: 10, color: H.accent4, align: "right" },
});

// ---------------------------------------------------------------- helpers
let n = 0;
const nm = (s) => `${s} ${++n}`;
const text = (s, t, o) => s.addText(t, { isTextBox: true, margin: 0, valign: "top", color: C.text1, fontSize: 15, objectName: nm("Text"), ...o });
const card = (s, x, y, w, h, fill = C.background1, line = H.accent6) =>
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: line ? { color: line, width: 0.75 } : { color: fill, width: 0 }, objectName: nm("Card") });
const kicker = (s, t) => text(s, t.toUpperCase(), { x: MX, y: 0.38, w: CW, h: 0.3, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2 });
const source = (s, t) => text(s, t, { x: 2.2, y: 6.98, w: 9.6, h: 0.28, fontSize: 9.5, color: C.accent4, valign: "middle" });
const bullets = (s, items, o) =>
  text(s, items.map((t, i, a) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: i < a.length - 1 } })), { fontSize: 15, paraSpaceAfter: 8, ...o });
const badge = (s, label, x, y, d = 0.5, fill = C.accent1, size = 16) => {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: nm("Badge") });
  text(s, String(label), { x, y, w: d, h: d, fontSize: size, bold: true, color: C.background1, align: "center", valign: "middle" });
};
const chip = (s, label, x, y, w, fill, color = C.background1, size = 12) => {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h: 0.34, rectRadius: 0.17, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: nm("Chip") });
  text(s, label, { x, y, w, h: 0.34, fontSize: size, bold: true, color, align: "center", valign: "middle" });
};
const stat = (s, big, label, x, y, w, h, color = C.accent1, size = 36, fill = C.background1) => {
  card(s, x, y, w, h, fill, fill === C.background1 ? H.accent6 : null);
  const dark = fill === C.text1;
  text(s, big, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: size / 60, fontSize: size, bold: true, color, fontFace: "Calibri", valign: "middle", fit: "shrink" });
  text(s, label, { x: x + 0.25, y: y + 0.28 + size / 60, w: w - 0.5, h: h - 0.4 - size / 60, fontSize: 14, color: dark ? C.accent5 : C.text2 });
};
const arrowR = (s, x, y, color = C.accent4, w = 0.22) => s.addShape(pres.ShapeType.triangle, { x, y, w, h: 0.18, rotate: 90, fill: { color }, line: { color, width: 0 }, objectName: nm("Arrow") });
const arrowD = (s, x, y, color = C.accent4) => s.addShape(pres.ShapeType.triangle, { x, y, w: 0.22, h: 0.16, rotate: 180, fill: { color }, line: { color, width: 0 }, objectName: nm("Arrow") });
const axis = (o = {}) => ({
  catAxisLabelColor: H.dk2, valAxisLabelColor: H.dk2, catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
  dataLabelFontFace: "+mn-lt", dataLabelFontSize: 12, dataLabelColor: H.dk1, legendFontFace: "+mn-lt", legendFontSize: 12, legendColor: H.dk2, titleFontFace: "+mn-lt", titleFontSize: 14, titleColor: H.dk1,
  valGridLine: { color: H.accent6, size: 0.75 }, catGridLine: { style: "none" }, catAxisLineColor: H.accent5, valAxisLineShow: false,
  plotArea: { fill: { color: H.lt1 } }, chartArea: { fill: { color: H.lt1 }, roundedCorners: false }, ...o,
});
const tableOpts = (o) => ({ fontSize: 14, fontFace: "Calibri", color: H.dk1, fill: { color: H.lt1 }, border: { type: "solid", color: H.accent6, pt: 0.75 }, valign: "middle", margin: [0.04, 0.1, 0.04, 0.1], objectName: nm("Table"), ...o });
const th = (labels) => labels.map((t) => ({ text: t, options: { bold: true, color: H.lt1, fill: { color: H.dk1 } } }));
const sizes = {};
const img = (s, file, x, y, w, alt, h = null) => {
  const m = sizes[file];
  if (!m) return 0;
  let ww = w, hh = (w * m.height) / m.width;
  if (h && hh > h) { hh = h; ww = (h * m.width) / m.height; x += (w - ww) / 2; }
  s.addShape(pres.ShapeType.rect, { x: x - 0.04, y: y - 0.04, w: ww + 0.08, h: hh + 0.08, fill: { color: H.lt1 }, line: { color: H.accent5, width: 0.75 }, objectName: nm("Frame") });
  s.addImage({ path: file, x, y, w: ww, h: hh, altText: alt, objectName: nm("Image") });
  return hh;
};
const labHex = ([L, a, b]) => {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = 0.95047 * inv(fx), Y = inv(fy), Z = 1.08883 * inv(fz);
  const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  return lin.map((c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0"); }).join("").toUpperCase();
};
// pptxgenjs gives the slide-number field id 25 and can give a table the id of another shape, so
// slides with many shapes end up with two shapes sharing an id. PowerPoint then reports the file
// as damaged. Renumber every shape on every slide and layout: 1 for the shape tree, then 2, 3, ...
async function uniqueShapeIds(file) {
  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  for (const name of Object.keys(zip.files).filter((f) => /^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(f))) {
    const xml = await zip.file(name).async("string");
    let next = 1;
    const fixed = xml.replace(/<p:cNvPr id="\d+"/g, () => `<p:cNvPr id="${next++}"`);
    if (fixed !== xml) zip.file(name, fixed);
  }
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}
const rs = (x) => `₹${Number(x).toLocaleString("en-IN")}`;
const plain = (t) => String(t).replace(/\\,\$\\times\$\\,/g, "×").replace(/\$\\times\$/g, "×").replace(/[{}$\\]/g, "");
const section = (num, title, sub) => {
  const s = pres.addSlide({ masterName: "SECTION", sectionTitle: currentSection });
  text(s, num, { x: MX, y: 1.55, w: 3, h: 1.3, fontSize: 80, bold: true, color: C.accent1, fontFace: "Cambria" });
  s.addText(title, { placeholder: "title" });
  s.addText(sub, { placeholder: "body" });
  return s;
};
let currentSection = "Opening";
const addSection = (t) => { currentSection = t; pres.addSection({ title: t }); };
const content = (sec, kick, title) => {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: sec });
  kicker(s, kick);
  s.addText(title, { placeholder: "title" });
  return s;
};

(async () => {
  const sharp = require("sharp");
  const shots = R("docs/btp-report/figures/team");
  const files = {
    ba: `${shots}/shot-beforeafter.png`, saved: `${shots}/shot-saved.png`, sheet: R("ml/data/pairs/pairs-sheet.jpg"), skirt: R("docs/btp-report/figures/skirt-on-separates.jpg"),
    uiReview: R("docs/btp-report/figures/ui/studio-review.png"), uiResult: R("docs/btp-report/figures/ui/studio-result.png"),
    strips: FIG("lora_strips.jpg"), palettes: FIG("palettes.png"),
  };
  for (const f of Object.values(files)) if (fs.existsSync(f)) sizes[f] = await sharp(f).metadata();
  const lm = (D.lora && D.lora.metrics) || {};

  // ============================================================ 1 title
  addSection("Opening");
  let s = pres.addSlide({ masterName: "TITLE", sectionTitle: "Opening" });
  text(s, "MINI PROJECT  ·  B.TECH 5TH SEMESTER  ·  LNMIIT JAIPUR", { x: MX, y: 0.75, w: 7.5, h: 0.35, fontSize: 13, bold: true, color: C.accent3, charSpacing: 2 });
  text(s, "Haat Studio", { x: MX, y: 1.45, w: 7.5, h: 1.1, fontSize: 60, bold: true, color: C.background1, fontFace: "Cambria" });
  text(s, "Garment-to-model virtual try-on\nfor small online sellers", { x: MX, y: 2.6, w: 7.5, h: 1.2, fontSize: 26, color: C.accent6, fontFace: "Cambria" });
  text(s, "FASHN VTON 1.5  ·  LoRA adaptation  ·  guardrails  ·  market engines", { x: MX, y: 3.95, w: 7.5, h: 0.4, fontSize: 15, color: C.accent5 });
  s.addShape(pres.ShapeType.line, { x: MX, y: 4.75, w: 1.2, h: 0, line: { color: H.accent1, width: 2.5 }, objectName: nm("Rule") });
  text(s, [
    { text: "Amrendra Vikram Singh", options: { bold: true, color: C.background1 } }, { text: "   24UEC092", options: { color: C.accent5, breakLine: true } },
    { text: "Avirat Kaushik", options: { bold: true, color: C.background1 } }, { text: "   24UCS235", options: { color: C.accent5, breakLine: true } },
    { text: "Guide: Dr. Nishant Gupta", options: { color: C.accent6, breakLine: !!V.LiveUrl } },
    ...(V.LiveUrl ? [{ text: "Live:  ", options: { color: C.accent5 } }, { text: V.LiveUrl.replace(/^https?:\/\//, ""), options: { color: C.accent3, bold: true, hyperlink: { url: V.LiveUrl } } }] : []),
  ], { x: MX, y: 5.0, w: 7, h: V.LiveUrl ? 1.9 : 1.5, fontSize: 17, paraSpaceAfter: 6 });
  if (sizes[files.ba]) {
    const hh = 6.1, ww = (hh * sizes[files.ba].width) / sizes[files.ba].height;
    s.addImage({ path: files.ba, x: W - MX - ww, y: 0.7, w: ww, h: hh, altText: "The app's before-and-after view of a real try-on", objectName: nm("Image") });
    text(s, "A real result from the app: before | after", { x: W - MX - ww, y: 6.88, w: ww, h: 0.3, fontSize: 12, color: C.accent5, align: "center" });
  }
  s.addNotes("Introduce the team and the guide. One sentence: a seller's flat garment photo becomes an on-model photo, an Instagram post and a pricing plan, on free services; and we built the pipeline to adapt the try-on model itself.");

  // ============================================================ 2 problem
  s = content("Opening", "The problem", "A seller has one flat photo. A buyer wants to see it worn.");
  const probs = [["Photo", "A studio shoot with a model costs thousands of rupees a day. We generate the on-model photo from the flat one.", "Try-on studio"],
    ["Post", "The photo becomes an Instagram post with price, MRP, offer and a caption in English, Hinglish or Hindi.", "Post maker"],
    ["Plan", "What price, which words and hashtags, and when to post, with every number computed from real listings.", "Market engines"]];
  probs.forEach(([hd, b, tag], i) => {
    const x = MX + i * 4.08, w = 3.85;
    card(s, x, 1.85, w, 3.45);
    badge(s, i + 1, x + 0.35, 2.15, 0.62, C.accent1, 20);
    text(s, hd, { x: x + 0.35, y: 2.95, w: w - 0.7, h: 0.55, fontSize: 26, bold: true, fontFace: "Cambria" });
    text(s, b, { x: x + 0.35, y: 3.55, w: w - 0.7, h: 1.25, fontSize: 15, color: C.text2 });
    text(s, tag.toUpperCase(), { x: x + 0.35, y: 4.85, w: w - 0.7, h: 0.3, fontSize: 12, bold: true, color: C.accent2, charSpacing: 1 });
  });
  card(s, MX, 5.55, CW, 1.2, C.text1, null);
  [[`${V.MedTotal} s`, "median time for a new photo on the free GPU"], ["₹0", "every service used is a free tier"], [`${V.BaseParamsM}M`, "parameters in the model we adapt"]].forEach(([b, l], i) => {
    const x = MX + 0.35 + i * 3.98;
    text(s, b, { x, y: 5.55, w: 1.5, h: 1.2, fontSize: 30, bold: true, color: i === 1 ? C.accent3 : C.background1, valign: "middle" });
    text(s, l, { x: x + 1.55, y: 5.55, w: 2.05, h: 1.2, fontSize: 14, color: C.accent5, valign: "middle" });
  });
  s.addNotes("Photo, post, plan. The try-on model is FASHN AI's open model; our work is the system around it, the training method it lacked, the adaptation pipeline, the guardrails and the content engines.");

  // ============================================================ 3 the product, as a kit
  s = content("Opening", "What Haat Studio is", "One kit, two free keys: photo, post and plan for any small seller");
  card(s, MX, 1.85, 4.6, 4.9, C.text1, null);
  text(s, [
    { text: "Public source code that a seller, a student or a small agency can run from a laptop.", options: { bold: true, color: C.background1, breakLine: true } },
    { text: " ", options: { fontSize: 8, breakLine: true } },
    { text: "A free Hugging Face token makes the photos on a shared GPU. A free Gemini key writes the captions. Pricing, SEO titles, hashtags and the location calendar are plain code on the laptop, so they cost nothing and never invent a number.", options: { color: C.accent6 } },
  ], { x: MX + 0.35, y: 2.15, w: 3.9, h: 3.3, fontSize: 17, paraSpaceAfter: 4 });
  text(s, REPO, { x: MX + 0.35, y: 5.95, w: 4.0, h: 0.5, fontSize: 13, bold: true, color: C.accent3, fontFace: "Courier New" });
  const tiles = [["Photo", "garment onto a model, 32 s on the free GPU", "HF token"], ["Caption", "English, Hinglish or Hindi; price-checked", "Gemini key"], ["Price band", `from ${V.MkTotalClean} real listings`, "code"],
    ["SEO title", "built from the words buyers search", "code"], ["Hashtags", "broad, niche, local and occasion tags", "code"], ["GEO", "city tags and the festival calendar", "code"]];
  tiles.forEach(([hd, sub, key], i) => {
    const col = i % 3, row = Math.floor(i / 3), x = 5.6 + col * 2.37, y = 1.85 + row * 2.5, w = 2.22;
    card(s, x, y, w, 2.3);
    text(s, hd, { x: x + 0.22, y: y + 0.25, w: w - 0.44, h: 0.45, fontSize: 20, bold: true, fontFace: "Cambria" });
    text(s, sub, { x: x + 0.22, y: y + 0.78, w: w - 0.44, h: 0.95, fontSize: 14, color: C.text2 });
    chip(s, key, x + 0.22, y + 1.8, key === "code" ? 0.8 : 1.25, key === "code" ? C.accent2 : C.accent1, C.background1, 11);
  });
  source(s, `Laptop-proof: LoRA training fitted in ${V.LcPeakGb} GB on an 8 GB MacBook; one photo can even be made offline there (${V.GenMinutes} min instead of ${V.MedTotal} s).`);
  s.addNotes("This is the product in one slide. Anyone can clone it, add two free keys and run it. The GPU-heavy part, the try-on, runs on Hugging Face's free GPU; the text part on Gemini's free tier; everything that involves numbers is our own code. And the whole model-adaptation pipeline runs on an ordinary 8 GB laptop, which we proved by training on one.");

  // ============================================================ 4 product tour
  if (sizes[files.uiReview] && sizes[files.uiResult]) {
    s = content("Opening", "The product", "A guided studio: choose, review, create, check");
    const sw = 5.85;
    const h1 = img(s, files.uiReview, MX, 1.85, sw, "The Review step: every choice with an Edit link, the time and the free quota it will use", 4.1);
    const h2 = img(s, files.uiResult, W - MX - sw, 1.85, sw, "The result screen with the before/after slider and the quality checks", 4.1);
    const cy = 1.85 + Math.max(h1, h2) + 0.25;
    text(s, [{ text: "Review before anything is spent. ", options: { bold: true } }, { text: "Every choice with an Edit link, the time and the free quota it will use.", options: { color: C.text2 } }], { x: MX, y: cy, w: sw, h: 0.8, fontSize: 15 });
    text(s, [{ text: "Checked before it is shown. ", options: { bold: true } }, { text: "Five quality checks on every photo; here a fair warning on a skirt over a dress.", options: { color: C.text2 } }], { x: W - MX - sw, y: cy, w: sw, h: 0.8, fontSize: 15 });
    source(s, `Screenshots of the running app · 38 sample garments · "?" help on every control · English and Hindi · ${D.tests.app} automated tests`);
    s.addNotes("The studio guides the seller through product, model and a review step that shows exactly what will be spent before anything runs. Every result goes through automatic quality checks.");
  }

  // ============================================================ section 1: the model we started from
  addSection("The base model");
  section("01", "The model we started from", "FASHN VTON 1.5: what it is, how it works, and where it comes from");

  // 5 what it is
  s = content("The base model", "FASHN VTON 1.5, before our work", "An open try-on model, released without its training code");
  [[`${V.BaseParamsM}M`, "parameters, a multimodal diffusion transformer"], ["864×576", "pixels generated directly: no VAE, so print and logo text survive"], ["~18M", "image pairs it was trained on (model card)"], ["~5 s", "per photo on an NVIDIA H100 (model card)"]].forEach(([b, l], i) =>
    stat(s, b, l, MX + i * 3.04, 1.85, 2.88, 1.85, i % 2 ? C.text1 : C.accent1, 34));
  card(s, MX, 3.95, 5.9, 2.8);
  text(s, "What it does", { x: MX + 0.3, y: 4.15, w: 5.3, h: 0.4, fontSize: 18, bold: true, color: C.accent2, fontFace: "Cambria" });
  bullets(s, ["Takes a person photo and a garment photo, flat or worn by someone else", "Needs no mask: it decides itself what to replace", "Three categories: tops, bottoms, one-pieces", "Apache-2.0 weights and inference code"], { x: MX + 0.3, y: 4.62, w: 5.35, h: 2.1 });
  card(s, MX + 6.13, 3.95, CW - 6.13, 2.8, C.text1, null);
  text(s, "What was missing", { x: MX + 6.43, y: 4.15, w: 5.3, h: 0.4, fontSize: 18, bold: true, color: C.accent3, fontFace: "Cambria" });
  bullets(s, ["No training code and no paper: it could not be adapted", "No saree or lehenga category; trained mostly on Western garments", "A non-commercial human parser loaded with it", "No checks on what it outputs; a tiny free GPU quota"], { x: MX + 6.43, y: 4.62, w: 5.4, h: 2.1, color: C.background1 });
  source(s, "Source: FASHN AI model card and fashn-vton 1.5.0 source; 971,813,808 parameters counted on the released weights.");
  s.addNotes("This is the model as FASHN AI released it in 2026. It is good, it is open, and it is pixel-space, which is why logos stay sharp. But it came without the code to train it, without Indian categories, and with nothing that checks its output. Those gaps are exactly where our project sits.");

  // 6 how it works
  s = content("The base model", "How it works before our integration", "The garment is read through attention, not cut and pasted");
  const node = (x, y, w, h, hd, sub, fill = C.background1, dark = false) => {
    card(s, x, y, w, h, fill, dark ? null : H.accent5);
    text(s, [{ text: hd, options: { bold: true, fontSize: 16, breakLine: true, color: dark ? C.background1 : C.text1 } }, { text: sub, options: { fontSize: 13, color: dark ? C.accent6 : C.text2 } }], { x: x + 0.12, y, w: w - 0.24, h, align: "center", valign: "middle" });
  };
  node(MX, 1.9, 2.55, 1.15, "Person photo", "+ body pose → 3,456 tokens");
  node(MX, 3.35, 2.55, 1.15, "Garment photo", "+ garment pose → 3,456 tokens");
  arrowR(s, MX + 2.62, 2.38); arrowR(s, MX + 2.62, 3.83);
  node(3.75, 1.9, 2.9, 2.6, "8 double-stream blocks", "one joint attention over all 6,912 tokens: every patch of the person can look at every patch of the garment", C.text1, true);
  arrowR(s, 6.72, 3.11);
  node(7.05, 1.9, 2.4, 2.6, "16 single-stream blocks", "both sequences, shared weights");
  arrowR(s, 9.52, 3.11);
  node(9.85, 1.9, W - MX - 9.85, 2.6, "Next, cleaner image", "predicts the velocity from noise towards the photo", C.accent1, true);
  s.addShape(pres.ShapeType.line, { x: 3.75, y: 4.82, w: W - MX - 3.75, h: 0, line: { color: H.accent1, width: 1.5, dashType: "dash", beginArrowType: "triangle" }, objectName: nm("Loop") });
  text(s, "repeat: 30 steps, each run with and without the garment (guidance 1.5) = 60 passes per photo", { x: 3.75, y: 4.9, w: W - MX - 3.75, h: 0.35, fontSize: 14, italic: true, color: C.accent1, align: "center" });
  [["Pixel space", "no compression step, so small print and logo letters stay sharp"], ["Joint attention", "a chest patch finds the logo patch by itself; nothing is warped"], ["Unguided last step", "the final step drops guidance, so colours are not over-saturated"]].forEach(([hd, b], i) => {
    const x = MX + i * 4.08;
    card(s, x, 5.45, 3.85, 1.3);
    text(s, [{ text: hd, options: { bold: true, color: C.accent2, breakLine: true } }, { text: b, options: { color: C.text2, fontSize: 14 } }], { x: x + 0.25, y: 5.45, w: 3.4, h: 1.3, fontSize: 15, valign: "middle" });
  });
  source(s, "Source: tryon_mmdit.py and pipeline.py in fashn-vton 1.5.0; architecture adapted from FLUX.1. Report chapter 4.");
  s.addNotes("Both photos are cut into 12 by 12 pixel squares, 3,456 each. In the eight double-stream blocks every square of the person can look at every square of the garment: that is how the logo ends up on the chest. The network predicts which way to move from noise towards a photo; 30 such steps, each done twice for guidance, give 60 passes.");

  // 7 where it comes from
  s = content("The base model", "Where it comes from", "Eight years of virtual try-on, and where this project fits");
  const tl = [["2018", "VITON", "Warp the garment onto the body, then blend. Visible seams and blur."],
    ["2024", "OOTDiffusion · IDM-VTON · CatVTON", "Diffusion models: realistic, but a mask is needed and the weights are non-commercial."],
    ["2025", "Leffa", "Flow fields inside attention keep fine detail; preprocessing has other terms."],
    ["2026", "FASHN VTON 1.5", "Pixel space, no mask, Apache-2.0. Released without training code."],
    ["2026", "Haat Studio (this project)", "Served free, made trainable with LoRA, checked by guardrails, joined to market engines."]];
  const cw = (CW - 4 * 0.2) / 5, cx0 = MX + cw / 2, step = cw + 0.2;
  s.addShape(pres.ShapeType.line, { x: cx0, y: 2.6, w: 4 * step, h: 0, line: { color: H.accent5, width: 3 }, objectName: nm("Timeline") });
  tl.forEach(([yr, name, b], i) => {
    const cx = cx0 + i * step, last = i === tl.length - 1;
    s.addShape(pres.ShapeType.ellipse, { x: cx - 0.17, y: 2.43, w: 0.34, h: 0.34, fill: { color: last ? H.accent1 : i === 3 ? H.dk1 : H.lt1 }, line: { color: last ? H.accent1 : H.dk1, width: 2 }, objectName: nm("Dot") });
    text(s, yr, { x: cx - 1, y: 1.85, w: 2, h: 0.45, fontSize: 20, bold: true, align: "center", color: last ? C.accent1 : C.text1 });
    const x = cx - cw / 2;
    card(s, x, 3.05, cw, 3.0, last ? C.text1 : C.background1, last ? null : H.accent6);
    text(s, name, { x: x + 0.18, y: 3.22, w: cw - 0.36, h: 0.95, fontSize: 16, bold: true, color: last ? C.accent3 : i === 3 ? C.accent1 : C.text1, fontFace: "Cambria" });
    text(s, b, { x: x + 0.18, y: 4.2, w: cw - 0.36, h: 1.75, fontSize: 14, color: last ? C.accent6 : C.text2 });
  });
  text(s, "We chose FASHN VTON 1.5 after comparing eight open models: the only one that takes a flat garment photo, needs no mask and allows commercial use.", { x: MX, y: 6.25, w: CW, h: 0.55, fontSize: 15, italic: true, color: C.accent2 });
  source(s, "Report chapter 2 and Table 2.1 (references [2], [6]–[10], [1]).");
  s.addNotes("The field moved from warping garments with GANs, to diffusion models that look real but need masks and forbid commercial use, to FASHN's model, which is open and maskless. Our project is the last step on this line: we did not build a new network, we made this one usable, trainable and safe for small sellers.");

  // ============================================================ section 2: what we built
  addSection("What we built");
  section("02", "What we built on top", "Five layers around and inside the model; the original weights never change");

  // 8 layer stack
  s = content("What we built", "Our layers", "Five layers on top of FASHN VTON 1.5");
  const stack = [
    ["Seller app", "guided studio, review step, English and Hindi, help on every control", `${D.tests.app} tests`, C.background1],
    ["Content engines", "price band, SEO title, hashtags, positioning, GEO calendar; captions through one checked function", `${V.MkTotalClean} listings`, C.background1],
    ["Guardrails", "rules for training data; five checks per photo; ΔE2000 colour", F.ifAppGuard ? `${V.AgWarn} real failures flagged` : "checks", C.background1],
    ["Serving", "one entry point: cache, shared jobs, GPU lock, engine chain, quota ledger", `${V.CacheMs} ms repeat`, C.background1],
    ["LoRA adapters", `${V.LoraLayers} small trainable layers inside the network, ${V.LoraPct}% of its size`, F.ifLora ? `${V.LcDlRel}% denoising error` : `${V.AdapterMb} MB`, C.accent1],
    ["FASHN VTON 1.5", `${V.BaseParamsM}M parameters, frozen: never changed`, "base", C.text1],
  ];
  stack.forEach(([hd, sub, num, fill], i) => {
    const y = 1.82 + i * 0.83, dark = fill !== C.background1;
    card(s, MX, y, CW, 0.72, fill, dark ? null : H.accent6);
    text(s, hd, { x: MX + 0.3, y, w: 2.6, h: 0.72, fontSize: 18, bold: true, color: dark ? C.background1 : C.text1, valign: "middle", fontFace: "Cambria" });
    text(s, sub, { x: MX + 2.95, y, w: 6.5, h: 0.72, fontSize: 14, color: dark ? C.accent6 : C.text2, valign: "middle" });
    text(s, num, { x: W - MX - 2.45, y, w: 2.2, h: 0.72, fontSize: 15, bold: true, color: dark ? C.background1 : i === 2 ? C.accent2 : C.accent1, valign: "middle", align: "right" });
  });
  source(s, "Layers 2–5 are ours; layer 1 is ours inside FASHN's network. Each row is a chapter of the report: 5, 3, 3.8–3.9, 6, 3.10.");
  s.addNotes("This is the whole project in one picture. The bottom is FASHN's model, which we never change. Inside it we add LoRA adapters. Around it: serving on free GPUs, guardrails that check data and outputs, content engines built on real marketplace data, and the app. The right column is one measured number per layer.");

  // 9 serving
  s = content("What we built", "Serving the model", `One entry point, cheapest check first: a new photo takes ${V.MedTotal} s`);
  const st5 = [["Make the key", "hash of both photos and the settings"], ["Already running?", "join that job: no second GPU run"], ["Already saved?", `answer in ${V.CacheMs} ms, no GPU`], ["GPU lock", "one generation at a time"], ["Engine chain", "errors sorted by kind; next engine on failure"]];
  st5.forEach(([hd, sub], i) => {
    const y = 1.85 + i * 0.98;
    card(s, MX, y, 4.75, 0.85, i === 2 ? C.text1 : C.background1, i === 2 ? null : H.accent6);
    badge(s, i + 1, MX + 0.2, y + 0.18, 0.5, i === 2 ? C.accent3 : C.accent1, 15);
    text(s, [{ text: hd, options: { bold: true, breakLine: true, color: i === 2 ? C.background1 : C.text1 } }, { text: sub, options: { fontSize: 13, color: i === 2 ? C.accent6 : C.text2 } }], { x: MX + 0.88, y, w: 3.75, h: 0.85, fontSize: 16, valign: "middle" });
  });
  s.addChart(pres.charts.BAR, [{ name: "Waiting in the queue", labels: D.runs.labels, values: D.runs.queue }, { name: "Running on the GPU", labels: D.runs.labels, values: D.runs.gpu }], {
    x: 5.75, y: 1.85, w: W - MX - 5.75, h: 4.9, barDir: "bar", barGrouping: "stacked", chartColors: [H.accent3, H.accent1], barGapWidthPct: 40, showValue: false,
    showLegend: true, legendPos: "t", showTitle: true, title: `All ${V.NRuns} real generations: seconds from Create to finished`, catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: 40, valAxisMajorUnit: 10, ...axis(), objectName: nm("Chart"),
  });
  source(s, `Source: data/results/*/meta.json, 26–27 Oct 2026. Median ${V.MedGpu} s on the GPU and ${V.MedQueue} s in the queue.`);
  s.addNotes("Every try-on goes through studio.start, so no route can skip these checks. A double click joins the running job; a repeat request comes from disk; only then do we wait for the GPU. Amber is waiting, magenta is the model running.");

  // 10 cache + quota
  s = content("What we built", "Protecting the free GPU", `Repeat requests are free; the hidden daily limit is ${V.RunsLimit} photos`);
  stat(s, `${V.CacheMs} ms`, "a saved result: no GPU used", MX, 1.85, 2.95, 1.75, C.accent2, 38);
  stat(s, `${Number(D.cache[1]).toLocaleString("en-US")} ms`, "a new photo on the free GPU", MX + 3.15, 1.85, 2.95, 1.75, C.accent1, 38);
  card(s, MX, 3.85, 6.1, 2.9, C.text1, null);
  text(s, [{ text: `About ${V.CacheRatio}× faster. `, options: { bold: true, color: C.accent3 } }, { text: "The key is a hash of both photos and the settings, so the same request always finds its saved photo, and a clean JPEG is never re-saved (that would change its bytes and miss the cache).", options: { color: C.accent6, breakLine: true } },
    { text: " ", options: { fontSize: 8, breakLine: true } },
    { text: `On 26 Oct Hugging Face refused our 9th photo after only ${V.UsedAtRefusal} s of GPU time: an unpublished runs limit. The app read the message and now plans for about ${V.RunsLimit} photos a day.`, options: { color: C.background1 } }], { x: MX + 0.3, y: 4.05, w: 5.5, h: 2.6, fontSize: 15 });
  s.addChart(pres.charts.LINE, [{ name: "left by GPU time (300 s a day)", labels: D.quota.x.map(String), values: D.quota.byTime }, { name: `left by the runs limit (${D.quota.limit})`, labels: D.quota.x.map(String), values: D.quota.byRuns }], {
    x: 7.05, y: 1.85, w: W - MX - 7.05, h: 4.9, chartColors: [H.accent3, H.accent1], lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 7, showLegend: true, legendPos: "b", valAxisMinVal: 0, valAxisMaxVal: 10, valAxisMajorUnit: 2,
    showTitle: true, title: "Photos left today, after each photo made", showCatAxisTitle: true, catAxisTitle: "photos made today", catAxisTitleFontSize: 12, catAxisTitleColor: H.dk2, ...axis(), objectName: nm("Chart"),
  });
  source(s, "Source: cache time measured over 25 look-ups; data/gpu-quota.json; src/lib/quota.ts.");
  s.addNotes("The cache answers a repeat request in a third of a millisecond. The quota: each call must have 60 seconds free to start and uses about 26. By time the day allows 10 photos, but Hugging Face also has an unpublished run limit; it refused our ninth photo, and the app learned the limit from that message.");

  // ============================================================ section 3: LoRA
  addSection("Adapting the model");
  section("03", "Adapting the model with LoRA", "Rebuilding the training method, adding adapter layers, and testing old against new");

  // 11 objective
  s = content("Adapting the model", "Making the model trainable", `The missing training method, rebuilt and proved: ${V.LossRatio}× lower loss`);
  s.addChart(pres.charts.BAR, [{ name: "Reconstructed objective (ours)", labels: D.recon.t.map((t) => `t = ${t}`), values: D.recon.ours }, { name: "Reversed convention", labels: D.recon.t.map((t) => `t = ${t}`), values: D.recon.rev }], {
    x: MX, y: 1.85, w: 6.7, h: 4.9, barDir: "col", chartColors: [H.accent2, H.accent5], showLegend: true, legendPos: "b", valAxisLogScaleBase: 10, valAxisMinVal: 0.001, valAxisMaxVal: 10,
    showTitle: true, title: "Loss of the released, untouched model (log scale)", ...axis(), objectName: nm("Chart"),
  });
  card(s, 7.65, 1.85, W - MX - 7.65, 2.45, C.text1, null);
  text(s, [{ text: "The objective, read from the sampler", options: { bold: true, color: C.accent3, breakLine: true } },
    { text: "x_t = (1 − t)·noise + t·photo", options: { fontFace: "Courier New", color: C.background1, breakLine: true } },
    { text: "target = photo − noise", options: { fontFace: "Courier New", color: C.background1, breakLine: true } },
    { text: "garment pixels weighted ×2 (our design)", options: { color: C.accent6, fontSize: 14 } }], { x: 7.95, y: 2.05, w: W - MX - 8.25, h: 2.1, fontSize: 16, paraSpaceAfter: 6 });
  [[`${V.LossRatio}×`, "lower loss than the opposite convention, on the real weights"], [V.EquivDiff, "difference (of 255) between our code and FASHN's: identical"], [V.ParserDiff, "change when the non-commercial parser is removed"]].forEach(([b, l], i) => {
    const y = 4.5 + i * 0.77;
    card(s, 7.65, y, W - MX - 7.65, 0.67);
    text(s, String(b), { x: 7.85, y, w: 1.25, h: 0.67, fontSize: 22, bold: true, color: C.accent2, valign: "middle" });
    text(s, l, { x: 9.1, y, w: W - MX - 9.25, h: 0.67, fontSize: 13, color: C.text2, valign: "middle" });
  });
  source(s, "Source: ml/runs/real-check/report.json, checks on the released weights. Report sections 5.2 and 7.4.");
  s.addNotes("FASHN released no training code. The sampler tells us what the model predicts: the direction from noise to photo. Proof: the untouched model's loss is tiny under our convention and hundreds of times higher under the opposite one.");

  // 12 LoRA
  s = content("Adapting the model", "Adapter layers", `${V.LoraLayers} trainable layers beside the frozen model: ${V.LoraPct}% of its size`);
  card(s, MX, 1.85, 6.0, 3.0);
  const blk = (label, sub, x, y, w, fill) => { s.addShape(pres.ShapeType.roundRect, { x, y, w, h: 0.8, rectRadius: 0.08, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: nm("Block") }); text(s, [{ text: label, options: { bold: true, breakLine: true } }, { text: sub, options: { fontSize: 12 } }], { x, y, w, h: 0.8, align: "center", valign: "middle", fontSize: 15, color: C.background1 }); };
  text(s, "x", { x: MX + 0.25, y: 2.95, w: 0.4, h: 0.5, fontSize: 22, bold: true, valign: "middle", fontFace: "Cambria" });
  arrowR(s, MX + 0.65, 3.1);
  blk("Frozen layer W", "original weights", MX + 1.05, 2.1, 3.1, C.text1);
  blk("A", "in → 16", MX + 1.05, 3.75, 1.4, C.accent1);
  blk("B", "16 → out, starts at 0", MX + 2.6, 3.75, 1.55, C.accent1);
  arrowR(s, MX + 4.25, 2.41); arrowR(s, MX + 4.25, 4.06);
  s.addShape(pres.ShapeType.ellipse, { x: MX + 4.65, y: 2.92, w: 0.6, h: 0.6, fill: { color: H.accent2 }, line: { color: H.accent2, width: 0 }, objectName: nm("Plus") });
  text(s, "+", { x: MX + 4.65, y: 2.92, w: 0.6, h: 0.6, fontSize: 24, bold: true, color: C.background1, align: "center", valign: "middle" });
  text(s, "y", { x: MX + 5.4, y: 2.95, w: 0.4, h: 0.5, fontSize: 22, bold: true, valign: "middle", fontFace: "Cambria" });
  text(s, "y = W·x + (α/r)·B·A·x  with r = 16. B starts at zero, so training starts from exactly the original model.", { x: MX, y: 5.0, w: 6.0, h: 0.6, fontSize: 14, color: C.text2 });
  s.addTable([th(["Where", "Layers wrapped", "Adapters", "Parameters"]),
    ["8 double-stream", "QKV, output, 2 MLP; both streams", "64", { text: "5,242,880", options: { align: "right" } }],
    ["16 single-stream", "fused linear1, linear2", "32", { text: "4,587,520", options: { align: "right" } }],
    [{ text: "Total", options: { bold: true } }, "", { text: String(V.LoraLayers), options: { bold: true } }, { text: V.TrainParams, options: { bold: true, align: "right" } }],
  ], tableOpts({ x: 7.0, y: 1.85, w: W - MX - 7.0, colW: [1.55, 1.75, 1.0, 1.33], rowH: 0.5, fontSize: 13 }));
  stat(s, `${V.TrainParamsM}M`, `trainable, out of ${V.BaseParamsM}M`, 7.0, 4.15, 2.72, 1.5, C.accent1, 32);
  stat(s, `${V.AdapterMb} MB`, `adapter file (${V.AdapterPct}% of the model)`, 9.91, 4.15, W - MX - 9.91, 1.5, C.accent2, 32);
  text(s, "Adapters in float32 over a bf16 model; modulation layers stay frozen; saree and lehenga start as copies of one-pieces.", { x: 7.0, y: 5.85, w: W - MX - 7.0, h: 0.85, fontSize: 13, italic: true, color: C.text2 });
  source(s, "Source: ml/haat_ft/lora.py; parameters counted on the real model. Report section 5.3.");
  s.addNotes("This is what adding layers means precisely: beside 96 existing layers we add two small matrices A and B. The original 972 million weights never change. Only 1% of the parameters train, and the result is a 37.5 MB file that can be merged in or removed.");

  // 13 compute
  s = content("Adapting the model", "Compute cost", `Training memory falls ${V.StateRatio}× with LoRA; a photo costs the same`);
  s.addChart(pres.charts.BAR, [{ name: "GB", labels: ["Full fine-tune", "LoRA (ours)"], values: [D.compute.full_gb, D.compute.lora_gb] }], {
    x: MX, y: 1.85, w: 5.3, h: 4.9, barDir: "col", chartColors: [H.accent5, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '0.0" GB"', dataLabelFontSize: 16, showLegend: false, valAxisMinVal: 0, barGapWidthPct: 60,
    showTitle: true, title: "Training state in memory (weights, gradients, Adam)", ...axis(), objectName: nm("Chart"),
  });
  stat(s, `${V.LcPeakGb} GB`, `peak memory of our real training run on an 8 GB laptop (${V.LcTrainMin} min, half resolution)`, 6.3, 1.85, 3.05, 2.3, C.accent1, 34);
  stat(s, `${V.AdapterMb} MB`, `to ship the change, instead of the ${Number(D.compute.base_mb).toLocaleString("en-US")} MB model`, 9.55, 1.85, W - MX - 9.55, 2.3, C.accent2, 34);
  card(s, 6.3, 4.35, W - MX - 6.3, 2.4, C.text1, null);
  text(s, "Read it correctly", { x: 6.6, y: 4.5, w: 5.5, h: 0.4, fontSize: 16, bold: true, color: C.accent3 });
  bullets(s, ["LoRA makes training cheaper, not photos faster: still 60 passes", "Merged after training, the adapter adds no inference cost", "Full resolution needs a CUDA GPU with 16 GB or more"], { x: 6.6, y: 4.95, w: 5.7, h: 1.75, color: C.background1, fontSize: 15 });
  source(s, "Computed from parameter counts: 16 bytes per trained parameter (fp32 weight, gradient, Adam m and v), 2 bytes per frozen bf16 parameter.");
  s.addNotes("Be precise here. LoRA cuts the cost of training and of shipping the change, not the cost of making a photo. Full fine-tuning would need about 15.7 GB for weights, gradients and optimiser state; LoRA about 2.1 GB, most of it the frozen model.");

  // 14 data
  s = content("Adapting the model", "Training data with pose guardrails", F.ifPairs ? `${V.PairsN} clean training pairs from ${V.PairsProducts} products` : "Catalogue photos become training pairs only through guardrails");
  if (F.ifPairs) {
    s.addChart(pres.charts.BAR, [{ name: "count", labels: D.pairs.stages, values: D.pairs.values }], {
      x: MX, y: 1.85, w: 5.3, h: 3.25, barDir: "col", chartColors: [H.accent5, H.accent4, H.accent3, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "#,##0", showLegend: false, valAxisHidden: true, valGridLine: { style: "none" },
      showTitle: true, title: "From catalogue photos to training pairs", ...axis({ valGridLine: { style: "none" } }), objectName: nm("Chart"),
    });
  }
  card(s, 6.3, 1.85, W - MX - 6.3, 3.25);
  text(s, "Each rule fixed a real wrong pick", { x: 6.6, y: 2.0, w: 5.6, h: 0.4, fontSize: 16, bold: true, color: C.accent2 });
  bullets(s, ["Person found with confidence ≥ 0.6, and only one", "Shoulders and hips inside the frame; facing the camera", "Garment alone on a light plain backdrop", "Split by product family, never by photo"], { x: 6.6, y: 2.5, w: 5.75, h: 2.5, fontSize: 15 });
  if (sizes[files.sheet]) {
    const m = sizes[files.sheet], rowH = m.height / 2;
    const rowImg = await sharp(files.sheet).extract({ left: 0, top: 0, width: m.width, height: Math.round(rowH) }).jpeg({ quality: 88 }).toBuffer();
    const h = 1.45, w = Math.min(CW, (h * m.width) / rowH);
    s.addImage({ data: "image/jpeg;base64," + rowImg.toString("base64"), x: MX + (CW - w) / 2, y: 5.3, w, h: (w * rowH) / m.width, altText: "Sample training pairs: garment photo, then the same garment worn", objectName: nm("Image") });
  }
  source(s, "Source: ml/scripts/build_pairs.py with FASHN's own pose model, on public Amazon.in listings; ml/data/pairs/qc.json.");
  s.addNotes("To train we need pairs: the garment alone and the same garment worn. A catalogue has both but unlabelled and full of back views and close-ups. We use FASHN's own pose model as a guardrail; every rule was added because a test run picked exactly that kind of wrong photo.");

  // 15 results table
  s = content("Adapting the model", "Old model vs new model", F.ifLora ? `On ${V.LcN} unseen garments the adapted model is measurably better` : "How the new model will be judged");
  const verdict = (k) => {
    const v = V[`Lc${k}Verdict`];
    const col = v === "improved" ? H.accent2 : v === "worse" ? H.accent1 : H.accent4;
    return { text: v, options: { bold: true, color: col } };
  };
  const rowL = (m, k) => F.ifLora ? [m, V[`Lc${k}Base`], V[`Lc${k}Lora`], `${V[`Lc${k}Diff`]}  ${V[`Lc${k}Ci`]}`.replace(/\$/g, ""), `${V[`Lc${k}Win`]}%`, verdict(k)] : [m, "pending", "pending", "pending", "pending", "pending"];
  s.addTable([th(["Measure", "Base", "Base + LoRA", "Difference  [95% CI]", "LoRA better", "Verdict"]), rowL("Denoising error ↓", "Dl"), rowL("PSNR, dB ↑", "Psnr"), rowL("SSIM ↑", "Ssim"), rowL("Garment-pixel error ↓", "Gl"), rowL("Pose drift ↓", "Pd"), rowL("Garment colour ΔE00 ↓", "Cd")],
    tableOpts({ x: MX, y: 1.85, w: CW, colW: [3.0, 1.45, 1.6, 3.2, 1.45, 1.23], rowH: 0.56, fontSize: 15 }));
  card(s, MX, 5.95, CW, 0.8, C.text1, null);
  text(s, [{ text: "Claim rule: ", options: { bold: true, color: C.accent3 } }, { text: `improved only if the 95% interval excludes zero and Wilcoxon p < 0.05. Run: ${V.LcSteps} steps on the laptop, ${plain(V.LcScale)} resolution, ${V.LcTrainMin} min; same noise and seed for both models.`, options: { color: C.background1 } }], { x: MX + 0.3, y: 5.95, w: CW - 0.6, h: 0.8, fontSize: 14, valign: "middle" });
  source(s, "Source: ml/scripts/evaluate.py and compare_lora.py → results/lora_comparison.json. Report sections 5.7 and 7.9.");
  s.addNotes("Base against adapted model, on garments neither saw. The verdict column applies our rule: only an interval that excludes zero counts. Four measures improved; garment-pixel error and colour show no clear change yet.");

  // 16 results visual
  if (F.ifLora) {
    s = content("Adapting the model", "What the numbers look like", "Held-out garments: the adapter keeps the pose and the print");
    let ih = 0;
    if (sizes[files.strips]) ih = img(s, files.strips, MX, 1.85, 8.3, "Held-out garments: person input, garment, real photo, base model, base plus LoRA", 4.6);
    text(s, "Each row: person input · garment · real photo · base · base + LoRA", { x: MX, y: 1.85 + ih + 0.2, w: 8.3, h: 0.35, fontSize: 12, color: C.text2, align: "center" });
    const g = [[`+${lm.psnr ? lm.psnr.diff.toFixed(2) : V.LcPsnrDiff} dB`, "PSNR: closer to the real photo"], [`${V.LcPdRel}%`, "pose drift: the body stays where it was"], [`${V.LcDlRel}%`, `denoising error on all ${V.LcDlN} held-out pairs`]];
    g.forEach(([b, l], i) => stat(s, b, l, 9.3, 1.85 + i * 1.66, W - MX - 9.3, 1.52, i === 1 ? C.accent2 : C.accent1, 32));
    source(s, "Source: ml/runs/laptop-v1/eval12 (12 generated held-out garments, 20 steps, seed 42).");
    s.addNotes("The numbers on the previous slide, as pictures. Look at the base column against the LoRA column: the adapted model keeps the person's pose and the garment's print more faithfully.");
  }

  // ============================================================ section 4: checking
  addSection("Checking every photo");
  section("04", "Checking every photo", "Guardrails on the app's output and on the model, and how colour is measured");

  // 17 guardrails
  s = content("Checking every photo", "Output guardrails", "Every photo is checked before the seller sees it");
  s.addTable([th(["Check", "What it measures", "Effect"]),
    ["Blank", "the image is one flat colour", { text: "reject", options: { bold: true, color: H.accent1 } }],
    ["Unchanged", "the model photo came back as it was", { text: "reject", options: { bold: true, color: H.accent1 } }],
    ["Colour", "garment colours in the result, in ΔE2000 palettes", { text: "warn", options: { bold: true, color: H.accent3 } }],
    ["Shape", "aspect ratio differs from the model photo", { text: "warn", options: { bold: true, color: H.accent3 } }],
    ["Face", "the head region changed", { text: "warn", options: { bold: true, color: H.accent3 } }],
  ], tableOpts({ x: MX, y: 1.85, w: 7.1, colW: [1.5, 4.5, 1.1], rowH: 0.6, fontSize: 15 }));
  card(s, MX, 5.65, 7.1, 1.1);
  text(s, "A rejected photo falls through to the next engine; a warning is shown on the result page. Each check runs on thumbnails, with no GPU.", { x: MX + 0.3, y: 5.65, w: 6.5, h: 1.1, fontSize: 14, color: C.text2, valign: "middle" });
  if (F.ifAppGuard) {
    stat(s, `${V.AgN}`, `real generations checked, ${V.AgMs} ms each`, 8.1, 1.85, W - MX - 8.1, 1.45, C.text1, 34);
    stat(s, `${V.AgWarn}`, "warnings, all on real failures", 8.1, 3.45, W - MX - 8.1, 1.45, C.accent1, 34);
    stat(s, `${V.AgFail}`, "good photos rejected or warned", 8.1, 5.05, W - MX - 8.1, 1.7, C.accent2, 34);
  }
  source(s, "Source: src/lib/tryon/quality.ts and colour.ts; scripts/guardrail-audit.ts → results/app_guardrails.json. Report section 3.9.");
  s.addNotes("Two checks are certain failures and reject the photo; three are softer and add a warning. On our ten real generations the checks warn on exactly the three real failures and on none of the seven good photos.");

  // 18 colour science
  s = content("Checking every photo", "How we measure colour", "Colour is compared the way people see it, not as RGB numbers");
  const cs = [["Light × cloth", "a camera records the light times the cloth's reflectance: three numbers, like our three cone cells"], ["CIELAB", "split into lightness, hue and chroma; hue survives a change of light best, lightness least"], ["ΔE2000, lightness ×½", "the CIE 2000 difference fixes CIE76's errors in blues and vivid colours; folds and shine only change lightness"], ["Palettes, not averages", "a red saree with a green border averages to brown, so each region becomes its 3 main colours with their shares"]];
  cs.forEach(([hd, b], i) => {
    const y = 1.85 + i * 1.23;
    card(s, MX, y, 5.6, 1.1);
    badge(s, i + 1, MX + 0.2, y + 0.3, 0.5, C.accent1, 15);
    text(s, [{ text: hd, options: { bold: true, breakLine: true } }, { text: b, options: { fontSize: 13, color: C.text2 } }], { x: MX + 0.88, y, w: 4.6, h: 1.1, fontSize: 16, valign: "middle" });
  });
  // tolerance scale
  const sx = 6.65, swd = W - MX - sx, seg = [[0, 1, "invisible", H.accent6], [1, 2, "dye house", "C9DBCF"], [2, 5, "same for a buyer", "8FB79E"], [5, 12, "same shade in photos", H.accent2], [12, 20, "different", H.accent1]];
  text(s, "What a ΔE2000 difference means", { x: sx, y: 1.85, w: swd, h: 0.4, fontSize: 16, bold: true });
  seg.forEach(([a, b, lab, col]) => {
    const x = sx + (a / 20) * swd, w = ((b - a) / 20) * swd;
    s.addShape(pres.ShapeType.rect, { x, y: 2.35, w, h: 0.5, fill: { color: col }, line: { color: H.lt2, width: 1 }, objectName: nm("Scale") });
    text(s, String(a), { x: x - 0.2, y: 2.9, w: 0.4, h: 0.3, fontSize: 12, color: C.text2, align: "center" });
  });
  text(s, "20", { x: sx + swd - 0.2, y: 2.9, w: 0.4, h: 0.3, fontSize: 12, color: C.text2, align: "center" });
  text(s, [{ text: "5–12: ", options: { bold: true, color: C.accent2 } }, { text: "same shade in two photographs.  ", options: { color: C.text2 } }, { text: "Above 12: ", options: { bold: true, color: C.accent1 } }, { text: "a different shade. Our limit is 12.", options: { color: C.text2 } }], { x: sx, y: 3.25, w: swd, h: 0.4, fontSize: 14 });
  const AG = fs.existsSync(R("docs/mini-project-report/results/app_guardrails.json")) ? JSON.parse(fs.readFileSync(R("docs/mini-project-report/results/app_guardrails.json"))) : null;
  if (AG && AG.results.some((r) => r.palettes)) {
    const rows = AG.results.filter((r) => r.palettes);
    const goods = rows.filter((r) => r.checks.colour.ok).sort((a, b) => a.checks.colour.value - b.checks.colour.value);
    const pick = [goods[Math.floor(goods.length / 2)], ...rows.filter((r) => !r.checks.colour.ok && r.checks.colour.garmentVsOld >= 8), ...rows.filter((r) => !r.checks.colour.ok && r.checks.colour.garmentVsOld < 8).slice(0, 1)].filter(Boolean);
    const colW = (swd - 1.55) / 3, y0 = 3.85;
    ["garment", "old outfit", "result"].forEach((h, j) => text(s, h, { x: sx + 1.55 + j * colW, y: y0, w: colW - 0.1, h: 0.3, fontSize: 12, bold: true, color: C.text2 }));
    pick.forEach((r, i) => {
      const y = y0 + 0.38 + i * 0.85, cc = r.checks.colour;
      const why = cc.ok ? "good" : cc.garmentVsOld < 8 ? "alike: look" : "old shows";
      text(s, [{ text: why, options: { bold: true, color: cc.ok ? C.accent2 : C.accent1, breakLine: true } }, { text: `D ${cc.value.toFixed(1)}`, options: { color: C.text2, fontSize: 12 } }], { x: sx, y, w: 1.45, h: 0.6, fontSize: 13, valign: "middle" });
      ["garment", "old", "result"].forEach((part, j) => {
        let x = sx + 1.55 + j * colW;
        const ww = colW - 0.15;
        r.palettes[part].forEach((p) => {
          const w = ww * p.share;
          s.addShape(pres.ShapeType.rect, { x, y, w, h: 0.6, fill: { color: labHex(p.lab) }, line: { color: H.accent5, width: 0.5 }, objectName: nm("Swatch") });
          x += w;
        });
      });
    });
  }
  source(s, "CIEDE2000: Luo, Cui & Rigg 2001; checked against the Sharma et al. 2005 test data. Report section 3.8.");
  s.addNotes("Why not compare RGB? Because the same saree photographed in two lights gives different RGB numbers, and equal RGB steps are not equal to the eye. We convert to CIELAB, use the CIE 2000 colour difference with lightness counting half, because folds and shine change lightness most, and compare palettes, because averaging a two-colour garment gives a colour that is not in it. A dye house accepts 1 to 2 units; between two photographs a correct colour moves 5 to 12, so 12 is our limit.");

  // 19 what the colour checks found
  s = content("Checking every photo", "What the new colour check found", "Fewer false alarms, and every warning has a reason");
  if (F.ifModelGuard) {
    s.addChart(pres.charts.BAR, [{ name: "Old measure: per-pixel CIE76", labels: ["Base model", "Base + LoRA"], values: [Number(V.GrOldFail), Number(V.GrOldFail)] }, { name: "New measure: ΔE2000 palettes", labels: ["Base model", "Base + LoRA"], values: [Number(V.GrBaseColour), Number(V.GrLoraColour)] }], {
      x: MX, y: 1.85, w: 5.6, h: 4.9, barDir: "col", chartColors: [H.accent5, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 16, showLegend: true, legendPos: "b", valAxisMinVal: 0, valAxisMaxVal: 12, valAxisMajorUnit: 3,
      showTitle: true, title: `Colour failures among ${V.GrBaseN} held-out outputs`, ...axis(), objectName: nm("Chart"),
    });
  }
  const finds = [["Model outputs", `Every remaining failure is a broken data pair: a two-vest multipack, a listing showing a different T-shirt, and an Amazon banner. All true pairs pass for both models (median ΔE00 ${V.GrGoodMed}).`, C.accent1],
    ["App photo, uploaded screenshot", `The result is ${V.AgShotOld} from the old outfit but ${V.AgShotNew} from the garment: the old clothes still show.`, C.accent1],
    ["App photo, skirt on a dress", `The white skirt and the cream dress are only ${V.AgSkirtAlike} apart, so colour cannot tell if anything changed. The seller is asked to look.`, C.accent3],
    ["The 7 good photos", `Matched within ΔE00 ${V.AgGoodMin}–${V.AgGoodMax}, inside the same-shade limit of 12. No false alarm.`, C.accent2]];
  finds.forEach(([hd, b, col], i) => {
    const y = 1.85 + i * 1.23;
    card(s, 6.6, y, W - MX - 6.6, 1.1);
    s.addShape(pres.ShapeType.ellipse, { x: 6.82, y: y + 0.42, w: 0.26, h: 0.26, fill: { color: col }, line: { color: col, width: 0 }, objectName: nm("Dot") });
    text(s, [{ text: hd, options: { bold: true, breakLine: true } }, { text: b, options: { fontSize: 13, color: C.text2 } }], { x: 7.25, y, w: W - MX - 7.45, h: 1.1, fontSize: 15, valign: "middle" });
  });
  source(s, "Source: ml/runs/laptop-v1/eval12/guardrails.json and results/app_guardrails.json. Report sections 3.9 and 7.9.");
  s.addNotes("The old per-pixel measure failed seven of twelve outputs for both models, including correct ones, because a fold that moved a few pixels counts as a colour error. The palette measure fails only three, and those are broken training pairs, not model errors. In the app, the three warnings each come with a reason we can read off the numbers.");

  // 20 rubric
  s = content("Checking every photo", "Output quality so far", "The skirt went from 11/30 to 29/30 without retraining");
  s.addChart(pres.charts.BAR, [{ name: "Score out of 30", labels: D.rubric.labels, values: D.rubric.totals }], {
    x: MX, y: 1.85, w: 6.6, h: 4.2, barDir: "col", chartColors: [H.accent2, H.accent2, H.accent1, H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 16, showLegend: false, valAxisMinVal: 0, valAxisMaxVal: 30, valAxisMajorUnit: 10, catAxisLabelFontSize: 11,
    showTitle: true, title: "Rubric: colour, print, neckline, length, shape, artefacts (5 points each)", ...axis(), objectName: nm("Chart"),
  });
  text(s, "Scored by an AI assistant from crops, not yet by a human rater. Four images: a baseline, not a benchmark.", { x: MX, y: 6.15, w: 6.6, h: 0.6, fontSize: 13, italic: true, color: C.accent1 });
  let kh = 0;
  if (sizes[files.skirt]) kh = img(s, files.skirt, 7.6, 1.85, W - MX - 7.6, "The tiered skirt on a model wearing separates", 2.6);
  card(s, 7.6, 1.85 + kh + 0.25, W - MX - 7.6, 4.9 - kh - 0.25, C.text1, null);
  text(s, [{ text: "Why it failed, and the fix", options: { bold: true, color: C.accent3, breakLine: true } }, { text: "A skirt replaces a bottom garment. On a model in a dress there is none, so the skirt merged into the dress. The app now knows what each model wears and marks which garments suit it.", options: { color: C.background1 } }], { x: 7.9, y: 1.85 + kh + 0.4, w: W - MX - 8.2, h: 4.9 - kh - 0.55, fontSize: 15, paraSpaceAfter: 6 });
  source(s, "Source: docs/eval-2026-10-26-baseline.md (balanced, 30 steps, seed 42). Report section 7.3.");
  s.addNotes("Tops are strong: the logo tee scored 30 of 30 with the letters exact. The skirt failed on a model in a dress and scored 29 on a model in separates. That improvement came from the system, not from training.");

  // ============================================================ section 5: market
  if (D.market) {
    addSection("Market engines");
    section("05", "Market intelligence and content engines", `${V.MkTotalClean} real listings turned into prices, titles, hashtags and timing`);
    const K = ["tshirt", "top", "saree", "kurta-set"].filter((k) => D.market[k]);
    const COL = { tshirt: H.accent1, top: H.accent4, saree: H.accent3, "kurta-set": H.accent2 };

    // 21 market overview
    s = content("Market engines", "Market research from real listings", `${V.MkTotalClean} listings: discounts everywhere, demand elsewhere`);
    s.addTable([th(["Category", "Listings", "Median price", "Median discount", "≥ 50% off", "Stars"]), ...K.map((k) => { const c = D.market[k]; return [{ text: c.label, options: { bold: true } }, c.n.toLocaleString("en-IN"), rs(c.med), `${c.disc}%`, `${c.disc50}%`, String(c.stars)]; })],
      tableOpts({ x: MX, y: 1.85, w: 6.9, colW: [1.9, 1.05, 1.15, 1.15, 0.85, 0.8], rowH: 0.75, fontSize: 15 }));
    text(s, `${V.MkTotalRatings} ratings in total. Ratings stand in for sales, which are not public.`, { x: MX, y: 5.9, w: 6.9, h: 0.6, fontSize: 14, italic: true, color: C.text2 });
    card(s, 7.85, 1.85, W - MX - 7.85, 4.9, C.text1, null);
    text(s, "What the data says", { x: 8.15, y: 2.05, w: 4.3, h: 0.4, fontSize: 18, bold: true, color: C.accent3, fontFace: "Cambria" });
    bullets(s, [`Discounting is the norm: median ${V.MkTeeDisc}–${V.MkKurtaDisc}% off MRP`, `Price and discount barely relate to demand (every |ρ| ≤ ${V.MkMaxRho}): undercutting does not buy sales`, `Ethnic wear is open to small sellers: top 10 brands hold ${V.MkKurtaTopTen}% of kurta-set demand, against ${V.MkTeeTopTen}% for T-shirts`], { x: 8.15, y: 2.6, w: W - MX - 8.45, h: 4.0, color: C.background1, fontSize: 15, paraSpaceAfter: 12 });
    source(s, "Source: analysis/market.py on public Amazon.in and Myntra listings, Oct 2026; one listing per product family; outliers removed.");
    s.addNotes("A quarter of a million listings. Two findings matter for a seller: everyone shows huge discounts, and neither price nor discount relates to how much a listing sells. Ethnic wear on Myntra is not dominated by a few brands, which is good news for small sellers.");

    // 22 what buyers want
    const sa = D.market.saree, ku = D.market["kurta-set"];
    s = content("Market engines", "What buyers want, and the words they search", "Fabrics and patterns buyers want more of, and how they search");
    const lf = (sa ? sa.lift.fabric.map((r) => [`saree: ${r[0]}`, r[1]]) : []).concat(ku ? ku.lift.pattern.map((r) => [`kurta: ${r[0]}`, r[1]]) : []).sort((x, y) => y[1] - x[1]).slice(0, 8);
    s.addChart(pres.charts.BAR, [{ name: "lift", labels: lf.map((r) => r[0]), values: lf.map((r) => r[1]) }], {
      x: MX, y: 1.85, w: 5.9, h: 4.9, barDir: "bar", chartColors: [H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", showLegend: false, catAxisOrientation: "maxMin",
      showTitle: true, title: "Share of demand ÷ share of listings (above 1 = under-supplied)", ...axis(), objectName: nm("Chart"),
    });
    const kw = (ku || D.market.tshirt).kw;
    s.addChart(pres.charts.BAR, [{ name: "score", labels: kw.map((k) => k[0]), values: kw.map((k) => k[1]) }], {
      x: 6.85, y: 1.85, w: W - MX - 6.85, h: 4.9, barDir: "bar", chartColors: [H.accent3], showValue: false, showLegend: false, catAxisOrientation: "maxMin", valAxisHidden: true,
      showTitle: true, title: `${ku ? "Kurta-set" : "T-shirt"} title words, ranked by demand`, ...axis({ valGridLine: { style: "none" } }), objectName: nm("Chart"),
    });
    source(s, "Demand uses log(1 + ratings) so one bestseller cannot dominate; values with at least 5 listings. Report section 7.7.");
    s.addNotes("Left: fabrics and patterns that get more demand than their share of listings: these are the gaps a small seller can fill. Right: the words kurta-set buyers respond to; they search for what is included, dupatta and trousers, which the title engine uses.");
  }

  // 23 engines worked example
  if (D.example) {
    const ex = D.example, pr = ex.pricing;
    s = content("Market engines", "Content engines, worked example", `An embroidered ${ex.input.product_noun} from ${ex.input.city}, costing ${rs(ex.input.cost)} to make`);
    stat(s, `${rs(pr.recommended_band[0])}–${rs(pr.recommended_band[1])}`, `recommended price (${pr.position} tier) among ${Number(pr.comparables).toLocaleString("en-IN")} comparable listings; margin ${pr.margin_at_band[0]}–${pr.margin_at_band[1]}%`, MX, 1.85, 4.6, 2.2, C.accent1, 36);
    stat(s, rs(pr.floor_for_30pct_margin), "lowest price that keeps a 30% margin: the engine never goes below it", MX, 4.25, 4.6, 2.5, C.accent2, 36);
    const eng = [["SEO title", ex.seo.title, `${ex.seo.title_chars} characters; built only from the product's real attributes`],
      ["Hashtags", ex.hashtags.tags.slice(0, 8).join("  "), "broad + niche + local + occasion, in English letters"],
      ["Positioning", ex.positioning.statement, "where buyers want more than sellers offer"],
      ["GEO: place and calendar", `${ex.geo.local_tags.join("  ")}`, `next: ${ex.geo.moments.slice(0, 3).map((m) => (m.days_away === 0 ? `${m.name} today` : `${m.name} in ${m.days_away} days`)).join(", ")}`]];
    eng.forEach(([hd, main, sub], i) => {
      const y = 1.85 + i * 1.24, x = 5.55, w = W - MX - x;
      card(s, x, y, w, 1.13);
      text(s, hd.toUpperCase(), { x: x + 0.25, y: y + 0.1, w: w - 0.5, h: 0.28, fontSize: 11, bold: true, color: C.accent1, charSpacing: 1 });
      text(s, main, { x: x + 0.25, y: y + 0.38, w: w - 0.5, h: 0.42, fontSize: hd === "Hashtags" ? 12 : 14, bold: true, fontFace: hd === "Hashtags" ? "Courier New" : undefined, fit: "shrink" });
      text(s, sub, { x: x + 0.25, y: y + 0.8, w: w - 0.5, h: 0.3, fontSize: 12, color: C.text2 });
    });
    source(s, "Source: analysis/market.py engines on the catalogue statistics; analysis/example_seller.json. No language model is involved in any number.");
    s.addNotes("Every number here comes from the catalogue and the seller's cost, not from a language model. The pricing engine finds the comparable listings and recommends the middle band, with the margin at both ends. The title uses the words buyers search. Hashtags never claim a feature the product lacks. GEO means location: local tags and the dated festival calendar.");
  }

  // 24 text AI, security, tests
  s = content("Market engines", "Text AI, security and tests", "Language models write the words; code computes every number");
  const chain = [["Groq · Llama 3.3 70B", C.background1], ["Gemini 2.5 Flash", C.background1], ["Labelled template", H.accent6]];
  chain.forEach(([t, f], i) => { const x = MX + i * 2.05; card(s, x, 1.85, 1.8, 0.7, f, H.accent5); text(s, t, { x: x + 0.08, y: 1.85, w: 1.64, h: 0.7, fontSize: 13, bold: true, align: "center", valign: "middle" }); if (i < 2) arrowR(s, x + 1.83, 2.11); });
  text(s, "completeJSON() is the only place text AI is called: JSON mode, 45 s timeout, schema-checked; a wrong shape counts as a failure.", { x: MX, y: 2.7, w: 6.0, h: 0.8, fontSize: 14, color: C.text2 });
  card(s, MX, 3.6, 6.0, 3.15, C.text1, null);
  text(s, "Guardrails on generated text", { x: MX + 0.3, y: 3.75, w: 5.4, h: 0.4, fontSize: 16, bold: true, color: C.accent3 });
  bullets(s, ["A caption quoting any price the seller did not give is rejected", "Margins, price bands and dates are computed in code", "No invented statistics, brands or MRPs", "Every report says who wrote it: AI or template"], { x: MX + 0.3, y: 4.25, w: 5.5, h: 2.4, color: C.background1, fontSize: 15 });
  stat(s, `${D.tests.app + D.tests.ml}`, `automated tests, all passing: ${D.tests.app} for the app (no network), ${D.tests.ml} for the training kit (no GPU)`, 7.0, 1.85, W - MX - 7.0, 2.0, C.accent2, 40);
  card(s, 7.0, 4.05, W - MX - 7.0, 2.7);
  text(s, "Security", { x: 7.3, y: 4.2, w: 5, h: 0.4, fontSize: 16, bold: true });
  bullets(s, ["Passcode on every creating route, compared in constant time", "Keys stay in one .env on the server", "GPS metadata stripped from every photo", "Not yet: user accounts and encryption at rest"], { x: 7.3, y: 4.65, w: W - MX - 7.6, h: 2.0, fontSize: 14, paraSpaceAfter: 5 });
  source(s, "Source: src/lib/llm/index.ts, src/lib/posts/caption.ts, src/lib/guard.ts; npm test and pytest (results/tests.json).");
  s.addNotes("One function talks to the language models and checks every answer. A caption that quotes a price the seller didn't give is thrown away. All arithmetic and dates are code. Tests run without network or GPU, using fake providers.");

  // ============================================================ section 6: where it stands
  addSection("Where it stands");
  section("06", "Where it stands", "How a photo is made after integration, what is done, and what comes next");

  // 25 in the app: the seller chooses the try-on AI
  s = content("Where it stands", "Integrated in the app", "The seller now chooses Standard or Haat-tuned");
  const flow2 = [["Upload", "garment + model"], ["Try-on AI", "Standard or Haat-tuned"], ["Clean", "upright, white, no GPS"], ["studio.start", "cache, sharing, lock"], ["local-lora", "FASHN + our LoRA adapter"], ["Checks", "5 guardrails"], ["Post + plan", "engines and caption"]];
  const fw2 = 1.55, fg2 = (CW - 7 * fw2) / 6;
  flow2.forEach(([hd, sub], i) => {
    const x = MX + i * (fw2 + fg2), hot = i === 4 || i === 1;
    card(s, x, 1.85, fw2, 1.4, hot ? C.accent1 : C.background1, hot ? null : H.accent6);
    text(s, [{ text: hd, options: { bold: true, fontSize: 15, breakLine: true, color: hot ? C.background1 : C.text1 } }, { text: sub, options: { fontSize: 12, color: hot ? C.background1 : C.text2 } }], { x: x + 0.08, y: 1.85, w: fw2 - 0.16, h: 1.4, align: "center", valign: "middle" });
    if (i < 6) arrowR(s, x + fw2 + fg2 / 2 - 0.09, 2.46, C.accent4, 0.18);
  });
  const tunedSec = V.TunedSec ? `${V.TunedSec} s` : "about a minute";
  stat(s, tunedSec, "one Haat-tuned photo through the app on the 8 GB laptop, all guardrails passed", MX, 3.5, 3.85, 1.75, C.accent1, 34);
  stat(s, "4.8 GB", "peak memory at half size, the size the adapter was trained and tested at (full size ran out of memory)", MX + 4.08, 3.5, 3.85, 1.75, C.accent2, 34);
  stat(s, "0", "free-GPU quota used: the tuned AI runs on the seller's own computer", MX + 8.16, 3.5, CW - 8.16, 1.75, C.text1, 34);
  text(s, [{ text: "Same rules as Standard: ", options: { bold: true } }, { text: "cache, job sharing, the GPU lock and the five guardrails are unchanged. Tuned photos get their own cache keys and a Haat-tuned badge. A hosted engine (fashn-lora-space) is written and waits for a GPU Space.", options: { color: C.text2 } }], { x: MX, y: 5.5, w: CW, h: 1.2, fontSize: 15 });
  source(s, "Code: src/lib/tryon/local-lora.ts (calls ml/scripts/sample.py with --lora and --scale 0.5), studio.ts. Report section 5.9.");
  s.addNotes("This is the integration the project promised. The seller picks Standard or Haat-tuned on the model step. Haat-tuned runs our LoRA adapter on the seller's own laptop through the same script the evaluation used, at the resolution it was tested at, in about a minute, without spending any free GPU quota. Everything else in the pipeline stays exactly the same.");

  // 26 done / pending / next
  s = content("Where it stands", "Summary", "Done and measured, still pending, and next");
  const cols = [["Done and measured", C.accent2, [`${V.MedTotal} s per photo; ${V.CacheMs} ms when saved`, `Training method rebuilt (${V.LossRatio}× proof)`, `${V.LoraLayers} adapters, ${V.StateRatio}× less training memory`, ...(F.ifLora ? [`LoRA: PSNR +${lm.psnr ? lm.psnr.diff.toFixed(2) : V.LcPsnrDiff} dB, pose drift ${V.LcPdRel}%`] : []), "Guardrails with ΔE2000 colour", "Haat-tuned AI inside the app", `${V.MkTotalClean} listings, engines in the app`, `${D.tests.app + D.tests.ml} tests passing`]],
    ["Pending", C.accent3, ["Full-resolution training on a CUDA GPU", "Cleaner pairs: drop multipacks and banners", "Human raters for the quality rubric", "More saree and lehenga photos"]],
    ["Next", C.accent1, ["Host the tuned AI on a GPU Space", "Connect the engines to the post maker", "Regional demand from sellers' own sales", "An open licence and a public demo"]]];
  cols.forEach(([hd, col, items], i) => {
    const x = MX + i * 4.08, w = 3.85;
    card(s, x, 1.85, w, 4.9);
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.3, y: 2.12, w: 0.28, h: 0.28, fill: { color: col }, line: { color: col, width: 0 }, objectName: nm("Dot") });
    text(s, hd, { x: x + 0.7, y: 2.0, w: w - 0.9, h: 0.5, fontSize: 20, bold: true, color: col, fontFace: "Cambria" });
    bullets(s, items, { x: x + 0.3, y: 2.7, w: w - 0.55, h: 3.95, fontSize: 15, paraSpaceAfter: 9 });
  });
  source(s, F.ifLora ? "Stated plainly: LoRA improved PSNR, SSIM, pose and denoising on unseen garments (laptop, half resolution); colour shows no clear change yet." : "Stated plainly: no improvement from fine-tuning is claimed yet.");
  s.addNotes("Close on the honest position: what is measured, what is pending and why (data and a GPU, not method), and what comes next.");

  // 27 thank you
  s = pres.addSlide({ masterName: "TITLE", sectionTitle: "Where it stands" });
  text(s, "Thank you", { x: MX, y: 1.6, w: 9, h: 1.2, fontSize: 60, bold: true, color: C.background1, fontFace: "Cambria" });
  text(s, "Questions are welcome.", { x: MX, y: 2.85, w: 9, h: 0.6, fontSize: 24, color: C.accent5, fontFace: "Cambria" });
  s.addShape(pres.ShapeType.line, { x: MX, y: 3.85, w: 1.2, h: 0, line: { color: H.accent1, width: 2.5 }, objectName: nm("Rule") });
  text(s, [
    { text: "Source code   ", options: { color: C.accent5 } }, { text: REPO, options: { color: C.background1, bold: true, breakLine: true } },
    ...(V.LiveUrl ? [{ text: "Live app   ", options: { color: C.accent5 } }, { text: V.LiveUrl.replace(/^https?:\/\//, ""), options: { color: C.background1, bold: true, breakLine: true } }] : []),
    { text: "Report   ", options: { color: C.accent5 } }, { text: "Mini-Project-Report-Haat-Studio.pdf", options: { color: C.background1, bold: true } },
  ], { x: MX, y: 4.15, w: 11, h: 1.4, fontSize: 18, paraSpaceAfter: 8 });
  text(s, "Amrendra Vikram Singh (24UEC092)  ·  Avirat Kaushik (24UCS235)  ·  Guide: Dr. Nishant Gupta", { x: MX, y: 6.4, w: CW, h: 0.4, fontSize: 14, color: C.accent4 });
  s.addNotes("Thank the guide and the panel; invite questions. Likely questions: where the market data comes from, why LoRA and not full fine-tuning, and what happens when the free GPU quota runs out.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  await uniqueShapeIds(OUT);
  console.log("wrote", OUT);
})();
