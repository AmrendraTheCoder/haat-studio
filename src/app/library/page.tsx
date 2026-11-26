import type { Metadata } from "next";
import { connection } from "next/server";
import { LibraryView } from "@/components/library/LibraryView";
import { AppShell } from "@/components/site/AppShell";
import { getMessages } from "@/lib/i18n/server";
import { readRecent, readSetup } from "@/lib/site";
import { store } from "@/lib/tryon";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).t.meta.library };
}

/** Every saved photo on this server, sortable and filterable. Reads only. */
export default async function LibraryPage() {
  await connection();
  const [setup, results, featured, { t }] = await Promise.all([readSetup(), readRecent(500), store().featured(), getMessages()]);
  return (
    <AppShell setup={setup} active="library" crumbs={[{ label: t.library.title }]}>
      <LibraryView results={results} featured={featured} />
    </AppShell>
  );
}
