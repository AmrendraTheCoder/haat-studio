import type { Metadata } from "next";
import { connection } from "next/server";
import { StudioApp } from "@/components/studio/StudioApp";
import { readRecent, readSetup } from "@/lib/site";
import { store } from "@/lib/tryon";

export const metadata: Metadata = { title: "Studio" };

/** `?r=<key>` opens a photo — finished, or still being made — so a reload or a shared link lands back on it. */
export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  await connection();
  const { r } = await searchParams;
  const key = typeof r === "string" && /^[0-9a-f]{32}$/.test(r) ? r : null;
  const [setup, recent, featured] = await Promise.all([readSetup(), readRecent(), store().featured()]);
  return <StudioApp setup={setup} initialRecent={recent} initialFeatured={featured} initialKey={key} badLink={r !== undefined && key === null} />;
}
