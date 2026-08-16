import type { Metadata } from "next";
import { notFound } from "next/navigation";

import page from "@/components/Page.module.css";
import styles from "@/components/Exercise.module.css";
import { ExerciseSteps } from "@/components/ExerciseSteps";
import {
  EXERCISE_BY_SLUG,
  EXERCISE_LIST,
  SOURCE,
  SYNCED_LABEL,
  SYNC_META,
  SYNC_OK,
} from "@/content";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return EXERCISE_LIST.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ex = EXERCISE_BY_SLUG[slug];
  if (!ex) return {};
  return {
    title: ex.title,
    description: ex.statement,
    openGraph: { title: ex.title, description: ex.statement },
    alternates: { canonical: `/exercise/${ex.slug}/` },
  };
}

export default async function ExercisePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const ex = EXERCISE_BY_SLUG[slug];
  if (!ex) notFound();

  return (
    <div className={page.scroll}>
      <article className={`${page.column} ${page.wide}`}>
        <div className={page.kicker}>exercise</div>
        <h1 className={page.title}>{ex.title}</h1>
        <p className={styles.statement}>{ex.statement}</p>

        <div className={styles.constraints}>
          <div className={styles.constraintsLabel}>constraints and assumptions</div>
          <ul className={styles.constraintsGrid}>
            {ex.constraints.map((c) => (
              <li key={c} className={styles.constraint}>
                <span className={styles.bullet} aria-hidden="true">
                  ·
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        <ExerciseSteps steps={ex.steps} />

        <div className={page.sourceStrip}>
          <span className={page.sourceKey}>source</span>
          <span className={page.sourceVal}>
            {SOURCE.repo} / {ex.file}
          </span>
          <span className={page.sourceKey}>synced</span>
          <span className={page.sourceVal}>
            {SYNC_OK ? `${SYNCED_LABEL} · ${SYNC_META.syncedAt.slice(0, 10)}` : SYNCED_LABEL}
          </span>
        </div>

        <div className={page.footerRow}>
          <a
            className={page.quietLink}
            href={ex.link}
            target="_blank"
            rel="noreferrer noopener"
          >
            full solution in the primer ↗
          </a>
        </div>
      </article>
    </div>
  );
}
