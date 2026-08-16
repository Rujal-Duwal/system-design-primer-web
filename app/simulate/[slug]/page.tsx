import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Simulation } from "@/components/Simulation";
import { LEVEL_LIST } from "@/content";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return LEVEL_LIST.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const index = LEVEL_LIST.findIndex((l) => l.slug === slug);
  if (index === -1) return {};
  const level = LEVEL_LIST[index];
  const title = `Simulation ${String(index + 1).padStart(2, "0")}: ${level.title}`;
  return {
    title,
    description: level.brief,
    openGraph: { title, description: level.brief },
    alternates: { canonical: `/simulate/${level.slug}/` },
  };
}

export default async function SimulatePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const index = LEVEL_LIST.findIndex((l) => l.slug === slug);
  if (index === -1) notFound();

  return <Simulation level={LEVEL_LIST[index]} index={index} />;
}
