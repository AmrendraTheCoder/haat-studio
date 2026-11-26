import type { Metadata } from "next";
import { connection } from "next/server";
import { getMessages } from "@/lib/i18n/server";
import { ResearchForm } from "@/components/research/ResearchForm";
import { AppShell } from "@/components/site/AppShell";
import { readSetup } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).t.meta.research };
}

export default async function ResearchPage() {
  await connection();
  const [setup, { t }] = await Promise.all([readSetup(), getMessages()]);
  return (
    <AppShell setup={setup} active="research" crumbs={[{ label: t.shell.nav.research }]}>
      <ResearchForm setup={setup} />
    </AppShell>
  );
}
