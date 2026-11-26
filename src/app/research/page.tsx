import type { Metadata } from "next";
import { connection } from "next/server";
import { getMessages } from "@/lib/i18n/server";
import { ResearchForm } from "@/components/research/ResearchForm";
import { AppShell } from "@/components/site/AppShell";
import { loadCatalogue, marketOptions } from "@/lib/market/catalogue";
import { readSetup } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).t.meta.research };
}

export default async function ResearchPage() {
  await connection();
  const [setup, { t }, catalogue] = await Promise.all([readSetup(), getMessages(), loadCatalogue()]);
  return (
    <AppShell setup={setup} active="research" crumbs={[{ label: t.shell.nav.research }]}>
      <ResearchForm setup={setup} market={marketOptions(catalogue)} />
    </AppShell>
  );
}
