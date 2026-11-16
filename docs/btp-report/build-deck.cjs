// Builds the 12-slide mini-project presentation. Run: node build.js <haat-studio dir> <out.pptx> <skill dir>
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const [ROOT, OUT, SKILL] = process.argv.slice(2);
const { applyTheme } = require(path.join(SKILL, "scripts/apply_theme.js"));

const THEME = {
  name: "Haat Try-On",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "0F2A2E", lt1: "FFFFFF", dk2: "4A5E61", lt2: "EEF3F2",
    accent1: "F2A900", accent2: "0E7C7B", accent3: "C8553D", accent4: "9FB8B5", accent5: "6B7F82", accent6: "D9E4E2",
    hlink: "0E7C7B", folHlink: "6B7F82",
  },
};
const H = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Garment-to-Model Virtual Try-On";
pres.author = "Amrendra Vikram Singh";
const C = pres.SchemeColor;
const FOOT = "Garment-to-Model Virtual Try-On  ·  Mini Project  ·  LNMIIT Jaipur";

pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: H.dk1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.7, y: 1.5, w: 7.3, h: 2.2, fontSize: 40, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "Title" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.7, y: 3.85, w: 7.0, h: 1.2, fontSize: 18, color: C.accent6, valign: "top", margin: 0 }, text: "Subtitle" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: H.lt1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 12.1, h: 0.95, fontSize: 34, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "Title" } },
    { text: { text: FOOT, options: { x: 0.6, y: 7.02, w: 9, h: 0.3, fontSize: 10, color: C.accent5, margin: 0, isTextBox: true } } },
  ],
  slideNumber: { x: 12.1, y: 7.02, w: 0.6, h: 0.3, fontSize: 10, color: H.accent5, align: "right" },
});
pres.defineSlideMaster({
  title: "CLOSING_DARK",
  background: { color: H.dk1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 12.1, h: 0.95, fontSize: 34, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "Title" } },
    { text: { text: FOOT, options: { x: 0.6, y: 7.02, w: 9, h: 0.3, fontSize: 10, color: C.accent4, margin: 0, isTextBox: true } } },
  ],
  slideNumber: { x: 12.1, y: 7.02, w: 0.6, h: 0.3, fontSize: 10, color: H.accent4, align: "right" },
});

