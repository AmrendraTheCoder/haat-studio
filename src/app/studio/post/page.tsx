import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PostMaker } from "@/components/posts/PostMaker";
import { StudioHeader } from "@/components/site/site";
import { getMessages } from "@/lib/i18n/server";
import { readSetup } from "@/lib/site";
import { store } from "@/lib/tryon";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).t.meta.post };
}

/** `/studio/post?r=<key>` — a post built around one saved try-on result. */
export default async function PostPage({ searchParams }: PageProps<"/studio/post">) {
  await connection();
  const { r } = await searchParams;
  const key = typeof r === "string" && /^[0-9a-f]{32}$/.test(r) ? r : null;
  const [setup, result, { t }] = await Promise.all([readSetup(), key ? store().find(key) : null, getMessages()]);

  return (
    <>
      <StudioHeader setup={setup} />
      {result ? (
        <PostMaker result={result} setup={setup} />
      ) : (
        <main className="mx-auto max-w-xl px-4 py-20 text-center">
          <h1 className="text-3xl font-extrabold tracking-[-0.04em]">{t.post.pickFirst}</h1>
          <p className="mt-3 text-ink-2">{t.post.pickFirstBody}</p>
          <Link href="/studio" className="btn-primary mt-6">
            {t.post.openStudio}
          </Link>
        </main>
      )}
    </>
  );
}
