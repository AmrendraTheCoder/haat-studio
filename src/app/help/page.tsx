import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { connection } from "next/server";
import { HelpContent } from "@/components/shared/HelpTip";
import { HELP_SECTIONS } from "@/lib/ui/help";
import { PageHeader } from "@/components/shared/PageHeader";
import { AppShell } from "@/components/site/AppShell";
import { getMessages } from "@/lib/i18n/server";
import { readSetup } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return pageMeta({ title: t.meta.help, description: t.meta.descriptions.help, path: "/help" });
}

export default async function HelpPage() {
  await connection();
  const [setup, { t }] = await Promise.all([readSetup(), getMessages()]);
  return (
    <AppShell setup={setup} active="help" crumbs={[{ label: t.shell.nav.help }]}>
      <main className="app-page">
        <PageHeader title={t.help.pageTitle} lead={t.help.pageLead} />
        <div className="grid items-start gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] xl:gap-14">
          <nav aria-label={t.help.contents} className="lg:sticky lg:top-24">
            <p className="text-2xs font-semibold tracking-[0.08em] text-ink-3 uppercase">{t.help.contents}</p>
            <ul className="mt-2 flex flex-wrap gap-2 lg:flex-col lg:gap-0">
              {HELP_SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#help-${s.id}`} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink lg:-ml-3">
                    {t.help.sections[s.id]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <HelpContent />
        </div>
      </main>
    </AppShell>
  );
}