// ---------- helpers ----------
let n = 0;
const name = (s) => `${s} ${++n}`;
const shadow = () => ({ type: "outer", color: "000000", opacity: 0.12, blur: 8, offset: 2, angle: 90 });
function card(s, x, y, w, h, fill = C.background2) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: name("Card") });
}
function text(s, t, o) {
  s.addText(t, { isTextBox: true, margin: 0, valign: "top", color: C.text1, fontSize: 14, objectName: name("Text"), ...o });
}
function badge(s, label, x, y, d = 0.5, fill = C.accent1, color = C.text1) {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: name("Badge") });
  s.addText(label, { isTextBox: true, x, y, w: d, h: d, align: "center", valign: "middle", margin: 0, bold: true, fontSize: 16, color, objectName: name("Badge label") });
}
function stat(s, big, label, x, y, w, h = 1.9, fill = C.background2, bigColor = C.accent2, size = 40) {
  card(s, x, y, w, h, fill);
  text(s, big, { x: x + 0.25, y: y + 0.22, w: w - 0.5, h: 0.95, fontSize: size, bold: true, color: bigColor, fontFace: THEME.headFontFace, valign: "middle" });
  text(s, label, { x: x + 0.25, y: y + 1.2, w: w - 0.5, h: h - 1.3, fontSize: 14, color: C.text2 });
}
function photo(s, file, x, y, h, alt) {
  const { width, height } = sizes[file];
  const w = (h * width) / height;
  s.addShape(pres.ShapeType.rect, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12, fill: { color: C.background1 }, line: { color: C.accent6, width: 0.75 }, shadow: shadow(), objectName: name("Frame") });
  s.addImage({ path: file, x, y, w, h, altText: alt, objectName: name("Photo") });
  return w;
}
const axis = { catAxisLabelColor: H.dk2, valAxisLabelColor: H.dk2, catAxisLabelFontSize: 12, valAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", dataLabelColor: H.dk1, dataLabelFontSize: 12, legendFontFace: "+mn-lt", legendFontSize: 12, legendColor: H.dk2, valGridLine: { color: H.accent6, size: 0.5 }, catGridLine: { style: "none" } };

const R = (p) => path.join(ROOT, p);
const tee = R("data/results/2de42185dfdafbf0412dc5b29276dc35");
const files = { garment: path.join(tee, "garment.jpg"), person: path.join(tee, "person.jpg"), result: path.join(tee, "result.png"), skirt: R("docs/btp-report/figures/skirt-on-separates.jpg") };
const sizes = {};

(async () => {
  const sharp = require("sharp");
  for (const f of Object.values(files)) sizes[f] = await sharp(f).metadata();
  const micro = JSON.parse(fs.readFileSync(R("ml/runs/microrun/report.json")));
  const real = JSON.parse(fs.readFileSync(R("ml/runs/real-check/report.json")));
  const losses = fs.readFileSync(R("ml/runs/microrun/log.csv"), "utf8").trim().split("\n").slice(1).map((l) => +l.split(",")[2]);
  const K = 10;
  const avg = losses.map((_, i) => (i + 1 >= K ? +(losses.slice(i + 1 - K, i + 1).reduce((a, b) => a + b) / K).toFixed(5) : null)).filter((v) => v !== null);

  // 1 ---------------------------------------------------------------- title
  pres.addSection({ title: "Introduction" });
  let s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Introduction" });
  s.addText("Garment-to-Model Virtual Try-On", { placeholder: "title" });
  s.addText("Understanding a 972-million-parameter diffusion transformer, and building a LoRA fine-tuning framework for it", { placeholder: "body" });
  text(s, [
    { text: "Amrendra Vikram Singh", options: { bold: true, color: C.background1, breakLine: true } },
    { text: "Roll No. 24UEC092  ·  Dept. of ECE", options: { color: C.accent4, breakLine: true } },
    { text: "Faculty guide: Dr. Nishant Gupta", options: { color: C.accent4, breakLine: true } },
    { text: "Mini Project, 5th Semester  ·  LNMIIT Jaipur  ·  November 2026", options: { color: C.accent4 } },
  ], { x: 0.7, y: 5.3, w: 7, h: 1.5, fontSize: 15, paraSpaceAfter: 4 });
  photo(s, files.result, 8.95, 1.0, 5.5, "Try-on result: a model wearing the black logo tee");
  s.addNotes("Introduce yourself and the guide. One line: I studied the best open virtual try-on model, worked out how it works, rebuilt its missing training method, and built the tools to adapt it. The photo on the right was generated by the system.");

  // 2 ---------------------------------------------------------------- problem
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Introduction" });
  s.addText("One flat photo in, an on-model photo out", { placeholder: "title" });
  const h2 = 3.35, y2 = 1.65;
  const ws = [files.garment, files.person, files.result].map((f) => (h2 * sizes[f].width) / sizes[f].height);
  let x = (13.33 - (ws[0] + ws[1] + ws[2] + 0.9 + 1.0)) / 2;
  const w1 = photo(s, files.garment, x, y2, h2, "Flat photo of a black logo T-shirt");
  text(s, "Garment photo (flat)", { x, y: y2 + h2 + 0.14, w: w1, h: 0.3, fontSize: 12, color: C.text2, align: "center" });
  text(s, "+", { x: x + w1 + 0.15, y: y2 + h2 / 2 - 0.4, w: 0.6, h: 0.8, fontSize: 40, bold: true, color: C.accent1, align: "center", valign: "middle" });
  x += w1 + 0.9;
  const w2 = photo(s, files.person, x, y2, h2, "Photo of a person in a blue tee");
  text(s, "Person photo", { x, y: y2 + h2 + 0.14, w: w2, h: 0.3, fontSize: 12, color: C.text2, align: "center" });
  s.addShape(pres.ShapeType.rightArrow, { x: x + w2 + 0.2, y: y2 + h2 / 2 - 0.25, w: 0.6, h: 0.5, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: name("Arrow") });
  x += w2 + 1.0;
  const w3 = photo(s, files.result, x, y2, h2, "Generated photo: the same person wearing the black logo tee");
  text(s, "Generated result", { x, y: y2 + h2 + 0.14, w: w3, h: 0.3, fontSize: 12, color: C.text2, align: "center" });
  const why = [["Sellers have flat photos", "A phone picture of the garment on a bed or hanger."], ["Buyers want it worn", "Fit, length and drape only show on a person."], ["The logo text survives", "Exact printed text is the hardest test for a generator."]];
  why.forEach(([hd, b], i) => {
    const fx = 0.6 + i * 4.1;
    card(s, fx, 5.6, 3.93, 1.2);
    text(s, [{ text: hd, options: { bold: true, fontSize: 16, breakLine: true } }, { text: b, options: { color: C.text2 } }], { x: fx + 0.22, y: 5.6, w: 3.5, h: 1.2, fontSize: 14, valign: "middle", paraSpaceAfter: 3 });
  });
  s.addNotes("This is a real result from the system: inputs on the left, output on the right. Point out the logo text is reproduced exactly. That is the hardest thing for a generative model, and it is why this model was chosen.");

  // 3 ---------------------------------------------------------------- model at a glance
  pres.addSection({ title: "The model" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "The model" });
  s.addText("The model at a glance: FASHN VTON 1.5", { placeholder: "title" });
  const st = [["972M", "parameters in one transformer"], ["6,912", "image tokens processed in every pass"], ["60", "passes of the network per photo (30 steps × 2)"], ["13.5 s", "per photo on a hosted GPU (warm)"]];
  st.forEach(([b, l], i) => stat(s, b, l, 0.6 + i * 3.08, 1.7, 2.88, 2.1));
  const facts = [["Released without training code", "FASHN AI published the weights and inference code only: no training code, no paper."], ["Works on raw pixels", "No VAE compression, so fine detail such as printed text is kept."], ["Heavy to run", "About 8 GB of GPU memory. On my 8 GB laptop one photo takes 22 minutes."]];
  facts.forEach(([hd, b], i) => {
    const fx = 0.6 + i * 4.1;
    badge(s, String(i + 1), fx, 4.35, 0.5);
    text(s, hd, { x: fx + 0.65, y: 4.35, w: 3.25, h: 0.5, fontSize: 16, bold: true, valign: "middle" });
    text(s, b, { x: fx + 0.65, y: 4.9, w: 3.25, h: 1.6, fontSize: 14, color: C.text2 });
  });
  s.addNotes("The network is FASHN AI's work, not mine. Say that first. 972 million parameters. Each image becomes 3,456 tokens, two images make 6,912. 30 denoising steps, each run twice for guidance, gives 60 passes. The key fact for my project: it shipped with no way to train it.");

  // 4 ---------------------------------------------------------------- pipeline
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "The model" });
  s.addText("How the garment gets onto the person", { placeholder: "title" });
  const steps = [["Prepare", "Resize both photos to 864 × 576. Detect the body pose and draw it as a skeleton."], ["Two streams", "Person: noisy image + photo + pose. Garment: photo + pose."], ["Patches", "Cut each into 12 × 12-pixel patches: 3,456 tokens per image."], ["Joint attention", "28 blocks. Every body token can read every garment token."], ["Denoise", "30 steps turn pure noise into the final photo."]];
  const sw = 2.26, gap = 0.2;
  steps.forEach(([hd, b], i) => {
    const sx = 0.6 + i * (sw + gap);
    card(s, sx, 1.75, sw, 3.0, i === 3 ? C.text1 : C.background2);
    badge(s, String(i + 1), sx + 0.22, 1.97, 0.5);
    text(s, hd, { x: sx + 0.22, y: 2.62, w: sw - 0.44, h: 0.45, fontSize: 17, bold: true, color: i === 3 ? C.background1 : C.text1 });
    text(s, b, { x: sx + 0.22, y: 3.1, w: sw - 0.44, h: 1.55, fontSize: 14, color: i === 3 ? C.accent6 : C.text2 });
  });
  const notes4 = [["Flat-lay or worn", "A garment laid flat or worn by someone else: both work."], ["No mask needed", "The model decides itself which clothes to replace."], ["The garment is the prompt", "It sits where the text prompt sits in FLUX."]];
  notes4.forEach(([hd, b], i) => {
    const fx = 0.6 + i * 4.1;
    text(s, [{ text: hd, options: { bold: true, breakLine: true } }, { text: b, options: { color: C.text2 } }], { x: fx, y: 5.15, w: 3.85, h: 1.5, fontSize: 14, paraSpaceAfter: 3 });
  });
  s.addNotes("Walk left to right. The important step is 4, joint attention: a token on the person's chest can look directly at the garment token that holds the logo and copy it. There is no warping or cut-and-paste. For a flat-lay garment a blank skeleton is used, for a worn garment its wearer's pose.");

  // 5 ---------------------------------------------------------------- colour
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "The model" });
  s.addText("How colour and detail stay true", { placeholder: "title" });
  const rows = [["Pixel space, no VAE", "The garment's real pixel values go straight into the network."], ["Guidance scale 1.5", "Each step is pushed further towards “follow the garment”."], ["Last step unguided", "Prevents over-saturated colour at the end."], ["My loss: garment pixels × 2", "For fine-tuning, an error on the product costs double."]];
  rows.forEach(([hd, b], i) => {
    const ry = 1.75 + i * 1.18;
    badge(s, String(i + 1), 0.6, ry, 0.5, i === 3 ? C.accent2 : C.accent1, i === 3 ? C.background1 : C.text1);
    text(s, hd, { x: 1.3, y: ry - 0.02, w: 5.2, h: 0.4, fontSize: 17, bold: true });
    text(s, b, { x: 1.3, y: ry + 0.4, w: 5.2, h: 0.6, fontSize: 14, color: C.text2 });
  });
  text(s, "There is no separate colour-correction step: colour is preserved by design.", { x: 0.6, y: 6.45, w: 5.9, h: 0.5, fontSize: 14, italic: true, color: C.accent2 });
  s.addChart(pres.charts.BAR, [{ name: "Colour score", labels: ["Logo tee", "Crop top", "Skirt on dress", "Skirt on separates"], values: [5, 5, 3, 5] }], {
    x: 7.0, y: 1.6, w: 5.73, h: 4.6, barDir: "col", chartColors: [H.accent2, H.accent2, H.accent3, H.accent2], showLegend: false, showValue: true, dataLabelPosition: "outEnd",
    showTitle: true, title: "Colour score out of 5 (baseline try-ons)", titleFontSize: 14, titleColor: H.dk1, titleFontFace: "+mn-lt", valAxisMinVal: 0, valAxisMaxVal: 5, valAxisMajorUnit: 1, barGapWidthPct: 60, ...axis, objectName: name("Chart"),
  });
  text(s, "Scored by eye, one rater, four images.", { x: 7.0, y: 6.3, w: 5.73, h: 0.3, fontSize: 11, color: C.text2, align: "center" });
  s.addNotes("If asked about colour correction: the model has no separate colour-correction stage. Colour stays true for three reasons built into the model, plus one choice of mine for training. Rows 1 to 3 are FASHN's design. Row 4 is my design for fine-tuning. The one low colour score is the skirt on a model wearing a dress, where the skirt blended into the dress.");

  // 6 ---------------------------------------------------------------- LoRA
  pres.addSection({ title: "My work" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "My work" });
  s.addText("What I added: LoRA adapter layers", { placeholder: "title" });
  card(s, 0.6, 1.7, 6.3, 4.9);
  const bx = (label, sub, x0, y0, w0, fill, col) => {
    s.addShape(pres.ShapeType.roundRect, { x: x0, y: y0, w: w0, h: 0.95, rectRadius: 0.06, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: name("Block") });
    text(s, [{ text: label, options: { bold: true, breakLine: true } }, { text: sub, options: { fontSize: 12 } }], { x: x0, y: y0, w: w0, h: 0.95, align: "center", valign: "middle", fontSize: 15, color: col });
  };
  text(s, "input x", { x: 0.85, y: 3.5, w: 0.9, h: 0.4, fontSize: 14, bold: true, valign: "middle" });
  bx("Frozen layer W", "original weights, unchanged", 2.2, 2.15, 3.0, C.text1, C.background1);
  bx("A", "in → 16", 2.2, 4.3, 1.35, C.accent1, C.text1);
  bx("B", "16 → out", 3.85, 4.3, 1.35, C.accent1, C.text1);
  const ln = (x1, y1, x2, y2, arrow) => s.addShape(pres.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, line: { color: C.text2, width: 1.5, endArrowType: arrow ? "triangle" : "none" }, objectName: name("Connector") });
  ln(1.75, 3.7, 1.95, 3.7); ln(1.95, 2.62, 1.95, 4.77); ln(1.95, 2.62, 2.2, 2.62, true); ln(1.95, 4.77, 2.2, 4.77, true);
  ln(3.55, 4.77, 3.85, 4.77, true);
  ln(5.2, 2.62, 5.75, 2.62); ln(5.75, 2.62, 5.75, 3.45, true); ln(5.2, 4.77, 5.75, 4.77); ln(5.75, 4.77, 5.75, 3.95, true);
  badge(s, "+", 5.5, 3.45, 0.5, C.accent2, C.background1);
  ln(6.0, 3.7, 6.3, 3.7, true);
  text(s, "y", { x: 6.4, y: 3.5, w: 0.4, h: 0.4, fontSize: 14, bold: true, valign: "middle" });
  text(s, "Only A and B are trained. B starts at zero, so the model starts identical to the original.", { x: 0.85, y: 5.55, w: 5.8, h: 0.9, fontSize: 14, color: C.text2 });
  stat(s, "96", "layers get an adapter: attention and MLP in 24 blocks", 7.2, 1.7, 2.66, 2.3);
  stat(s, "1.01%", "of parameters are trained (9.83M of 972M)", 10.07, 1.7, 2.66, 2.3);
  stat(s, "37.5 MB", "adapter file, against 1,854 MB for the model", 7.2, 4.3, 2.66, 2.3);
  card(s, 10.07, 4.3, 2.66, 2.3, C.text1);
  text(s, [{ text: "Why LoRA", options: { bold: true, color: C.accent1, breakLine: true } }, { text: "A few hundred photos would make a full fine-tune forget what the model knows.", options: { color: C.background1 } }], { x: 10.3, y: 4.5, w: 2.2, h: 1.9, fontSize: 14, paraSpaceAfter: 4 });
  s.addNotes("This is the precise meaning of 'adding layers'. For each of 96 existing layers I add two small matrices A and B beside it. The original 972M weights are frozen. y = Wx + BAx. Rank 16. Only 9.83 million parameters train, 1.01 percent. The adapter can be merged in or removed.");

  // 7 ---------------------------------------------------------------- proof
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "My work" });
  s.addText("Proof the rebuilt training method is right", { placeholder: "title" });
  const lt = real.loss_by_t;
  s.addChart(pres.charts.BAR, [{ name: "My reconstruction", labels: lt.t.map((t) => "t = " + t), values: lt.ours }, { name: "Reversed convention", labels: lt.t.map((t) => "t = " + t), values: lt.reversed }], {
    x: 0.6, y: 1.6, w: 7.3, h: 4.9, barDir: "col", chartColors: [H.accent2, H.accent3], showLegend: true, legendPos: "b", showValue: false, valAxisLogScaleBase: 10, valAxisMinVal: 0.001, valAxisMaxVal: 10,
    showTitle: true, title: "Loss of the pretrained model (log scale, lower is better)", titleFontSize: 14, titleColor: H.dk1, titleFontFace: "+mn-lt", ...axis, objectName: name("Chart"),
  });
  const pr = [["863×", "lower loss with my reconstruction than with the opposite convention, on the real weights"], ["−99.4%", "error when a test model trained my way is sampled by FASHN's own sampler (0.80 → 0.005)"], ["0.00", "pixel difference between my inference code and FASHN's: identical output"]];
  pr.forEach(([b, l], i) => {
    const py = 1.7 + i * 1.65;
    card(s, 8.2, py, 4.53, 1.45);
    text(s, b, { x: 8.4, y: py, w: 1.75, h: 1.45, fontSize: 28, bold: true, color: C.accent2, fontFace: THEME.headFontFace, valign: "middle" });
    text(s, l, { x: 10.2, y: py + 0.1, w: 2.4, h: 1.25, fontSize: 12, color: C.text2, valign: "middle" });
  });
  s.addNotes("FASHN never published how they trained the model. I derived it from their sampling code: the model must predict photo minus noise along a straight line. Two proofs. Chart: the real pretrained model has loss around 0.006 under my version and around 5 under the reversed version, 863 times lower. Second: a small model trained with my loss is sampled correctly by FASHN's untouched sampler.");

  // 8 ---------------------------------------------------------------- quality
  pres.addSection({ title: "Results" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  s.addText("Output quality: what was measured", { placeholder: "title" });
  s.addChart(pres.charts.BAR, [{ name: "Rubric score (%)", labels: ["Logo tee", "Crop top", "Skirt on model in a dress", "Skirt on model in separates"], values: [100, 93.3, 36.7, 96.7] }], {
    x: 0.6, y: 1.6, w: 6.9, h: 4.9, barDir: "col", chartColors: [H.accent2, H.accent2, H.accent3, H.accent2], showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0",
    showTitle: true, title: "Rubric score, % of 30 points", titleFontSize: 14, titleColor: H.dk1, titleFontFace: "+mn-lt", valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 20, barGapWidthPct: 60, ...axis, objectName: name("Chart"),
  });
  card(s, 7.8, 1.7, 4.93, 2.25, C.text1);
  text(s, "36.7% → 96.7%", { x: 8.05, y: 1.85, w: 4.45, h: 0.85, fontSize: 34, bold: true, color: C.accent1, fontFace: THEME.headFontFace, valign: "middle" });
  text(s, "The same skirt, same settings, after the system pairs bottoms with a model wearing separates.", { x: 8.05, y: 2.75, w: 4.45, h: 1.05, fontSize: 14, color: C.background1 });
  const wS = 4.93, hS = (wS * sizes[files.skirt].height) / sizes[files.skirt].width;
  s.addImage({ path: files.skirt, x: 7.8, y: 4.2, w: wS, h: hS, altText: "The tiered skirt, the model in shorts, and the result with the skirt", objectName: name("Photo") });
  text(s, "From how the model is used, not from fine-tuning. Four images, one rater.", { x: 7.8, y: 4.3 + hS, w: wS, h: 0.5, fontSize: 12, color: C.text2 });
  s.addNotes("Six criteria, five points each: colour, print, neckline, length, shape, artefacts. Tops score 100 and 93 percent. The skirt failed on a model wearing a dress because there was no separate bottom to replace. I changed the system so each preset model records what it wears, and bottoms go to a model in separates: 36.7 to 96.7 percent. Be clear this is the only measured output improvement, and it is a system fix, not a model change.");

  // 9 ---------------------------------------------------------------- LoRA run
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  s.addText("LoRA training on the real model", { placeholder: "title" });
  s.addChart(pres.charts.LINE, [{ name: "Training loss (mean of last 10 steps)", labels: avg.map((_, i) => ((i + K) % 10 === 0 ? String(i + K) : "")), values: avg }], {
    x: 0.6, y: 1.6, w: 7.3, h: 4.0, chartColors: [H.accent2], lineSize: 2.5, lineDataSymbol: "none", showLegend: false, showValue: false, valAxisMinVal: 0, valAxisLabelFormatCode: "0.000",
    showTitle: true, title: "Training loss over 100 steps (mean of last 10)", titleFontSize: 14, titleColor: H.dk1, titleFontFace: "+mn-lt", showCatAxisTitle: true, catAxisTitle: "training step", catAxisTitleFontSize: 12, catAxisTitleColor: H.dk2, ...axis, objectName: name("Chart"),
  });
  stat(s, `${micro.train_loss_change_percent}%`.replace("-", "−"), "loss on the 2 trained samples (0.00510 → 0.00372)", 8.2, 1.7, 2.17, 2.35, C.background2, C.accent2, 30);
  stat(s, `+${micro.val_loss_change_percent}%`, "loss on the unseen sample: no real change", 10.56, 1.7, 2.17, 2.35, C.background2, C.accent5, 30);
  stat(s, "7 s", "per step, 3.26 GB memory, 13 min total", 8.2, 4.25, 2.17, 2.35, C.background2, C.accent2, 30);
  stat(s, "2.0%", "adapter size against the base model", 10.56, 4.25, 2.17, 2.35, C.background2, C.accent2, 30);
  card(s, 0.6, 5.8, 7.3, 0.95, C.text1);
  text(s, [{ text: "Read it correctly: ", options: { bold: true, color: C.accent1 } }, { text: "a memorisation test at half resolution. It proves training works. It is not a quality gain.", options: { color: C.background1 } }], { x: 0.8, y: 5.8, w: 6.9, h: 0.95, fontSize: 14, valign: "middle" });
  s.addNotes("I ran my LoRA training on the real 972M model on my laptop: 100 steps. Loss on the two training samples fell 27.1 percent. Say the three caveats yourself. One: the targets were the model's own outputs, so this is a memorisation test that proves the machinery works, not better try-ons; the unseen sample did not improve. Two: it ran at half resolution, 432 by 288, because a full-resolution step filled 8 GB of memory plus 8.6 GB of swap and never finished. Three: only two training samples.");

  // 10 --------------------------------------------------------------- vs general image models
  pres.addSection({ title: "Outlook" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Outlook" });
  s.addText("How this differs from ChatGPT", { placeholder: "title" });
  const cx = [0.6, 2.75, 7.85], cw = [2.0, 4.95, 4.88];
  card(s, cx[1], 1.6, cw[1], 0.62);
  card(s, cx[2], 1.6, cw[2], 0.62, C.text1);
  text(s, "General image model (ChatGPT)", { x: cx[1] + 0.2, y: 1.6, w: cw[1] - 0.4, h: 0.62, fontSize: 15, bold: true, valign: "middle" });
  text(s, "This project (specialist try-on model)", { x: cx[2] + 0.2, y: 1.6, w: cw[2] - 0.4, h: 0.62, fontSize: 15, bold: true, valign: "middle", color: C.background1 });
  const cmp = [
    ["Purpose", "Any image from a text description", "One task: this garment on this person"],
    ["Input", "Words; images are loose references", "Two photos plus the body pose"],
    ["Goal", "A good-looking picture", "The exact product: print, logo, colour"],
    ["Control", "Phrasing in words; results vary", "Fixed settings and seed; repeatable"],
    ["Access", "Closed weights; cannot be retrained", "Open weights; LoRA trains 1.01% of them"],
    ["Cost", "Paid per image on the provider's servers", "About 8 GB of GPU; free hosted demo"],
  ];
  cmp.forEach(([k, a, b], i) => {
    const ry = 2.36 + i * 0.6;
    if (i) s.addShape(pres.ShapeType.line, { x: 0.6, y: ry, w: 12.13, h: 0, line: { color: C.accent6, width: 0.75 }, objectName: name("Rule") });
    text(s, k, { x: cx[0], y: ry, w: cw[0], h: 0.6, fontSize: 14, bold: true, color: C.accent2, valign: "middle" });
    text(s, a, { x: cx[1] + 0.2, y: ry, w: cw[1] - 0.4, h: 0.6, fontSize: 14, color: C.text2, valign: "middle" });
    text(s, b, { x: cx[2] + 0.2, y: ry, w: cw[2] - 0.4, h: 0.6, fontSize: 14, valign: "middle" });
  });
  s.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 6.08, w: 12.13, h: 0.75, rectRadius: 0.08, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: name("Card") });
  text(s, [{ text: "Not benchmarked side by side. ", options: { bold: true } }, { text: "This is a difference in design and control, not a claim of better pictures." }], { x: 0.85, y: 6.08, w: 11.63, h: 0.75, fontSize: 15, valign: "middle" });
  s.addNotes("ChatGPT is a general assistant that can draw. This is a specialist whose only job is to copy one specific garment onto one specific person without changing it. For a seller, a nicer-looking shirt with a slightly different logo is a wrong product. Three reasons hold even if ChatGPT's picture looks good: I cannot study it layer by layer, I cannot adapt it to sarees and lehengas, and I cannot build a free product on it. Say yourself that you have not tested the two side by side, and that general models are improving quickly.");

  // 11 --------------------------------------------------------------- future scope
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Outlook" });
  s.addText("Future scope", { placeholder: "title" });
  const fut = [
    ["Next phase", "Prove the gain", ["300–500 paired photos from local sellers", "Fine-tune at full resolution on a 16 GB GPU", "Measure on unseen garments, two raters", "Add saree and lehenga categories"]],
    ["After that", "A usable product", ["Own hosted model with the adapter loaded", "Upscaling: output is 864 × 576 at most", "Checks for blurry or cropped photos", "Batch mode for a whole catalogue"]],
    ["Longer term", "Research directions", ["Several garments at once, with dupatta", "Different body shapes and sizes", "Short try-on videos", "Fewer steps through distillation"]],
  ];
  fut.forEach(([when, hd, items], i) => {
    const fx = 0.6 + i * 4.1, dark = i === 0;
    card(s, fx, 1.7, 3.93, 4.15, dark ? C.text1 : C.background2);
    badge(s, String(i + 1), fx + 0.25, 1.95, 0.5);
    text(s, when, { x: fx + 0.9, y: 1.95, w: 2.8, h: 0.5, fontSize: 13, bold: true, color: dark ? C.accent1 : C.accent2, valign: "middle" });
    text(s, hd, { x: fx + 0.25, y: 2.6, w: 3.45, h: 0.5, fontSize: 20, bold: true, color: dark ? C.background1 : C.text1, fontFace: THEME.headFontFace });
    text(s, items.map((t, j, a) => ({ text: t, options: { bullet: true, breakLine: j < a.length - 1 } })), { x: fx + 0.25, y: 3.25, w: 3.45, h: 2.45, fontSize: 14, color: dark ? C.accent6 : C.text2, paraSpaceAfter: 8 });
  });
  card(s, 0.6, 6.05, 12.13, 0.78);
  text(s, [{ text: "The bottleneck is data: ", options: { bold: true, color: C.accent2 } }, { text: "I know of no public dataset of paired photos of Indian garments. The framework is ready for it." }], { x: 0.85, y: 6.05, w: 11.63, h: 0.78, fontSize: 15, valign: "middle" });
  s.addNotes("Three horizons. First, the next phase of this project: collect a few hundred pairs, each pair being the garment alone and the same garment worn, fine-tune with my framework, and measure base against fine-tuned on unseen garments. That answers by how much it improves. Second, turning it into a product: my own hosted model, upscaling for Instagram sizes, input checks, batch mode. Third, open research directions. The framework is ready; the missing piece is data and a few GPU-hours.");

  // 12 --------------------------------------------------------------- close
  pres.addSection({ title: "Conclusion" });
  s = pres.addSlide({ masterName: "CLOSING_DARK", sectionTitle: "Conclusion" });
  s.addText("Where it stands, and what comes next", { placeholder: "title" });
  text(s, "Done and verified", { x: 0.6, y: 1.65, w: 5.8, h: 0.45, fontSize: 20, bold: true, color: C.accent1 });
  text(s, ["Model documented layer by layer", "Training method rebuilt and proved on real weights", "LoRA framework built, 12 of 12 tests passing", "Parser shown to be unused in our mode", "Working app with a measured baseline"].map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })), { x: 0.6, y: 2.25, w: 5.8, h: 2.9, fontSize: 16, color: C.background1, paraSpaceAfter: 9 });
  text(s, "Next steps", { x: 6.95, y: 1.65, w: 5.8, h: 0.45, fontSize: 20, bold: true, color: C.accent1 });
  ["Collect 300–500 paired photos of Indian garments", "Fine-tune on a 16 GB CUDA GPU at full resolution", "Evaluate on unseen garments with two raters", "Add saree and lehenga as new categories"].forEach((t, i) => {
    badge(s, String(i + 1), 6.95, 2.25 + i * 0.72, 0.46);
    text(s, t, { x: 7.6, y: 2.25 + i * 0.72, w: 5.1, h: 0.46, fontSize: 16, color: C.background1, valign: "middle" });
  });
  s.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 5.45, w: 12.13, h: 1.2, rectRadius: 0.08, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: name("Card") });
  text(s, [{ text: "Stated plainly: ", options: { bold: true } }, { text: "improvement in try-on quality from fine-tuning has not been measured yet. The framework to measure it is built and verified." }], { x: 0.9, y: 5.45, w: 11.53, h: 1.2, fontSize: 17, valign: "middle" });
  s.addNotes("Close on the honest position. Everything on the left is done and verified with numbers. The central question, does fine-tuning on Indian garments improve the output, is not answered yet because it needs data and a GPU. Ask for help with GPU access and sourcing sellers' photos.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
