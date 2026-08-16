import styles from "./Widgets.module.css";
import page from "./Page.module.css";
import { LATENCIES } from "@/content/authored/latencies.mjs";

/**
 * Authored widget for the latency numbers section.
 *
 * The bars are log-scaled, which is the only way 0.5ns and 150ms fit on one
 * axis. That compression is itself the lesson: each row is roughly ten times
 * the one above it, so the chart reads as a ladder rather than as one bar and
 * twelve slivers.
 */
export function LatencyChart() {
  const maxLog = Math.log10(LATENCIES[LATENCIES.length - 1].ns + 1);

  return (
    <div className={page.widget}>
      <div className={page.widgetLabel}>orders of magnitude — log scale</div>
      <div className={styles.chart}>
        {LATENCIES.map((l: { label: string; ns: number; value: string }) => (
          <div key={l.label} className={styles.chartRow}>
            <div className={styles.chartLabel}>{l.label}</div>
            <div className={styles.chartTrack}>
              <div
                className={styles.chartBar}
                style={{ width: `${Math.max(2, (Math.log10(l.ns + 1) / maxLog) * 100).toFixed(1)}%` }}
              />
            </div>
            <div className={styles.chartValue}>{l.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
