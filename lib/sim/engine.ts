// Imported from the authored module directly, not from @/content — that
// barrel pulls in every section body and would land the whole corpus in the
// simulation page's bundle.
import { COSTS, HOP_MS, PX_PER_MS } from "@/content/authored/levels.mjs";
import type { Build, Level, Stats } from "@/lib/types";

/**
 * The packet-flow simulation.
 *
 * Everything here is plain mutable state driven by requestAnimationFrame.
 * Packets deliberately never enter React state, because a few hundred objects
 * re-rendering per frame will not hold 60fps. React hears from this class 8
 * times a second, via the metrics callback, and never more often than that.
 *
 * It is a teaching model, not a benchmark: service times and capacities are
 * chosen so the intended lesson is the thing that makes the objective
 * reachable.
 */

export type NodeKind = "lb" | "app" | "cache" | "queue" | "db";

export type SimNode = {
  kind: NodeKind;
  label: string;
  cap: number;
  svc: number;
  hit?: number;
  w: number;
  h: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
  inFlight: number;
  queue: number;
  qcap: number;
  alive: boolean;
  stage: number;
};

type ReqState = "transit" | "service" | "queued" | "exiting" | "done" | "error";

type Req = {
  x: number;
  y: number;
  stage: number;
  node: SimNode | null;
  qNode?: SimNode | null;
  st: ReqState;
  lat: number;
  write: boolean;
  svcLeft: number;
  fade: number;
};

export type Verdict = {
  passed: boolean;
  reason: "budget" | "errors" | "latency" | null;
  text: string;
  stats: Stats;
  spend: number;
};

type Colors = Record<string, string>;

