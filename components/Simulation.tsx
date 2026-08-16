"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./Simulation.module.css";
import { useApp } from "./AppState";
import { SimEngine, type Verdict } from "@/lib/sim/engine";
import { COSTS, LEVELS, NAV_BY_KEY, TOOL_META } from "@/content/nav";
import type { Build, Level, Stats, ToolKey } from "@/lib/types";

const EMPTY: Stats = { done: 0, err: 0, errRate: 0, p99: 0, inflight: 0, rps: 0, stale: 0 };

export function Simulation({ level, index }: { level: Level; index: number }) {
  const { passed, markPassed, buildFor, setBuild, resetBuild, freshBuild } = useApp();
  const build = buildFor(index);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SimEngine | null>(null);
  const [stats, setStats] = useState<Stats>({ ...EMPTY, rps: level.rate });
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [running, setRunning] = useState(false);
  const [description, setDescription] = useState("");

  const handleFinish = useCallback(
    (v: Verdict) => {
      setVerdict(v);
      setRunning(false);
      if (v.passed) markPassed(index);
    },
    [index, markPassed]
  );

  // One engine per mounted simulation. The build it starts from comes from the
  // provider, so coming back from a reference page keeps what you bought.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new SimEngine(level, build, setStats, handleFinish);
    engineRef.current = engine;
    engine.attach(canvas);
    setDescription(engine.describe());

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engine.detach();
      engineRef.current = null;
    };
    // Rebuilt only when the level changes; build changes go through buy().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, handleFinish]);

  // Mirrors SimEngine.spend(): only the data tier the level uses is charged.
  const spend =
    build.servers * COSTS.server +
    (build.lb ? COSTS.lb : 0) +
    (build.cache ? COSTS.cache : 0) +
    (build.queue ? COSTS.queue : 0) +
    (level.shards ? build.shards * COSTS.shard + (build.hashing ? COSTS.hashing : 0) : 0) +
    (level.replicated ? build.replicas * COSTS.replica : 0);
  const overBudget = spend > level.budget;

  /** Parts you can own more than one of. */
  const countOf = (tool: ToolKey): number | null =>
    tool === "server" ? build.servers
      : tool === "shard" ? build.shards
      : tool === "replica" ? build.replicas
      : null;

  const apply = (next: Build) => {
    setBuild(index, next);
    // You cannot change the system mid-flight; any change resets the run.
    engineRef.current?.setBuild(next);
    setVerdict(null);
    setRunning(false);
    setDescription(engineRef.current?.describe() ?? "");
  };

  const buy = (tool: ToolKey) => {
    const next: Build = { ...build };
    if (tool === "server") next.servers += 1;
    else if (tool === "shard") next.shards += 1;
    else if (tool === "replica") next.replicas += 1;
    else next[tool] = true;
    apply(next);
  };

  const setMode = (mode: Build["mode"]) => apply({ ...build, mode });

  const toggleRun = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (running) {
      engine.pause();
      setRunning(false);
      return;
    }
    if (verdict) {
      engine.reset();
      setVerdict(null);
    }
    engine.start();
    setRunning(true);
  };

  const reset = () => {
    engineRef.current?.reset();
    setVerdict(null);
    setRunning(false);
  };

  const startOver = () => {
    resetBuild(index);
    engineRef.current?.setBuild(freshBuild);
    setVerdict(null);
    setRunning(false);
  };

  /** Anything bought or chosen beyond the level's starting point. */
  const hasBuilt =
    build.servers !== freshBuild.servers ||
    build.lb !== freshBuild.lb ||
    build.cache !== freshBuild.cache ||
    build.queue !== freshBuild.queue ||
    build.shards !== freshBuild.shards ||
    build.hashing !== freshBuild.hashing ||
    build.replicas !== freshBuild.replicas ||
    build.mode !== freshBuild.mode;

  const debriefRef = NAV_BY_KEY[level.ref];
  const nextLevel = index < (LEVELS as Level[]).length - 1 ? (LEVELS as Level[])[index + 1] : null;
  const hasPassed = !!passed[index];

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.kicker}>
            simulation {String(index + 1).padStart(2, "0")} — {level.title}
          </div>
          <p className={styles.brief}>{level.brief}</p>
        </div>
        <div className={styles.goal}>
          <div className={styles.goalLabel}>pass when</div>
          <div className={styles.goalText}>
            error rate ≤ {level.goal.maxErr}% · p99 ≤ {level.goal.maxP99}ms · spend ≤ $
            {level.budget}
            {level.goal.maxStale !== undefined && ` · stale reads ≤ ${level.goal.maxStale}`}
          </div>
        </div>
      </header>

      <p className={styles.narrowNote}>
        The simulation reads best on a wider screen — the topology is drawn left to right.
      </p>

      <div className={styles.grid}>
        <div className={styles.stage}>
          <div className={styles.canvasWrap}>
            <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={description} />
            <p className="sr-only" aria-live="polite">
              {running
                ? `Running. ${stats.done} served, ${stats.err} dropped, error rate ${stats.errRate.toFixed(1)}%, p99 ${Math.round(stats.p99)}ms${
                    level.goal.maxStale !== undefined ? `, ${stats.stale} stale reads` : ""
                  }.`
                : verdict
                  ? verdict.text
                  : "Ready to run."}
            </p>

            {verdict && (
              <div
                className={`${styles.verdict} ${verdict.passed ? styles.verdictPassed : styles.verdictFailed}`}
              >
                <div
                  className={`${styles.verdictCard} ${verdict.passed ? "" : styles.verdictCardFailed}`}
                >
                  <div
                    className={`${styles.verdictKicker} ${verdict.passed ? "" : styles.verdictKickerFailed}`}
                  >
                    {verdict.passed ? "objective met" : "objective missed"}
                  </div>
                  <p className={styles.verdictText}>{verdict.text}</p>
                  <div className={styles.verdictActions}>
                    <button type="button" className={styles.ghostButton} onClick={toggleRun}>
                      run again
                    </button>
                    {!verdict.passed && (
                      <button type="button" className={styles.ghostButton} onClick={startOver}>
                        start over
                      </button>
                    )}
                    {verdict.passed && nextLevel && (
                      <Link className={styles.primaryButton} href={`/simulate/${nextLevel.slug}/`}>
                        next simulation →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.meterBar}>
            <button type="button" className={styles.primaryButton} onClick={toggleRun}>
              {running ? "pause" : verdict ? "run again" : "run traffic"}
            </button>
            {/* Two different scopes, so they say which one they are. "reset
                run" clears the meters and keeps what you built; "start over"
                also refunds it. Without the second one here, the only way to
                undo a purchase was to fail and use the verdict card. */}
            <button type="button" className={styles.ghostButton} onClick={reset}>
              reset run
            </button>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={startOver}
              disabled={running || !hasBuilt}
              title={hasBuilt ? "Refund everything and start from the default system" : "Nothing bought yet"}
            >
              start over
            </button>
            <div className={styles.meters}>
              <Meter label="served" value={String(stats.done)} />
              <Meter label="dropped" value={String(stats.err)} bad={stats.err > 0} />
              <Meter
                label="error rate"
                value={`${stats.errRate.toFixed(1)}%`}
                bad={stats.errRate > level.goal.maxErr}
                good={stats.errRate <= level.goal.maxErr}
              />
              <Meter
                label="p99"
                value={`${Math.round(stats.p99)}ms`}
                bad={stats.p99 > level.goal.maxP99}
                good={stats.p99 <= level.goal.maxP99}
              />
              {level.goal.maxStale !== undefined && (
                <Meter
                  label="stale"
                  value={String(stats.stale)}
                  bad={stats.stale > level.goal.maxStale}
                  good={stats.stale <= level.goal.maxStale}
                />
              )}
              <Meter label="in flight" value={String(stats.inflight)} />
            </div>
          </div>
        </div>

        <div className={styles.palette}>
          {/* Consistency is not something you buy. It is a choice about what
              the system does when it cannot have everything, so it gets its
              own control above the parts list. */}
          {level.replicated && (
            <div className={styles.modeBlock}>
              <div className={styles.paletteLabel}>when the network splits</div>
              <div className={styles.modeTabs} role="group" aria-label="Consistency mode">
                <button
                  type="button"
                  className={`${styles.modeTab} ${build.mode === "cp" ? styles.modeTabActive : ""}`}
                  onClick={() => setMode("cp")}
                  aria-pressed={build.mode === "cp"}
                  disabled={running}
                >
                  stay consistent
                </button>
                <button
                  type="button"
                  className={`${styles.modeTab} ${build.mode === "ap" ? styles.modeTabActive : ""}`}
                  onClick={() => setMode("ap")}
                  aria-pressed={build.mode === "ap"}
                  disabled={running}
                >
                  stay available
                </button>
              </div>
              <p className={styles.modeHint}>
                {build.mode === "cp"
                  ? "CP — the cut-off side refuses to answer, so no read is ever out of date. Its share of the traffic lands on the majority, which needs the capacity to take it."
                  : "AP — every replica keeps answering, so nothing errors. But the cut-off side has stopped receiving writes, so some of what it returns is behind. Those count against the stale meter."}
              </p>
            </div>
          )}

          <div className={styles.paletteLabel}>build</div>
          {level.tools.map((tool) => {
            const count = countOf(tool);
            // Counted parts can always be bought again; switches only once.
            const already = count === null && !!build[tool as "lb" | "cache" | "queue" | "hashing"];
            const canAfford = spend + COSTS[tool] <= level.budget;
            const disabled = running || already || !canAfford;
            return (
              <button
                key={tool}
                type="button"
                className={`${styles.tool} ${already ? styles.toolOwned : ""} ${
                  disabled && !already ? styles.toolDisabled : ""
                }`}
                onClick={() => !disabled && buy(tool)}
                disabled={disabled}
              >
                <span className={styles.toolHead}>
                  <span
                    className={`${styles.toolName} ${already || (count ?? 0) > 1 ? styles.toolNameOwned : ""}`}
                  >
                    {TOOL_META[tool].name}
                  </span>
                  <span className={styles.toolCost}>${COSTS[tool]}</span>
                </span>
                <span className={styles.toolHint}>{TOOL_META[tool].hint}</span>
                <span className={styles.toolState}>
                  {count !== null
                    ? `${count} running`
                    : already
                      ? "installed"
                      : canAfford
                        ? "available"
                        : "over budget"}
                </span>
              </button>
            );
          })}

          <div className={styles.spend}>
            <div className={styles.spendHead}>
              <span className={styles.spendLabel}>spend</span>
              <span className={`${styles.spendValue} ${overBudget ? styles.spendOver : ""}`}>
                ${spend} / ${level.budget}
              </span>
            </div>
            <div className={styles.spendTrack}>
              <div
                className={`${styles.spendFill} ${overBudget ? styles.spendFillOver : ""}`}
                style={{ width: `${Math.min(100, (spend / level.budget) * 100).toFixed(0)}%` }}
              />
            </div>
            <p className={styles.spendNote}>
              Capacity is never free. Passing under budget is the whole exercise.
            </p>
          </div>

          {hasPassed && (
            <div className={styles.debrief}>
              <div className={styles.debriefLabel}>what you just proved</div>
              <p className={styles.debriefText}>{level.debrief}</p>
              {debriefRef && (
                <Link className={styles.debriefLink} href={`/reference/${debriefRef.slug}/`}>
                  read: {debriefRef.title} →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Meter({
  label,
  value,
  bad,
  good,
}: {
  label: string;
  value: string;
  bad?: boolean;
  good?: boolean;
}) {
  return (
    <div>
      <div className={styles.meterLabel}>{label}</div>
      <div
        className={`${styles.meterValue} ${bad ? styles.meterBad : good ? styles.meterGood : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
