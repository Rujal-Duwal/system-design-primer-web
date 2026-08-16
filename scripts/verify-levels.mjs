#!/usr/bin/env node
/**
 * Level tuning check.
 *
 * Every simulation has to teach one thing, which means two properties must
 * hold: the starting build FAILS, and the intended build PASSES. If a tweak to
 * a service time quietly makes level 01 winnable by buying servers alone, the
 * level stops teaching that a balancer is what makes scaling out work — and
 * nothing in the UI would tell you.
 *
 * The simulation has randomness in it (write mix, cache hits, arrival jitter),
 * so each case runs several times and the check is that the outcome is stable,
 * not that one run happened to go the right way.
 *
 *   node scripts/verify-levels.mjs
 */

import { LEVELS } from "../content/authored/levels.mjs";

const RUNS = 12;

// The engine is TypeScript and imports via the @/ alias, so rather than pull in
// a compiler this mirrors it through the same module the app builds from.
const { SimEngine } = await import("./sim-harness.mjs");

const CASES = [
  {
    level: 0,
    fail: { servers: 3, lb: false, cache: false, queue: false },
    pass: { servers: 3, lb: true, cache: false, queue: false },
    lesson: "servers alone do nothing; a balancer is what makes them work",
  },
  {
    // Each server clears 4 concurrent / 100ms = 40 rps against an arrival rate
    // of 48, so "sized exactly for peak" is two servers. The lesson is that
    // surviving a death needs a third one you do not use at peak.
    level: 1,
    fail: { servers: 2, lb: true, cache: false, queue: false },
    pass: { servers: 3, lb: true, cache: false, queue: false },
    lesson: "N sized for peak means N-1 is not enough when one dies",
  },
  {
    level: 2,
    fail: { servers: 3, lb: true, cache: false, queue: false },
    pass: { servers: 2, lb: true, cache: true, queue: false },
    lesson: "the bottleneck is downstream; only a cache moves the tail",
  },
  {
    level: 3,
    fail: { servers: 3, lb: true, cache: false, queue: false },
    pass: { servers: 2, lb: true, cache: false, queue: true },
    lesson: "inline slow writes hold a slot; a queue frees it",
  },
];

function run(levelIndex, build) {
  const level = LEVELS[levelIndex];
  const outcomes = [];
  for (let i = 0; i < RUNS; i++) {
    const engine = new SimEngine(level, build, () => {}, () => {});
    outcomes.push(engine.runHeadless());
  }
  const passes = outcomes.filter((o) => o.passed).length;
  const avg = (pick) => outcomes.reduce((n, o) => n + pick(o), 0) / outcomes.length;
  return {
    passes,
    runs: RUNS,
    errRate: avg((o) => o.stats.errRate),
    p99: avg((o) => o.stats.p99),
    spend: outcomes[0].spend,
    reasons: [...new Set(outcomes.map((o) => o.reason).filter(Boolean))],
  };
}

let failed = 0;
console.log(`level tuning — ${RUNS} runs per case\n`);

for (const c of CASES) {
  const level = LEVELS[c.level];
  const num = String(c.level + 1).padStart(2, "0");
  console.log(`${num}  ${level.title}`);
  console.log(`    goal: err <= ${level.goal.maxErr}%  p99 <= ${level.goal.maxP99}ms  spend <= $${level.budget}`);
  console.log(`    lesson: ${c.lesson}`);

  const bad = run(c.level, c.fail);
  const good = run(c.level, c.pass);

  const fmt = (r) =>
    `err ${r.errRate.toFixed(1)}%  p99 ${Math.round(r.p99)}ms  $${r.spend}` +
    (r.reasons.length ? `  (${r.reasons.join(", ")})` : "");

  const badOk = bad.passes === 0;
  const goodOk = good.passes === good.runs;

  console.log(`    ${badOk ? "ok  " : "FAIL"} without it: ${bad.passes}/${bad.runs} passed — ${fmt(bad)}`);
  console.log(`    ${goodOk ? "ok  " : "FAIL"} with it:    ${good.passes}/${good.runs} passed — ${fmt(good)}`);
  console.log("");

  if (!badOk) {
    failed++;
    console.error(`    ! level ${num} is winnable without the lesson — ${bad.passes}/${bad.runs} passed the wrong way\n`);
  }
  if (!goodOk) {
    failed++;
    console.error(`    ! level ${num} is not reliably winnable with the intended build — only ${good.passes}/${good.runs}\n`);
  }
}

if (failed) {
  console.error(`${failed} tuning problem(s). The levels no longer teach what they claim.`);
  process.exit(1);
}
console.log("all levels teach their lesson");