export class SimEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private w = 800;
  private h = 400;

  private stages: SimNode[][] = [];
  private nodes: SimNode[] = [];
  private reqs: Req[] = [];
  private rr = new WeakMap<object, number>();

  private elapsed = 0;
  private spawnAcc = 0;
  private metricAcc = 0;
  private lats: number[] = [];
  private killed = false;
  private done = 0;
  private err = 0;

  private srcX = 62;
  private exitX = 760;
  private colors: Colors = {};

  private raf: number | null = null;
  private lastT = 0;
  private running = false;

  constructor(
    private level: Level,
    private build: Build,
    private onMetrics: (stats: Stats) => void,
    private onFinish: (verdict: Verdict) => void
  ) {}

  /* --- lifecycle --------------------------------------------------------- */

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resize();
    this.reset();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  detach() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.canvas = null;
    this.ctx = null;
  }

  setLevel(level: Level, build: Build) {
    this.level = level;
    this.build = build;
    this.reset();
  }

  setBuild(build: Build) {
    this.build = build;
    this.reset();
  }

  start() {
    this.running = true;
    this.lastT = 0;
  }

  pause() {
    this.running = false;
  }

  get isRunning() {
    return this.running;
  }

  reset() {
    this.reqs = [];
    this.elapsed = 0;
    this.spawnAcc = 0;
    this.metricAcc = 0;
    this.lats = [];
    this.killed = false;
    this.done = 0;
    this.err = 0;
    this.running = false;
    this.buildTopology();
    this.onMetrics(this.emptyStats());
  }

  private emptyStats(): Stats {
    return { done: 0, err: 0, errRate: 0, p99: 0, inflight: 0, rps: this.level.rate };
  }

  private loop(now: number) {
    const dt = Math.min(48, now - (this.lastT || now));
    this.lastT = now;
    if (this.running) this.step(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  }

  /* --- geometry ---------------------------------------------------------- */

  resize() {
    const c = this.canvas;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = Math.max(320, r.width);
    this.h = Math.max(240, r.height);
    c.width = this.w * dpr;
    c.height = this.h * dpr;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.buildTopology();
  }

  buildTopology() {
    const L = this.level;
    const b = this.build;
    const stages: SimNode[][] = [];

    const mk = (kind: NodeKind, label: string, cap: number, svc: number, hit?: number): SimNode => ({
      kind, label, cap, svc, hit,
      w: 0, h: 0, x: 0, y: 0, cx: 0, cy: 0,
      inFlight: 0, queue: 0, qcap: 14, alive: true, stage: 0,
    });

    if (b.lb) stages.push([mk("lb", "balancer", 400, 3)]);

    const app: SimNode[] = [];
    for (let i = 0; i < b.servers; i++) {
      app.push(mk("app", `server ${i + 1}`, L.appCap, L.appSvc));
    }
    stages.push(app);

    if (b.cache) stages.push([mk("cache", "cache", 500, 3, 0.86)]);
    if (b.queue) stages.push([mk("queue", "queue", 600, 6)]);
    stages.push([mk("db", "database", L.dbCap, L.dbSvc)]);

    const w = this.w;
    const h = this.h;
    const n = stages.length;
    const left = 132;
    const right = w - 108;
    const span = n > 1 ? (right - left) / (n - 1) : 0;
    const nw = Math.min(128, Math.max(88, span - 28));

    stages.forEach((stage, si) => {
      const cx = n > 1 ? left + si * span : (left + right) / 2;
      const nh = 46;
      const gap = 12;
      const totalH = stage.length * nh + (stage.length - 1) * gap;
      stage.forEach((node, ni) => {
        node.w = nw;
        node.h = nh;
        node.x = cx - nw / 2;
        node.y = h / 2 - totalH / 2 + ni * (nh + gap);
        node.cx = node.x + nw / 2;
        node.cy = node.y + nh / 2;
        node.stage = si;
      });
    });

    this.stages = stages;
    this.nodes = stages.flat();
    this.exitX = w - 34;
    this.srcX = 62;
  }

  /* --- simulation -------------------------------------------------------- */

  spend(): number {
    const b = this.build;
    return (
      b.servers * COSTS.server +
      (b.lb ? COSTS.lb : 0) +
      (b.cache ? COSTS.cache : 0) +
      (b.queue ? COSTS.queue : 0)
    );
  }

  private spawn() {
    const isWrite = Math.random() * 100 < (this.level.writeShare || 0);
    this.reqs.push({
      x: this.srcX,
      y: this.h / 2 + (Math.random() * 30 - 15),
      stage: -1,
      node: null,
      st: "transit",
      lat: 0,
      write: isWrite,
      svcLeft: 0,
      fade: 1,
    });
  }

  private pickNode(stageIdx: number): SimNode | null {
    const stage = this.stages[stageIdx];
    if (!stage) return null;
    const alive = stage.filter((n) => n.alive);
    if (!alive.length) return null;
    // Without a balancer, everything piles onto the first box. That is the
    // entire lesson of level 01: extra servers sit idle until something routes.
    if (stage[0].kind === "app" && !this.build.lb) return alive[0];
    const next = ((this.rr.get(stage) ?? 0) + 1) % alive.length;
    this.rr.set(stage, next);
    return alive[next];
  }

  private advance(req: Req) {
    let next = req.stage + 1;
    while (next < this.stages.length) {
      const kind = this.stages[next][0].kind;
      if (kind === "queue" && !req.write) { next++; continue; }
      if (kind === "db" && req.write && this.build.queue) { next++; continue; }
      if (kind === "cache" && req.write) { next++; continue; }
      break;
    }
    req.lat += HOP_MS;
    if (next >= this.stages.length) {
      req.st = "exiting";
      req.node = null;
      return;
    }
    const node = this.pickNode(next);
    if (!node) {
      this.fail(req);
      return;
    }
    req.stage = next;
    req.node = node;
    req.st = "transit";
  }

  private fail(req: Req) {
    req.st = "error";
    req.fade = 1;
    this.err++;
  }

  private step(dt: number) {
    const L = this.level;
    this.elapsed += dt;
    this.spawnAcc += (dt / 1000) * L.rate;
    while (this.spawnAcc >= 1 && this.reqs.length < 700) {
      this.spawn();
      this.spawnAcc -= 1;
    }

    // The chaos event: a host dies and takes its in-flight work with it.
    if (L.chaos && !this.killed && this.elapsed >= L.chaos.at) {
      this.killed = true;
      const appStage = this.stages.find((s) => s[0].kind === "app");
      const alive = appStage?.filter((n) => n.alive) ?? [];
      if (alive.length) {
        const victim = alive[0];
        victim.alive = false;
        victim.inFlight = 0;
        victim.queue = 0;
        for (const r of this.reqs) {
          if (r.node === victim && r.st !== "exiting") this.fail(r);
        }
      }
    }

    const speed = PX_PER_MS;
    for (const req of this.reqs) {
      if (req.st === "error") {
        req.fade -= dt / 700;
        req.y -= dt * 0.02;
        continue;
      }
      if (req.st === "done") continue;
      if (req.st === "service" || req.st === "queued") req.lat += dt;

      if (req.st === "exiting") {
        req.x += dt * speed;
        if (req.x >= this.exitX) {
          req.st = "done";
          this.done++;
          this.lats.push(req.lat);
        }
        continue;
      }

      if (req.st === "service") {
        req.svcLeft -= dt;
        if (req.svcLeft <= 0) {
          const n = req.node!;
          n.inFlight--;
          // A cache hit never reaches the database; that is the point of it.
          if (n.kind === "cache" && Math.random() < (n.hit ?? 0)) {
            req.st = "exiting";
            req.node = null;
            continue;
          }
          // Publishing to the queue acknowledges the user immediately.
          if (n.kind === "queue") {
            req.st = "exiting";
            req.node = null;
            continue;
          }
          this.advance(req);
        }
        continue;
      }

      if (req.st === "transit") {
        if (req.stage === -1) {
          this.advance(req);
          continue;
        }
        const n = req.node;
        if (!n || !n.alive) {
          this.fail(req);
          continue;
        }
        const dx = n.cx - req.x;
        const dy = n.cy - req.y;
        const d = Math.hypot(dx, dy);
        const stepPx = dt * speed;
        if (d <= stepPx || d < 4) {
          req.x = n.cx;
          req.y = n.cy;
          if (n.inFlight < n.cap) {
            n.inFlight++;
            req.st = "service";
            req.svcLeft = this.serviceTime(n, req);
          } else if (n.queue < n.qcap) {
            n.queue++;
            req.st = "queued";
            req.qNode = n;
          } else {
            this.fail(req);
          }
        } else {
          req.x += (dx / d) * stepPx;
          req.y += (dy / d) * stepPx;
        }
        continue;
      }

      if (req.st === "queued") {
        const n = req.qNode!;
        if (!n.alive) {
          this.fail(req);
          continue;
        }
        if (n.inFlight < n.cap) {
          n.inFlight++;
          n.queue = Math.max(0, n.queue - 1);
          req.st = "service";
          req.node = n;
          req.svcLeft = this.serviceTime(n, req);
        }
      }
    }

    this.reqs = this.reqs.filter(
      (r) => !(r.st === "done" || (r.st === "error" && r.fade <= 0))
    );

    // React hears about this roughly 8 times a second, not 60.
    this.metricAcc += dt;
    if (this.metricAcc >= 120) {
      this.metricAcc = 0;
      this.onMetrics(this.currentStats());
    }

    if (this.elapsed >= L.duration * 1000) this.finish();
  }

  /** A slow inline write holds an app slot for its whole duration. */
  private serviceTime(node: SimNode, req: Req): number {
    if (node.kind === "app" && req.write && this.level.slowWrite && !this.build.queue) {
      return this.level.slowWrite;
    }
    return node.svc;
  }

  private percentile99(): number {
    if (!this.lats.length) return 0;
    const sorted = [...this.lats].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
  }

  private currentStats(): Stats {
    const total = this.done + this.err;
    return {
      done: this.done,
      err: this.err,
      errRate: total ? (this.err / total) * 100 : 0,
      p99: this.percentile99(),
      inflight: this.reqs.filter((r) => r.st !== "error").length,
      rps: this.level.rate,
    };
  }

  private finish() {
    this.running = false;
    const L = this.level;
    const total = this.done + this.err;
    const errRate = total ? (this.err / total) * 100 : 100;
    const p99 = this.lats.length ? this.percentile99() : 9999;
    const spend = this.spend();

    const stats: Stats = {
      done: this.done,
      err: this.err,
      errRate,
      p99,
      inflight: 0,
      rps: L.rate,
    };

    const passed = errRate <= L.goal.maxErr && p99 <= L.goal.maxP99 && spend <= L.budget;

    // Order matters: each failure gets its own sentence naming the real number,
    // and budget is checked first because it invalidates the run outright.
    let reason: Verdict["reason"] = null;
    let text: string;
    if (passed) {
      text = `Held at ${errRate.toFixed(1)}% errors and a p99 of ${Math.round(p99)}ms, for $${spend} of the $${L.budget} budget.`;
    } else if (spend > L.budget) {
      reason = "budget";
      text = `Over budget at $${spend}. Capacity solves most things; the exercise is solving it for less.`;
    } else if (errRate > L.goal.maxErr) {
      reason = "errors";
      text = `${errRate.toFixed(1)}% of requests were dropped — the bottleneck filled its queue and started refusing work. Read the meters: whichever node sat at full capacity is the one to fix.`;
    } else {
      reason = "latency";
      text = `p99 landed at ${Math.round(p99)}ms against a ${L.goal.maxP99}ms budget. Nothing failed; things merely waited. Find what they were waiting on.`;
    }

    this.onMetrics(stats);
    this.onFinish({ passed, reason, text, stats, spend });
  }

  /* --- drawing ----------------------------------------------------------- */

  /**
   * Canvas font strings cannot resolve CSS custom properties, so the mono stack
   * is read out of the cascade once per frame alongside the colours. Without
   * this the labels silently render in the browser default instead of the
   * interface font.
   */
  private fontStack = "ui-monospace, monospace";

  readColors() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n: string) => cs.getPropertyValue(n).trim();
    this.colors = {
      line: g("--line"), dim: g("--dim"), fg: g("--fg"), muted: g("--muted"),
      accent: g("--accent"), accentBg: g("--accent-bg"), panel: g("--panel"),
      panel2: g("--panel2"), warn: g("--warn"), bad: g("--bad"),
    };
    const mono = g("--font-mono");
    this.fontStack = mono ? `${mono}, ui-monospace, monospace` : "ui-monospace, monospace";
  }

  private font(spec: string) {
    return `${spec} ${this.fontStack}`;
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.readColors();
    const C = this.colors;
    const { w, h } = this;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.font = this.font("500 10px");

    // Client edge.
    ctx.beginPath();
    ctx.moveTo(this.srcX, 24);
    ctx.lineTo(this.srcX, h - 24);
    ctx.stroke();
    ctx.fillStyle = C.dim;
    ctx.save();
    ctx.translate(this.srcX - 10, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText(`CLIENTS ${this.level.rate}/S`, 0, 0);
    ctx.restore();

    // Served edge.
    ctx.beginPath();
    ctx.setLineDash([2, 4]);
    ctx.moveTo(this.exitX, 24);
    ctx.lineTo(this.exitX, h - 24);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(this.exitX + 12, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = C.dim;
    ctx.fillText("SERVED", 0, 0);
    ctx.restore();

    // Edges between stages.
    for (let si = 0; si < this.stages.length - 1; si++) {
      for (const a of this.stages[si]) {
        for (const b of this.stages[si + 1]) {
          ctx.strokeStyle = C.line;
          ctx.beginPath();
          ctx.moveTo(a.x + a.w, a.cy);
          ctx.lineTo(b.x, b.cy);
          ctx.stroke();
        }
      }
    }

    // Nodes, with utilisation under each.
    for (const n of this.nodes) {
      const load = n.cap ? Math.min(1, n.inFlight / n.cap) : 0;
      const hot = n.queue > 0;

      ctx.fillStyle = C.panel2;
      ctx.fillRect(n.x, n.y, n.w, n.h);
      ctx.strokeStyle = !n.alive ? C.bad : hot ? C.warn : C.line;
      if (!n.alive) ctx.setLineDash([3, 3]);
      ctx.strokeRect(n.x + 0.5, n.y + 0.5, n.w - 1, n.h - 1);
      ctx.setLineDash([]);

      ctx.fillStyle = !n.alive ? C.bad : C.fg;
      ctx.textAlign = "left";
      ctx.font = this.font("500 10.5px");
      ctx.fillText(!n.alive ? "DOWN" : n.label, n.x + 10, n.y + 18);

      ctx.font = this.font("400 9px");
      ctx.fillStyle = C.dim;
      ctx.fillText(
        n.alive ? `${n.inFlight}/${n.cap}${n.queue ? `  q${n.queue}` : ""}` : "",
        n.x + 10,
        n.y + 32
      );

      ctx.fillStyle = C.line;
      ctx.fillRect(n.x + 10, n.y + n.h - 10, n.w - 20, 3);
      ctx.fillStyle = hot ? C.warn : C.accent;
      if (n.alive) ctx.fillRect(n.x + 10, n.y + n.h - 10, (n.w - 20) * load, 3);
    }

    // Packets: green reads, amber writes, red drops fading out.
    for (const r of this.reqs) {
      if (r.st === "error") {
        ctx.globalAlpha = Math.max(0, r.fade);
        ctx.fillStyle = C.bad;
        ctx.fillRect(r.x - 2, r.y - 2, 4, 4);
        ctx.globalAlpha = 1;
        continue;
      }
      if (r.st === "service" || r.st === "queued") continue;
      ctx.fillStyle = r.write ? C.warn : C.accent;
      ctx.fillRect(r.x - 1.5, r.y - 1.5, 3, 3);
    }

    ctx.font = this.font("400 9px");
    ctx.fillStyle = C.dim;
    ctx.textAlign = "right";
    const clock = this.running || this.elapsed > 0
      ? `${(this.elapsed / 1000).toFixed(1)}s / ${this.level.duration}s`
      : "READY";
    ctx.fillText(clock, w - 14, 20);
  }

  /**
   * Runs a whole simulation with no canvas and no rAF, at a fixed timestep.
   *
   * This is how the levels stay tuned. Each one has to fail with the starting
   * build and pass with the intended one, and that is a property of the
   * numbers in levels.mjs, not of the UI — so it is checked without one.
   * See scripts/verify-levels.mjs.
   */
  runHeadless(stepMs = 16): Verdict {
    let result: Verdict | null = null;
    const finish = this.onFinish;
    this.onFinish = (v) => {
      result = v;
    };

    this.w = 900;
    this.h = 460;
    this.reset();
    this.running = true;

    const maxFrames = Math.ceil((this.level.duration * 1000) / stepMs) + 10;
    for (let i = 0; i < maxFrames && !result; i++) this.step(stepMs);

    this.onFinish = finish;
    if (!result) throw new Error("simulation did not finish within its horizon");
    return result;
  }

  /**
   * A text description of the current topology, for the canvas's accessible
   * fallback. A canvas is otherwise a blank to a screen reader.
   */
  describe(): string {
    const stageNames = this.stages.map((stage) => {
      if (stage.length === 1) return stage[0].alive ? stage[0].label : `${stage[0].label} (down)`;
      return `${stage.length} ${stage[0].kind} nodes`;
    });
    return `Traffic at ${this.level.rate} requests per second flows through: ${stageNames.join(" → ")}.`;
  }
}
