import type { Metadata } from "next";
import { notFound } from "next/navigation";

import page from "@/components/Page.module.css";
import { Blocks } from "@/components/Blocks";
import { AvailabilityCalculator } from "@/components/AvailabilityCalculator";
import { LatencyChart } from "@/components/LatencyChart";
import { SimLink } from "@/components/SimLink";
import {
  LEVEL_LIST,
  REFERENCE_BY_SLUG,
  REFERENCE_LIST,
  SIM_INDEX_OF,
  SOURCE,
  SYNCED_LABEL,
  SYNC_META,
  SYNC_OK,
} from "@/content";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return REFERENCE_LIST.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const section = REFERENCE_BY_SLUG[slug];
  if (!section) return {};
  return {
    title: section.title,
    description: section.lede,
    openGraph: { title: section.title, description: section.lede },
    alternates: { canonical: `/reference/${section.slug}/` },
  };
}

export default async function ReferencePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const section = REFERENCE_BY_SLUG[slug];
  if (!section) notFound();

  const simIndex = SIM_INDEX_OF[section.key];
  const sim = simIndex === undefined ? null : LEVEL_LIST[simIndex];

  return (
    <div className={page.scroll}>
      <article className={page.column}>
        <div className={page.kicker}>reference — {section.group}</div>
        <h1 className={page.title}>{section.title}</h1>

        {/* Written for this site. The badge below marks where that stops. */}
        <div className={page.summary}>
          <div className={page.summaryLabel}>in short — written for this site</div>
          <div className={page.lede}>{section.lede}</div>
          {section.rows.length > 0 && (
            <div className={page.rows}>
              {section.rows.map((row) => (
                <div key={row.k} className={page.row}>
                  <div className={page.rowKey}>{row.k}</div>
                  <div className={page.rowVal}>{row.v}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={page.sectionRule}>
          <span className={page.sectionRuleLabel}>from the primer — full section</span>
          <span className={`${page.syncBadge} ${SYNC_OK ? page.syncBadgeOk : ""}`}>
            {SYNC_OK ? "synced" : "authored — sync pending"}
          </span>
        </div>

        <Blocks blocks={section.body} />

        {section.calc && <AvailabilityCalculator />}
        {section.latency && <LatencyChart />}

        <div className={page.sourceStrip}>
          <span className={page.sourceKey}>source</span>
          <span className={page.sourceVal}>
            {SOURCE.repo} / {SOURCE.file}
          </span>
          <span className={page.sourceKey}>anchor</span>
          <span className={page.sourceVal}>#{section.anchor}</span>
          <span className={page.sourceKey}>synced</span>
          <span className={page.sourceVal}>
            {SYNC_OK ? `${SYNCED_LABEL} · ${SYNC_META.syncedAt.slice(0, 10)}` : SYNCED_LABEL}
          </span>
        </div>

        <div className={page.footerRow}>
          <a
            className={page.quietLink}
            href={section.link}
            target="_blank"
            rel="noreferrer noopener"
          >
            this section in the primer ↗
          </a>
          {sim && <SimLink slug={sim.slug} title={sim.title} index={simIndex!} />}
        </div>
      </article>
    </div>
  );
}
