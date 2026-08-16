/**
 * The 6 simulations. Entirely authored — the sync never touches this file.
 *
 * The numbers are a teaching model, not a benchmark. They are tuned so that the
 * intended part makes the objective reachable and nothing else does:
 *   01 more servers do nothing until a balancer sits in front of them
 *   02 N servers sized for peak means N-1 is not enough
 *   03 the bottleneck is downstream, so only a cache moves the tail
 *   04 inline slow writes hold a server slot; only a queue frees it
 *   05 more shards add capacity but do not move hot keys; hashing does
 *   06 under a partition you pick consistency or availability, and pay for it
 *
 * scripts/verify-levels.mjs asserts exactly that, so changing any number here
 * without running it can quietly turn a lesson into a formality.
 */
export const COSTS = {
  server: 100,
  lb: 80,
  cache: 130,
  queue: 110,
  shard: 60,
  hashing: 70,
  replica: 70,
};
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
  {
    slug: "hot-shard",
    title: "one shard takes the heat",
    brief:
      "The data is split across shards by key range, and most of the traffic wants keys that all live in the same range. One shard is pinned while its neighbours idle. Buying more shards divides the range further — it does not move the hot keys.",
    rate: 44,
    appCap: 16,
    appSvc: 25,
    // A shard clears about 30 req/s. Spread evenly across three that is
    // comfortable; concentrated on one it is not close to enough.
    dbCap: 3,
    dbSvc: 100,
    writeShare: 10,
    // 92% of requests want the hottest tenth of the keyspace, and under range
    // placement that whole tenth lives on the first shard.
    shards: { count: 2, skew: 92 },
    tools: ["shard", "hashing"],
    budget: 560,
    duration: 16,
    goal: { maxErr: 3, maxP99: 320 },
    debrief:
      "Adding shards buys capacity, not distribution. Range-based placement keeps hot keys together, so the busiest shard stays busiest no matter how many you run. Hashing the key scatters those rows across every shard, which is why consistent hashing is the standard answer — and why rebalancing without it is so painful. The cost is that range scans no longer live on one node.",
    ref: "db",
  },
  {
    slug: "cap-partition",
    title: "the network splits",
    brief:
      "A replicated store behind your servers, and at six seconds the network cuts it in two. Both halves are alive and healthy; neither can see the other. This is a payments ledger, so a read that is out of date is not an acceptable answer. Choose what the system does when it cannot have both.",
    rate: 38,
    appCap: 16,
    appSvc: 25,
    dbCap: 12,
    dbSvc: 30,
    writeShare: 20,
    replicated: true,
    chaos: { at: 6000, kind: "partition" },
    tools: ["replica"],
    budget: 560,
    duration: 16,
    // Stale reads are the disqualifier here, which forces the CP choice, and
    // then the majority has to be big enough to carry the whole load alone.
    goal: { maxErr: 8, maxP99: 400, maxStale: 0 },
    debrief:
      "Partition tolerance is not optional — networks fail whether or not you planned for it. So the real choice is the other two. Staying consistent means the cut-off side must stop answering, and everything it was serving lands on the majority; that capacity has to already exist. Staying available means every replica keeps answering and some answers are behind. Neither is wrong. A ledger picks CP; a view counter picks AP.",
    ref: "cap",
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
  shard: {
    name: "another shard",
    hint: "More capacity for the data tier. Splits the key range further; does not move the hot keys.",
  },
  hashing: {
    name: "consistent hashing",
    hint: "Place rows by a hash of the key instead of by range, so hot keys scatter across every shard.",
  },
  replica: {
    name: "another replica",
    hint: "One more copy of the data. Under a partition, the majority side carries everything.",
  },
};

/** The starting build for every level. */
export const FRESH_BUILD = {
  servers: 1,
  lb: false,
  cache: false,
  queue: false,
  shards: 1,
  hashing: false,
  replicas: 2,
  mode: "ap",
};

export const LEVEL_BY_SLUG = Object.fromEntries(LEVELS.map((l, i) => [l.slug, { ...l, index: i }]));

/** First simulation that teaches each reference section, for the cross-links. */
export const SIM_OF_SECTION = LEVELS.reduce((acc, l, i) => {
  if (acc[l.ref] === undefined) acc[l.ref] = i;
  return acc;
}, /** @type {Record<string, number>} */ ({}));
