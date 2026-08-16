"use client";

import { useState } from "react";

import styles from "./Widgets.module.css";
import page from "./Page.module.css";

/**
 * Authored widget for the availability patterns section.
 *
 * The primer states the two formulas and leaves the reader to do the
 * arithmetic. Doing it live is the point: two 99.9% components in sequence give
 * 99.8%, worse than either alone, and the same two in parallel give 99.9999%.
 * Seeing those two numbers swap places is more convincing than the formula.
 */
export function AvailabilityCalculator() {
  const [a, setA] = useState("99.9");
  const [b, setB] = useState("99.9");
  const [mode, setMode] = useState<"seq" | "par">("seq");

  const av = clamp(a);
  const bv = clamp(b);
  const total = mode === "seq" ? av * bv : 1 - (1 - av) * (1 - bv);
  const unavailable = 1 - total;
  const nines = unavailable > 0 ? Math.floor(-Math.log10(unavailable)) : 9;

  return (
    <div className={page.widget}>
      <div className={page.widgetLabel}>compose two components</div>

      <div className={styles.calcRow}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>foo %</span>
          <input
            type="number"
            step="0.001"
            min="0"
            max="100"
            className={styles.number}
            value={a}
            onChange={(e) => setA(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>bar %</span>
          <input
            type="number"
            step="0.001"
            min="0"
            max="100"
            className={styles.number}
            value={b}
            onChange={(e) => setB(e.target.value)}
          />
        </label>

        <div className={styles.tabs} role="group" aria-label="Composition mode">
          <button
            type="button"
            className={`${styles.tab} ${mode === "seq" ? styles.tabActive : ""}`}
            onClick={() => setMode("seq")}
            aria-pressed={mode === "seq"}
          >
            in sequence
          </button>
          <button
            type="button"
            className={`${styles.tab} ${mode === "par" ? styles.tabActive : ""}`}
            onClick={() => setMode("par")}
            aria-pressed={mode === "par"}
          >
            in parallel
          </button>
        </div>
      </div>

      <div className={styles.formula}>
        {mode === "seq"
          ? "Availability (Total) = Availability (Foo) * Availability (Bar)"
          : "Availability (Total) = 1 - (1 - Availability (Foo)) * (1 - Availability (Bar))"}
      </div>

      <div className={styles.calcOut}>
        <div>
          <div className={styles.outLabel}>total</div>
          <div className={styles.outBig} aria-live="polite">
            {formatPct(total)}
          </div>
          <div className={styles.outNote}>
            {nines >= 1 ? `${nines} ${nines === 1 ? "nine" : "nines"}` : "under one nine"}
          </div>
        </div>
        <div>
          <div className={styles.outLabel}>downtime</div>
          <div className={styles.downtime}>
            <div>
              year — <span className={styles.downValue}>{duration(unavailable * 365 * 24 * 3600)}</span>
            </div>
            <div>
              month — <span className={styles.downValue}>{duration(unavailable * 30 * 24 * 3600)}</span>
            </div>
            <div>
              day — <span className={styles.downValue}>{duration(unavailable * 24 * 3600)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function clamp(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n)) / 100;
}

function formatPct(total: number) {
  return `${(total * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function duration(seconds: number) {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || !parts.length) parts.push(`${s}s`);
  return parts.join(" ");
}
