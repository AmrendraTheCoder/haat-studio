import type { Metadata } from "next";
import { connection } from "next/server";
import { ResearchForm } from "@/components/research/ResearchForm";
import { StudioHeader } from "@/components/site/site";
import { readSetup } from "@/lib/site";

export const metadata: Metadata = { title: "Market research" };

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
