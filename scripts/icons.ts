/**
 * Renders the browser and home-screen icons from src/app/icon.svg (the source of truth):
 *   src/app/apple-icon.png  180×180, full-bleed (iOS rounds the corners itself)
 *   src/app/favicon.ico     16 + 32 + 48 px, for browsers that don't take SVG icons
 *
 *   npx tsx scripts/icons.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
