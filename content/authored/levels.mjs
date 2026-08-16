/**
 * The 4 simulations. Entirely authored — the sync never touches this file.
 *
 * The numbers are a teaching model, not a benchmark. They are tuned so that the
 * intended part makes the objective reachable and nothing else does:
 *   01 more servers do nothing until a balancer sits in front of them
 *   02 N servers sized for peak means N-1 is not enough
 *   03 the bottleneck is downstream, so only a cache moves the tail
 *   04 inline slow writes hold a server slot; only a queue frees it
 */
export const COSTS = { server: 100, lb: 80, cache: 130, queue: 110 };
export const HOP_MS = 4;
export const PX_PER_MS = 0.95;

export const LEVELS = [
  {
    slug: "one-box",
    title: "one box, too much traffic",
    brief:
      "A single application server behind no load balancer. Traffic has outgrown it and requests are being dropped. Add capacity — but a second server does nothing until something in front of it decides where requests go.",
    rate: 48,
    appCap: 4,
    appSvc: 100,
    dbCap: 40,
    dbSvc: 18,
    writeShare: 0,
    tools: ["server", "lb"],
    budget: 400,
    duration: 16,
    goal: { maxErr: 2, maxP99: 400 },
    debrief:
      "Scaling out only works with something distributing the load. Commodity boxes behind a balancer beat one expensive box: cheaper per unit of work, and no longer a single point of failure. The cost is statelessness — sessions can no longer live on the server.",
    ref: "lb",
  },
  {
    slug: "host-dies",
    title: "a host dies mid-shift",
    brief:
      "Same traffic, but at six seconds one of your servers goes down and takes its in-flight requests with it. Survive the failure inside the error budget. N servers sized exactly for peak means N-1 is not enough.",
    rate: 48,
    appCap: 4,
    appSvc: 100,
    dbCap: 40,
    dbSvc: 18,
    writeShare: 0,
    tools: ["server", "lb"],
    budget: 500,
    duration: 16,
    goal: { maxErr: 6, maxP99: 450 },
    chaos: { at: 6000 },
    debrief:
      "Availability comes from redundancy plus something that notices. The balancer stops routing to the unhealthy host, so spare capacity absorbs the loss — which means you must buy capacity you don't use at peak. In sequence, components multiply their failure rates; in parallel, they cover for each other.",
    ref: "availability",
  },
  {
    slug: "read-storm",
    title: "read storm",
    brief:
      "Traffic is 95% reads, and every one of them reaches a database that serves eight at a time and takes 70ms each. More servers won't help — the bottleneck is downstream. Get the tail latency down.",
    rate: 46,
    appCap: 14,
    appSvc: 30,
    dbCap: 3,
    dbSvc: 70,
    writeShare: 5,
    tools: ["server", "lb", "cache"],
    budget: 460,
    duration: 16,
    goal: { maxErr: 3, maxP99: 260 },
    debrief:
      "Popular items skew load onto a few partitions; a cache in front absorbs the spike and most reads never reach disk. You have bought speed with staleness — a write now has to invalidate or update the cache, and cache invalidation is the hard part.",
    ref: "cache",
  },
  {
    slug: "writes-that-block",
    title: "writes that block",
    brief:
      "A third of requests are writes that take 420ms of inline work — thumbnailing, indexing, mailing. They hold a server slot the whole time and drag the tail out for everyone, including readers. Nobody is waiting on the result.",
    rate: 40,
    appCap: 14,
    appSvc: 30,
    dbCap: 20,
    dbSvc: 40,
    writeShare: 33,
    slowWrite: 420,
    tools: ["server", "lb", "cache", "queue"],
    budget: 460,
    duration: 16,
    goal: { maxErr: 3, maxP99: 300 },
    debrief:
      "Publish the job, acknowledge the user, let a worker do the work. Request time collapses because the expensive part left the request path. The costs are real: the user now sees an optimistic result, and if the queue grows past memory you need back pressure — reject with a 503 rather than melt down.",
    ref: "async",
  },
];

export const TOOL_META = {
  server: {
    name: "app server",
    hint: "One more box running your code. Stateless, or horizontal scaling breaks.",
  },
  lb: {
    name: "load balancer",
    hint: "Distributes requests across healthy servers. Without it, extra servers idle.",
  },
  cache: {
    name: "cache layer",
    hint: "Serves hot reads from memory before they reach the database.",
  },
  queue: {
    name: "queue + workers",
    hint: "Acknowledge the write, do the slow work in the background.",
  },
};

export const LEVEL_BY_SLUG = Object.fromEntries(LEVELS.map((l, i) => [l.slug, { ...l, index: i }]));

/** First simulation that teaches each reference section, for the cross-links. */
export const SIM_OF_SECTION = LEVELS.reduce((acc, l, i) => {
  if (acc[l.ref] === undefined) acc[l.ref] = i;
  return acc;
}, /** @type {Record<string, number>} */ ({}));
