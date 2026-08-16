/** Shapes emitted by scripts/sync.mjs and consumed by the renderer. */

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "br" }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "del"; c: Inline[] }
  | { t: "link"; href: string; internal?: boolean; c: Inline[] }
  | { t: "img"; src: string; alt: string };

export type ListItem = { inline: Inline[]; children: Block[] };

export type Block =
  | { kind: "h"; depth: number; text: string; anchor: string }
  | { kind: "p"; inline: Inline[] }
  | { kind: "ul"; start?: number; items: ListItem[] }
  | { kind: "ol"; start?: number; items: ListItem[] }
  | { kind: "code"; text: string; lang: string | null }
  | { kind: "img"; src: string; alt: string; caption: string; captionHref: string | null }
  | { kind: "table"; align: (string | null)[]; head: Inline[][]; rows: Inline[][][] }
  | { kind: "quote"; blocks: Block[] }
  | { kind: "hr" };

export type SummaryRow = { k: string; v: string };

export type ReferenceSection = {
  key: string;
  slug: string;
  title: string;
  anchor: string;
  group: string;
  lede: string;
  rows: SummaryRow[];
  calc: boolean;
  latency: boolean;
  link: string;
  body: Block[];
};

export type ExerciseStep = {
  label: string;
  refs: string[];
  lede: string[];
  upstreamTitle: string;
  body: Block[];
};

export type Exercise = {
  key: string;
  slug: string;
  title: string;
  statement: string;
  constraints: string[];
  file: string;
  link: string;
  steps: ExerciseStep[];
};

export type SearchDoc = {
  id: string;
  view: "reference" | "exercise";
  slug: string;
  title: string;
  kind: string;
  snippet: string;
  text: string;
};

export type SyncMeta = {
  syncedAt: string;
  repo: string;
  branch: string;
  licence: string;
  sections: number;
  exercises: number;
  images: number;
  problems: string[];
  unresolvedAnchors: string[];
};

/* Authored shapes -------------------------------------------------------- */

export type Level = {
  slug: string;
  title: string;
  brief: string;
  rate: number;
  appCap: number;
  appSvc: number;
  dbCap: number;
  dbSvc: number;
  writeShare: number;
  slowWrite?: number;
  tools: ToolKey[];
  budget: number;
  duration: number;
  goal: { maxErr: number; maxP99: number; maxStale?: number };
  /** `kill` drops one app host. `partition` splits the data tier in two. */
  chaos?: { at: number; kind?: "kill" | "partition" };
  /** Data tier is sharded, and keys land on it unevenly until you fix that. */
  shards?: { count: number; skew: number };
  /** Data tier is replicated, and the reader picks how it behaves split-brain. */
  replicated?: boolean;
  debrief: string;
  ref: string;
};

export type ToolKey = "server" | "lb" | "cache" | "queue" | "shard" | "hashing" | "replica";

/** Which side of the CAP trade the reader has chosen. */
export type ConsistencyMode = "cp" | "ap";

export type Build = {
  servers: number;
  lb: boolean;
  cache: boolean;
  queue: boolean;
  shards: number;
  hashing: boolean;
  replicas: number;
  mode: ConsistencyMode;
};

export type RunState = "idle" | "running" | "paused" | "passed" | "failed";

export type Stats = {
  done: number;
  err: number;
  errRate: number;
  p99: number;
  inflight: number;
  rps: number;
  /** Reads served from a partitioned replica that may be behind. */
  stale: number;
};
