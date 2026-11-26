/**
 * Renders the browser and home-screen icons from src/app/icon.svg (the source of truth):
 *   src/app/apple-icon.png  180×180, full-bleed (iOS rounds the corners itself)
 *   src/app/favicon.ico     16 + 32 + 48 px, for browsers that don't take SVG icons
 * and the 1200×630 link preview (WhatsApp, Instagram, LinkedIn, X) from the featured result:
 *   src/app/opengraph-image.jpg, src/app/twitter-image.jpg
 *
 *   npx tsx scripts/icons.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";

const app = path.join(process.cwd(), "src", "app");

async function main() {
  const svg = await readFile(path.join(app, "icon.svg"), "utf8");
  // Apple icons are masked by iOS, so the tile is square, with the mark a little smaller.
  const square = svg.replace(/rx="[^"]*"/, 'rx="0"').replace("<path ", '<path transform="translate(2.4 2.4) scale(0.85)" ');
  await writeFile(path.join(app, "apple-icon.png"), await sharp(Buffer.from(square), { density: 1200 }).resize(180, 180).png().toBuffer());

  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map((s) => sharp(Buffer.from(svg), { density: 600 }).resize(s, s).png().toBuffer()));
  // ICO with PNG entries: 6-byte header, a 16-byte directory entry per image, then the images.
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((s, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(s, e);
    header.writeUInt8(s, e + 1);
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(pngs[i].length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += pngs[i].length;
  });
  await writeFile(path.join(app, "favicon.ico"), Buffer.concat([header, ...pngs]));
  console.log("wrote apple-icon.png and favicon.ico");
  await shareImage(svg);
}

/** 1200×630: mark, name and promise on the left; a real before → after from the featured result on the right. */
async function shareImage(iconSvg: string) {
  const W = 1200, H = 630;
  const results = path.join(process.cwd(), "data", "results");
  let featured: string | undefined;
  try {
    featured = (JSON.parse(await readFile(path.join(results, "featured.json"), "utf8")) as string[])[0];
  } catch {
    /* no featured result: text-only card */
  }
  const photoH = 420, photoW = Math.round((photoH * 2) / 3), gap = 24, right = 48;
  const photoX = [W - right - 2 * photoW - gap, W - right - photoW];
  const layers: OverlayOptions[] = [];
  if (featured) {
    const frame = async (file: string) =>
      sharp(path.join(results, featured!, file)).resize(photoW, photoH, { fit: "cover", position: "top" })
        .composite([{ input: Buffer.from(`<svg width="${photoW}" height="${photoH}"><rect width="${photoW}" height="${photoH}" rx="18" fill="#fff"/></svg>`), blend: "dest-in" }]).png().toBuffer();
    const [before, after] = await Promise.all([frame("person.jpg"), frame("result.png")]);
    const top = Math.round((H - photoH) / 2) + 6;
    layers.push({ input: before, left: photoX[0], top }, { input: after, left: photoX[1], top });
  }
  const tag = (x: number, y: number, text: string, fill: string, color: string, w: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="38" rx="19" fill="${fill}"/><text x="${x + w / 2}" y="${y + 25}" text-anchor="middle" font-family="Helvetica Neue, Arial" font-size="17" font-weight="700" fill="${color}">${text}</text>`;
  const mark = iconSvg.replace(/<svg[^>]*>/, "").replace("</svg>", "");
  const photoLabels = featured
    ? `${tag(photoX[0] + 14, Math.round((H - photoH) / 2) + 20, "BEFORE", "#1C1917", "#FBF6EE", 92)}${tag(photoX[1] + 14, Math.round((H - photoH) / 2) + 20, "AFTER · AI", "#C8105A", "#FBF6EE", 124)}`
    : "";
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#F6F1EA"/>
    <rect x="0" y="${H - 10}" width="${W}" height="10" fill="#C8105A"/>
    <g transform="translate(64 64) scale(2.6)">${mark}</g>
    <text x="164" y="116" font-family="Georgia, serif" font-size="46" font-weight="700" fill="#1C1917">Haat Studio</text>
    <text x="64" y="246" font-family="Georgia, serif" font-size="54" font-weight="700" fill="#1C1917">Your product,</text>
    <text x="64" y="310" font-family="Georgia, serif" font-size="54" font-weight="700" fill="#C8105A">on a model.</text>
    <text x="64" y="366" font-family="Helvetica Neue, Arial" font-size="21" fill="#5F5650">One garment photo becomes an</text>
    <text x="64" y="396" font-family="Helvetica Neue, Arial" font-size="21" fill="#5F5650">on-model photo, an Instagram post</text>
    <text x="64" y="426" font-family="Helvetica Neue, Arial" font-size="21" fill="#5F5650">and a market plan. Free.</text>
    ${tag(64, 466, "Try-on", "#FFFFFF", "#1C1917", 104)}${tag(180, 466, "Post maker", "#FFFFFF", "#1C1917", 140)}${tag(332, 466, "Market plan", "#FFFFFF", "#1C1917", 150)}
    <text x="64" y="572" font-family="Helvetica Neue, Arial" font-size="18" fill="#8C8279">English · हिन्दी · for small sellers in India</text>
    ${photoLabels}
  </svg>`;
  const png = await sharp(Buffer.from(card)).composite(layers).png({ compressionLevel: 9 }).toBuffer();
  // the labels must sit above the photos, so draw them again on top
  const labels = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${photoLabels}</svg>`);
  // JPEG keeps the preview small: WhatsApp skips link images much over 300 KB.
  const out = await sharp(png).composite([{ input: labels }]).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  await writeFile(path.join(app, "opengraph-image.jpg"), out);
  await writeFile(path.join(app, "twitter-image.jpg"), out);
  console.log(`wrote opengraph-image.jpg and twitter-image.jpg (${Math.round(out.length / 1024)} KB)${featured ? ` from result ${featured.slice(0, 8)}` : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
