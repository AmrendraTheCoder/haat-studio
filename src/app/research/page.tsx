import type { Metadata } from "next";
import { connection } from "next/server";
import { getMessages } from "@/lib/i18n/server";
import { ResearchForm } from "@/components/research/ResearchForm";
import { StudioHeader } from "@/components/site/site";
import { readSetup } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).t.meta.research };
}

export default async function ResearchPage() {
  await connection();
  const setup = await readSetup();
  return (
    <>
      <StudioHeader setup={setup} />
      <ResearchForm setup={setup} />
    </>
  );
}
