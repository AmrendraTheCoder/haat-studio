import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { classify } from "@/lib/tryon/fashn-space";
import { EXPORT_SIZES, exportFor, InputError, prepareImage } from "@/lib/tryon/image";
import { diskStore } from "@/lib/tryon/store";
import type { ResultMeta } from "@/lib/tryon/types";

describe("prepareImage", () => {
  it("flattens transparency onto white, not the black PIL would produce", async () => {
    const cutout = await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    const { bytes: out, info } = await prepareImage(cutout, "garment");
    expect(info).toMatchObject({ flattened: true, rotated: false, resized: false });
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]].every((v) => v > 245)).toBe(true);
  });

  it("bounds large photos to 1536px without changing the aspect ratio", async () => {
    const big = await sharp({ create: { width: 3000, height: 4500, channels: 3, background: "#888" } }).jpeg().toBuffer();
    const { bytes, info } = await prepareImage(big, "garment");
    const meta = await sharp(bytes).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([1024, 1536, "jpeg"]);
    expect(info).toMatchObject({ width: 3000, height: 4500, outWidth: 1024, outHeight: 1536, resized: true, flattened: false });
  });

  it("applies EXIF orientation so phone photos arrive upright", async () => {
    // Stored landscape with "rotate 90°" in EXIF — what many phones write.
    const sideways = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#888" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const { bytes, info } = await prepareImage(sideways, "garment");
    const meta = await sharp(bytes).metadata();
    expect([meta.width, meta.height]).toEqual([400, 600]);
    expect(info).toMatchObject({ width: 400, height: 600, rotated: true, resized: false });
  });

  it("strips camera metadata, and passes an already-clean JPEG through byte for byte", async () => {
    const withExif = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#888" } })
      .jpeg()
      .withExif({ IFD0: { Make: "PhoneCo" } })
      .toBuffer();
    const first = await prepareImage(withExif, "garment");
    expect(first.info.stripped).toBe(true);
    expect((await sharp(first.bytes).metadata()).exif).toBeUndefined();

    const again = await prepareImage(first.bytes, "garment");
    expect(again.bytes.equals(first.bytes)).toBe(true);
    expect(again.info).toMatchObject({ stripped: false, resized: false, rotated: false });
  });

  it("rejects photos too small to be useful and files that aren't images", async () => {
    const tiny = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#888" } }).png().toBuffer();
    await expect(prepareImage(tiny, "garment")).rejects.toThrow(InputError);
    const tinyJpeg = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#888" } }).jpeg().toBuffer();
    await expect(prepareImage(tinyJpeg, "garment")).rejects.toThrow(/too small/);
    await expect(prepareImage(Buffer.from("not an image"), "garment")).rejects.toThrow(/isn't an image/);
  });
});

describe("exportFor", () => {
  it("renders each Instagram size at its exact dimensions without cropping the photo", async () => {
    const result = await sharp({ create: { width: 576, height: 864, channels: 3, background: "#c33" } }).png().toBuffer();
    for (const [size, { width, height }] of Object.entries(EXPORT_SIZES)) {
      const meta = await sharp(await exportFor(result, size as keyof typeof EXPORT_SIZES)).metadata();
      expect([size, meta.width, meta.height, meta.format]).toEqual([size, width, height, "jpeg"]);
    }
  });
});

describe("classify (ZeroGPU errors)", () => {
  it("recognises the anonymous-quota refusal seen on 2026-10-02", () => {
    const e = classify({
      title: "ZeroGPU quota exceeded",
      message:
        "You have exceeded your ZeroGPU runs limit. Authenticate with a Hugging Face token for more quota - https://huggingface.co/settings/tokens",
    });
    expect(e.kind).toBe("quota");
    expect(e.retryAfterSeconds).toBeUndefined();
  });

  it("reads the refill time from a signed-in quota message", () => {
    const e = classify({ message: "You have exceeded your GPU quota (60s requested vs. 12s left). Try again in 0:13:21" });
    expect(e).toMatchObject({ kind: "quota", retryAfterSeconds: 13 * 60 + 21 });
  });

  it("separates capacity problems from unknown failures", () => {
    expect(classify({ message: "No GPU was available after 60s. Retry later" }).kind).toBe("unavailable");
    expect(classify({ message: "CUDA error: device-side assert triggered" }).kind).toBe("unknown");
    expect(classify({}).message).toMatch(/without a message/);
  });
});

describe("diskStore", () => {
  const dirs: string[] = [];
  afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

  it("round-trips a result and lists newest first", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "haat-store-"));
    dirs.push(root);
    const store = diskStore(root);
    const meta = (key: string, createdAt: string): ResultMeta => ({
      key,
      engine: "fashn-space",
      settings: { category: "tops", photoType: "flat-lay", quality: "fast", seed: 1 },
      personId: "standing-men",
      createdAt,
      totalMs: 1,
      queueMs: 0,
    });
    const files = { "result.png": Buffer.from("r"), "garment.jpg": Buffer.from("g"), "person.jpg": Buffer.from("p") };
    await store.save(meta("a".repeat(32), "2026-10-01T00:00:00.000Z"), files);
    await store.save(meta("b".repeat(32), "2026-10-02T00:00:00.000Z"), files);

    expect((await store.find("a".repeat(32)))?.createdAt).toBe("2026-10-01T00:00:00.000Z");
    expect((await store.list(10)).map((m) => m.key[0])).toEqual(["b", "a"]);
    expect((await store.read("a".repeat(32), "garment.jpg"))?.toString()).toBe("g");
  });

  it("keeps an ordered featured list that forgets deleted or unknown results", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "haat-store-"));
    dirs.push(root);
    const store = diskStore(root);
    const files = { "result.png": Buffer.from("r"), "garment.jpg": Buffer.from("g"), "person.jpg": Buffer.from("p") };
    const meta = (key: string): ResultMeta => ({
      key,
      engine: "fashn-space",
      settings: { category: "tops", photoType: "flat-lay", quality: "fast", seed: 1 },
      personId: "standing-men",
      createdAt: "2026-10-02T00:00:00.000Z",
      totalMs: 1,
      queueMs: 0,
    });
    await store.save(meta("a".repeat(32)), files);
    await store.save(meta("b".repeat(32)), files);

    expect(await store.featured()).toEqual([]);
    await store.setFeatured("a".repeat(32), true);
    await store.setFeatured("b".repeat(32), true);
    expect(await store.featured()).toEqual(["b".repeat(32), "a".repeat(32)]);
    await store.setFeatured("b".repeat(32), false);
    expect(await store.featured()).toEqual(["a".repeat(32)]);
    await expect(store.setFeatured("c".repeat(32), true)).rejects.toThrow(/no result/);
    await rm(path.join(root, "a".repeat(32)), { recursive: true });
    expect(await store.featured()).toEqual([]);
  });

  it("refuses keys that could escape the results folder", async () => {
    const store = diskStore(await mkdtemp(path.join(tmpdir(), "haat-store-")));
    await expect(store.read("../../etc/passwd", "result.png")).rejects.toThrow(/invalid result key/);
  });
});
