import { CTAS, FORMATS, PALETTES, discountPct, inr, type Cta, type Palette, type PostFormat, type Template } from "./spec";

/**
 * Draws a post onto a canvas. Browser-only.
 *
 * Canvas rather than SVG-to-image: an SVG drawn as an <img> can't use the
 * page's web fonts, so text would fall back to a system font. Canvas text
 * uses the loaded fonts, and the preview *is* the download — the same
 * pixels, at full Instagram resolution.
 *
 * Every layout keeps text off the garment: it goes in a panel, a frame, or
 * a corner badge — never across the photo.
 */

export interface Draft {
  shopName: string;
  handle: string;
  product: string;
  price: number | null;
  mrp: number | null;
  offer: string;
  cta: Cta;
}

export interface Look {
  format: PostFormat;
  template: Template;
  palette: Palette;
}

const SANS = '"Inter Variable", Inter, system-ui, sans-serif';
const MONO = '"Geist Mono", ui-monospace, monospace';

/** Waits for the weights and glyphs (including ₹) the canvas will use. */
export async function loadFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load(`800 64px ${SANS}`, "₹1,29,999 Aa"),
    document.fonts.load(`600 32px ${SANS}`, "Aa"),
    document.fonts.load(`500 28px ${MONO}`, "Aa@"),
  ]).catch(() => {});
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

/** The photo, whole (never cropped), on a blurred, dimmed copy of itself. */
function photo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, fallback: string) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = fallback;
  ctx.fillRect(x, y, w, h);
  const cover = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  if ("filter" in ctx) {
    ctx.filter = "blur(36px) brightness(0.8)";
    ctx.drawImage(img, x + (w - img.naturalWidth * cover) / 2, y + (h - img.naturalHeight * cover) / 2, img.naturalWidth * cover, img.naturalHeight * cover);
    ctx.filter = "none";
  }
  const fit = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * fit;
  const dh = img.naturalHeight * fit;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg: string, fg: string, align: "left" | "right" = "left") {
  ctx.font = `700 ${size}px ${SANS}`;
  const padX = size * 0.7;
  const h = size * 1.9;
  const w = ctx.measureText(text).width + padX * 2;
  const left = align === "left" ? x : x - w;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(left, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + padX, y + h / 2 + size * 0.04);
  ctx.textBaseline = "alphabetic";
  return { w, h };
}

/** Price, then struck-through MRP and the discount, on one baseline. Returns the width used. */
function priceLine(ctx: CanvasRenderingContext2D, d: Draft, x: number, baseline: number, size: number, ink: string, soft: string, accent: string) {
  ctx.font = `900 ${size}px ${SANS}`;
  ctx.fillStyle = accent;
  const main = d.price ? inr(d.price) : "₹ —";
  ctx.fillText(main, x, baseline);
  let cursor = x + ctx.measureText(main).width + size * 0.3;
  if (d.price && d.mrp && d.mrp > d.price) {
    ctx.font = `600 ${size * 0.42}px ${SANS}`;
    ctx.fillStyle = soft;
    const mrp = inr(d.mrp);
    ctx.fillText(mrp, cursor, baseline);
    const mw = ctx.measureText(mrp).width;
    ctx.strokeStyle = soft;
    ctx.lineWidth = Math.max(2, size * 0.035);
    ctx.beginPath();
    ctx.moveTo(cursor - 2, baseline - size * 0.14);
    ctx.lineTo(cursor + mw + 2, baseline - size * 0.14);
    ctx.stroke();
    cursor += mw + size * 0.2;
    ctx.font = `800 ${size * 0.42}px ${SANS}`;
    ctx.fillStyle = ink;
    ctx.fillText(`${discountPct({ price: d.price, mrp: d.mrp })}% off`, cursor, baseline);
  }
  return cursor - x;
}

const label = (d: Draft) => (d.handle ? `@${d.handle}` : d.shopName);

