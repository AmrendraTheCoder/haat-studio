import type { Metadata } from "next";
import { connection } from "next/server";
import { HELP_SECTIONS, HelpContent } from "@/components/shared/HelpTip";
import { AppShell } from "@/components/site/AppShell";
import { getMessages } from "@/lib/i18n/server";
import { readSetup } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).t.help.pageTitle };
}

export default async function HelpPage() {
  await connection();
  const [setup, { t }] = await Promise.all([readSetup(), getMessages()]);
  return (
    <AppShell setup={setup} active="help" crumbs={[{ label: t.shell.nav.help }]}>
      <main className="app-page">
        <h1 className="h-page sm:text-4xl">{t.help.pageTitle}</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">{t.help.pageLead}</p>
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
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
