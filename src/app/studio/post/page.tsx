import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { connection } from "next/server";
import { PostMaker } from "@/components/posts/PostMaker";
import { PageHeader } from "@/components/shared/PageHeader";
import { AppShell } from "@/components/site/AppShell";
import { resultUrl } from "@/lib/client/check";
import { TEST_ENGINES } from "@/lib/engines";
import { getMessages } from "@/lib/i18n/server";
import { readRecent, readSetup } from "@/lib/site";
import { store } from "@/lib/tryon";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return pageMeta({ title: t.meta.post, description: t.meta.descriptions.post, path: "/studio/post" });
}

/** `/studio/post?r=<key>` — a post built around one saved try-on result. Without one, pick a saved photo. */
export default async function PostPage({ searchParams }: PageProps<"/studio/post">) {
  await connection();
  const { r } = await searchParams;
  const key = typeof r === "string" && /^[0-9a-f]{32}$/.test(r) ? r : null;
  const [setup, result, recent, { t }] = await Promise.all([readSetup(), key ? store().find(key) : null, key ? [] : readRecent(), getMessages()]);

  return (
    <AppShell setup={setup} active="post" crumbs={[{ label: t.shell.nav.post }]}>
      {result ? (
        <PostMaker result={result} setup={setup} />
      ) : (
        <main className="app-page">
          <PageHeader
            kicker={t.post.kicker}
            title={t.post.pickFirst}
            lead={t.post.pickFirstBody}
            actions={
              <Link href="/studio" className="btn-ghost">
                {t.post.openStudio}
              </Link>
            }
          />
          {recent.length > 0 ? (
            <section aria-labelledby="pick">
              <h2 id="pick" className="section-title">
                {t.postX.pickTitle}
              </h2>
              <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
                {recent.map((m) => (
                  <li key={m.key}>
                    <Link
                      href={`/studio/post?r=${m.key}`}
                      aria-label={t.postX.pickOpen}
                      className="group block overflow-hidden rounded-2xl border border-line bg-paper-glow shadow-[var(--shadow-card)] transition-shadow hover:border-accent-strong hover:shadow-[var(--shadow-raised)]"
                    >
                      <div className="relative aspect-[2/3] overflow-hidden bg-paper-2">
                        <img src={resultUrl(m.key, "result.png")} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                        {TEST_ENGINES.has(m.engine) && (
                          <span className="absolute inset-x-0 top-0 bg-marigold py-0.5 text-center text-2xs font-semibold text-ink uppercase">{t.recent.testEngine}</span>
                        )}
                      </div>
                      <p className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-accent-strong">
                        {t.library.makePost} <span aria-hidden>→</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <div className="empty-state">
              <span aria-hidden className="mb-4 grid size-14 place-items-center rounded-full bg-accent-wash text-accent-strong">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm0 10h16M8 18h5" />
                </svg>
              </span>
              <p className="max-w-md text-ink-2">{t.postX.pickEmpty}</p>
              <Link href="/studio" className="btn-primary mt-6">
                {t.post.openStudio}
              </Link>
            </div>
          )}
        </main>
      )}
    </AppShell>
  );
}
