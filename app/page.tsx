import Link from "next/link";

import styles from "./home.module.css";
import page from "@/components/Page.module.css";
import {
  EXERCISE_LIST,
  LEVEL_LIST,
  REFERENCE_LIST,
  SOURCE,
  SYNC_META,
  SYNC_OK,
} from "@/content";

export const metadata = {
  alternates: { canonical: "/" },
};

/**
 * The landing page.
 *
 * Opening straight into simulation 01 works when you already know what the site
 * is. A link posted on a GitHub issue lands on people cold, so this says what
 * the site is, what it is made of, and where the content comes from — then gets
 * out of the way.
 */
export default function Home() {
  return (
    <div className={page.scroll}>
      <div className={styles.home}>
        <div className={page.kicker}>the system design primer, made interactive</div>
        <h1 className={styles.title}>
          Read less. <span className={styles.accent}>Run it instead.</span>
        </h1>
        <p className={styles.intro}>
          The primer is one of the best pieces of writing on system design, and it is a
          40,000-word README. This is the same material as a site you can navigate: a
          simulator that makes the trade-offs behave, the reference split into sections
          you can link to, and the design problems as exercises you work rather than read.
        </p>

        <div className={styles.modes}>
          <section className={styles.mode}>
            <div className={styles.modeLabel}>simulations — {LEVEL_LIST.length}</div>
            <p className={styles.modeText}>
              You are given traffic, a broken topology, an objective and a budget. Buy
              parts, run the traffic, and find out which node pinned at capacity. The
              lesson is in the failure, not the diagram.
            </p>
            <ul className={styles.list}>
              {LEVEL_LIST.map((l, i) => (
                <li key={l.slug}>
                  <Link className={styles.itemLink} href={`/simulate/${l.slug}/`}>
                    <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
                    {l.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.mode}>
            <div className={styles.modeLabel}>reference — {REFERENCE_LIST.length}</div>
            <p className={styles.modeText}>
              Every section gets its own page and its own URL, with a summary written for
              this site on top and the primer&rsquo;s full text below it. Two sections carry
              calculators: availability composition, and the latency ladder.
            </p>
            <Link className={styles.cta} href="/reference/load-balancer/">
              start with the load balancer →
            </Link>
          </section>

          <section className={styles.mode}>
            <div className={styles.modeLabel}>exercises — {EXERCISE_LIST.length}</div>
            <p className={styles.modeText}>
              The primer&rsquo;s design problems, each with its constraints and the four-step
              method as progressive reveals. Step one is open; the rest stay shut so you can
              attempt it before reading the answer.
            </p>
            <Link className={styles.cta} href="/exercise/pastebin/">
              work through Pastebin →
            </Link>
          </section>
        </div>

        <div className={styles.provenance}>
          <div className={styles.provLabel}>where the words come from</div>
          <p className={styles.provText}>
            Section bodies are the primer&rsquo;s own markdown, fetched from{" "}
            <a href={SOURCE.url} target="_blank" rel="noreferrer noopener">
              {SOURCE.repo}
            </a>{" "}
            and rebuilt from source, so this site cannot drift from the repo it credits.
            Summaries, simulations and calculators are written for this site and are marked
            as such on every page. Content is {SOURCE.licence}.
          </p>
          <p className={styles.provMeta}>
            {SYNC_OK
              ? `${SYNC_META.sections} sections and ${SYNC_META.exercises} exercises synced from ${SYNC_META.branch} on ${SYNC_META.syncedAt.slice(0, 10)}.`
              : "Sync pending — bodies are authored copy for now."}
          </p>
        </div>

        <div className={styles.footer}>
          <Link className={styles.primary} href={`/simulate/${LEVEL_LIST[0].slug}/`}>
            start simulation 01 →
          </Link>
          <span className={styles.hintKey}>
            or press <kbd className={styles.kbd}>/</kbd> to search everything
          </span>
        </div>
      </div>
    </div>
  );
}
