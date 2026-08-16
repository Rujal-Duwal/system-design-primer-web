"use client";

import Link from "next/link";
import { useState } from "react";

import styles from "./Exercise.module.css";
import page from "./Page.module.css";
import { Blocks } from "./Blocks";
import { NAV_BY_KEY } from "@/content/nav";
import type { ExerciseStep } from "@/lib/types";

/**
 * The four steps as progressive reveals.
 *
 * Step 1 is open and the rest are closed, so a reader can attempt the problem
 * before reading the answer — the whole reason the primer frames these as an
 * exercise rather than a worked example.
 *
 * Each step shows our summary first, then the primer's own text for that step.
 */
export function ExerciseSteps({ steps }: { steps: ExerciseStep[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const allOpen = steps.every((_, i) => open[i]);

  return (
    <>
      <div className={styles.rule}>
        <span className={page.sectionRuleLabel}>work it in four steps</span>
        <button
          type="button"
          className={styles.toggleAll}
          onClick={() =>
            setOpen(allOpen ? {} : Object.fromEntries(steps.map((_, i) => [i, true])))
          }
        >
          {allOpen ? "collapse all" : "expand all"}
        </button>
      </div>

      <div className={styles.steps}>
        {steps.map((step, i) => {
          const isOpen = !!open[i];
          return (
            <div key={i} className={styles.step}>
              <button
                type="button"
                className={`${styles.stepHead} ${isOpen ? styles.stepHeadOpen : ""}`}
                onClick={() => setOpen((prev) => ({ ...prev, [i]: !prev[i] }))}
                aria-expanded={isOpen}
                aria-controls={`step-${i}`}
              >
                <span className={styles.stepLeft}>
                  <span className={styles.stepNum}>{String(i + 1).padStart(2, "0")}</span>
                  <span>{step.label}</span>
                </span>
                <span className={isOpen ? styles.markOpen : styles.markClosed}>
                  {isOpen ? "hide" : "show"}
                </span>
              </button>

              {isOpen && (
                <div className={styles.stepBody} id={`step-${i}`}>
                  <div className={styles.stepSummary}>
                    <div className={page.summaryLabel}>in short</div>
                    {step.lede.map((p, j) => (
                      <p key={j} className={styles.stepLede}>
                        {p}
                      </p>
                    ))}
                    {step.refs.length > 0 && (
                      <div className={styles.chips}>
                        {step.refs
                          .filter((k) => NAV_BY_KEY[k])
                          .map((k) => (
                            <Link
                              key={k}
                              className={styles.chip}
                              href={`/reference/${NAV_BY_KEY[k].slug}/`}
                            >
                              read: {NAV_BY_KEY[k].title}
                            </Link>
                          ))}
                      </div>
                    )}
                  </div>

                  {step.body.length > 0 && (
                    <>
                      <div className={styles.stepRule}>
                        <span className={page.sectionRuleLabel}>
                          from the primer — {step.upstreamTitle.toLowerCase()}
                        </span>
                      </div>
                      <Blocks blocks={step.body} />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
