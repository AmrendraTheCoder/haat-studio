import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PostMaker } from "@/components/posts/PostMaker";
import { StudioHeader } from "@/components/site/site";
import { readSetup } from "@/lib/site";
import { store } from "@/lib/tryon";

export const metadata: Metadata = { title: "Post maker" };

/** `/studio/post?r=<key>` — a post built around one saved try-on result. */
export default async function PostPage({ searchParams }: PageProps<"/studio/post">) {
  await connection();
  const { r } = await searchParams;
  const key = typeof r === "string" && /^[0-9a-f]{32}$/.test(r) ? r : null;
  const [setup, result] = await Promise.all([readSetup(), key ? store().find(key) : null]);

  return (
    <>
      <StudioHeader setup={setup} />
      {result ? (
        <PostMaker result={result} setup={setup} />
      ) : (
        <main className="mx-auto max-w-xl px-4 py-20 text-center">
          <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Pick a photo first.</h1>
          <p className="mt-3 text-ink-2">A post is built around one of your try-on photos. Make one in the studio, or open one from your recent photos.</p>
          <Link href="/studio" className="btn-primary mt-6">
            Open the studio →
          </Link>
        </main>
      )}
    </>
  );
}