export function renderPost(canvas: HTMLCanvasElement, img: HTMLImageElement, d: Draft, look: Look) {
  const { width: W, height: H } = FORMATS[look.format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const c = PALETTES[look.palette];
  const P = 64;
  const product = d.product.trim() || "Your product name";

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  if (look.template === "frame") {
    const top = look.format === "story" ? 190 : 130;
    const bottom = look.format === "story" ? 330 : look.format === "post" ? 250 : 220;
    const m = 56;
    ctx.font = `600 30px ${MONO}`;
    ctx.fillStyle = c.soft;
    ctx.textAlign = "center";
    ctx.fillText((d.shopName || label(d) || "your shop").toUpperCase().split("").join(" "), W / 2, top / 2 + 12);
    ctx.textAlign = "left";
    photo(ctx, img, m, top, W - m * 2, H - top - bottom, c.panel);
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(m, top, W - m * 2, H - top - bottom);
    const y0 = H - bottom;
    ctx.font = `800 ${look.format === "story" ? 60 : 50}px ${SANS}`;
    ctx.fillStyle = c.ink;
    const lines = wrap(ctx, product, W - m * 2 - 360, 2);
    lines.forEach((l, i) => ctx.fillText(l, m, y0 + 78 + i * 58));
    ctx.textAlign = "right";
    ctx.font = `900 ${look.format === "story" ? 76 : 64}px ${SANS}`;
    ctx.fillStyle = c.accent;
    ctx.fillText(d.price ? inr(d.price) : "₹ —", W - m, y0 + 86);
    ctx.font = `600 28px ${SANS}`;
    ctx.fillStyle = c.soft;
    const sub = [d.offer, CTAS[d.cta]].filter(Boolean).join("  ·  ");
    ctx.fillText(sub, W - m, y0 + 136);
    if (d.mrp && d.price && d.mrp > d.price) ctx.fillText(`MRP ${inr(d.mrp)} · ${discountPct({ price: d.price, mrp: d.mrp })}% off`, W - m, y0 + 176);
    ctx.textAlign = "left";
    return;
  }

  // panel + badge: photo on top, a solid details panel below.
  const story = look.format === "story";
  const panelH = story ? 600 : look.format === "post" ? 420 : 340;
  const photoH = H - panelH;
  photo(ctx, img, 0, 0, W, photoH, c.panel);

  const tag = label(d);
  if (tag) pill(ctx, tag, P * 0.6, P * 0.6, 30, "rgba(0,0,0,0.5)", "#ffffff");

  if (look.template === "badge") {
    const off = d.price && d.mrp && d.mrp > d.price ? discountPct({ price: d.price, mrp: d.mrp }) : null;
    const r = look.format === "square" ? 104 : 120;
    const cx = W - P * 0.6 - r;
    const cy = P * 0.6 + r;
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.onAccent;
    ctx.textAlign = "center";
    if (off) {
      ctx.font = `900 ${r * 0.62}px ${SANS}`;
      ctx.fillText(`${off}%`, cx, cy + r * 0.12);
      ctx.font = `800 ${r * 0.26}px ${SANS}`;
      ctx.fillText("OFF", cx, cy + r * 0.48);
    } else {
      ctx.font = `900 ${r * 0.3}px ${SANS}`;
      const words = wrap(ctx, (d.offer || "New in").toUpperCase(), r * 1.6, 3);
      words.forEach((w, i) => ctx.fillText(w, cx, cy + (i - (words.length - 1) / 2) * r * 0.34 + r * 0.1));
    }
    ctx.textAlign = "left";
  }

  ctx.fillStyle = c.panel;
  ctx.fillRect(0, photoH, W, panelH);
  ctx.fillStyle = c.accent;
  ctx.fillRect(0, photoH, W, 8);

  // Laid out top-down with explicit gaps, so lines never touch whatever the
  // text; the order button sits on its own bottom row, clear of the price.
  const top = photoH + 8;
  const nameSize = story ? 70 : 56;
  const priceSize = story ? 104 : look.format === "square" ? 72 : 84;
  let y = top;
  if (d.offer) {
    y += story ? 70 : 56;
    ctx.font = `600 28px ${MONO}`;
    ctx.fillStyle = c.accent;
    ctx.fillText(d.offer.toUpperCase(), P, y);
    y += nameSize + 12;
  } else {
    y += nameSize + (story ? 50 : 34);
  }
  ctx.font = `800 ${nameSize}px ${SANS}`;
  ctx.fillStyle = c.ink;
  const lines = wrap(ctx, product, W - P * 2, story ? 2 : 1);
  lines.forEach((l, i) => ctx.fillText(l, P, y + i * (nameSize + 8)));
  y += (lines.length - 1) * (nameSize + 8) + priceSize + (story ? 40 : 24);
  priceLine(ctx, d, P, y, priceSize, c.ink, c.soft, c.accent);

  const rowY = H - (story ? 90 : look.format === "square" ? 40 : 56);
  const pillSize = story ? 38 : 32;
  const { h } = pill(ctx, `${CTAS[d.cta]}  →`, W - P, rowY - pillSize * 1.9, pillSize, c.accent, c.onAccent, "right");
  if (d.shopName && d.handle) {
    ctx.font = `600 28px ${SANS}`;
    ctx.fillStyle = c.soft;
    ctx.fillText(d.shopName, P, rowY - h / 2 + 10);
  }
}
