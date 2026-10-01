import { store } from "@/lib/tryon";
import { EXPORT_SIZES, exportFor, type ExportSize } from "@/lib/tryon/image";
import { RESULT_FILES, type ResultFile } from "@/lib/tryon/store";

const KEY = /^[0-9a-f]{32}$/;
const notFound = () => new Response("Not found", { status: 404 });

/**
 * Stored files (result.png, garment.jpg, person.jpg), plus Instagram-sized
 * renders of the result: post.jpg, square.jpg, story.jpg. Add `?download`
 * to get a file save instead of an inline image.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string; file: string }> }) {
  const { key, file } = await params;
  if (!KEY.test(key)) return notFound();

  const size = file.replace(/\.jpg$/, "") as ExportSize;
  const isExport = file.endsWith(".jpg") && size in EXPORT_SIZES;
  if (!isExport && !RESULT_FILES.includes(file as ResultFile)) return notFound();

  const stored = await store().read(key, isExport ? "result.png" : (file as ResultFile));
  if (!stored) return notFound();
  const bytes = isExport ? await exportFor(stored, size) : stored;

  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.endsWith(".png") ? "image/png" : "image/jpeg",
      // Content-addressed: a key never points at different bytes.
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(download && { "Content-Disposition": `attachment; filename="haat-${key.slice(0, 8)}-${file}"` }),
    },
  });
}
