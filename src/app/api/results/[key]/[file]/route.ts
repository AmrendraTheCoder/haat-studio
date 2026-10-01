import { store } from "@/lib/tryon";
import { RESULT_FILES, type ResultFile } from "@/lib/tryon/store";

const KEY = /^[0-9a-f]{32}$/;

export async function GET(request: Request, { params }: { params: Promise<{ key: string; file: string }> }) {
  const { key, file } = await params;
  if (!KEY.test(key) || !RESULT_FILES.includes(file as ResultFile)) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = await store().read(key, file as ResultFile);
  if (!bytes) return new Response("Not found", { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.endsWith(".png") ? "image/png" : "image/jpeg",
      // Content-addressed: a key never points at different bytes.
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(download && { "Content-Disposition": `attachment; filename="haat-studio-${key.slice(0, 8)}-${file}"` }),
    },
  });
}
