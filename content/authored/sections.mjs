/**
 * The 20 reference sections.
 *
 * Every field here is AUTHORED for this site and must never be overwritten by
 * the content sync:
 *   - key            stable identity, used by simulations and exercise chips
 *   - slug           the route: /reference/<slug>
 *   - title          our heading (upstream titles are sometimes terse)
 *   - lede / rows    the "in short" summary panel
 *   - calc / latency authored interactive widgets
 *
 * These fields describe where the section lives UPSTREAM and drive the sync:
 *   - anchor         the GitHub heading anchor in README.md
 *   - headingLevel   depth of that heading (2 or 3) — six sections are ###
 *   - stopAtAnchor   optional explicit end; otherwise the section runs to the
 *                    next heading of depth <= headingLevel
 *
 * The sync fills in `body` (upstream blocks) at build time. Nothing else.
 */
export const SECTIONS = [
  {
    key: "perf",
    slug: "performance-vs-scalability",
    anchor: "performance-vs-scalability",
    headingLevel: 2,
    title: "Performance vs scalability",
    lede: "A service is scalable if adding resources results in a proportional increase in performance.",
    rows: [
      {
        k: "symptom",
        v: "Slow for one user with no load — performance. Fast alone, slow together — scalability.",
      },
      {
        k: "test",
        v: "Scalability holds when doubling the resources roughly doubles the work served, at unchanged latency.",
      },
    ],
  },
  {
    key: "throughput",
    slug: "latency-vs-throughput",
    anchor: "latency-vs-throughput",
    headingLevel: 2,
    title: "Latency vs throughput",
    lede: "Latency is the time to perform an action. Throughput is the number of actions per unit of time.",
    rows: [
      {
        k: "latency",
        v: "Time to produce a result, measured at the tail (p95, p99) rather than the mean — the average hides the requests that lose users.",
      },
      {
        k: "throughput",
        v: "Results per unit of time. Bounded by the slowest stage in the pipeline, never by the fastest.",
      },
    ],
  },
  {
    key: "cap",
    slug: "cap-theorem",
    anchor: "cap-theorem",
    headingLevel: 3,
    title: "CAP theorem",
    lede: "Pick two. Networks fail, so partition tolerance isn't the one you drop.",
    rows: [
      {
        k: "CP",
        v: "Waiting for a response from the partitioned node might result in a timeout. A good choice when business needs require atomic reads and writes — payments, inventory, locks.",
      },
      {
        k: "AP",
        v: "Responses return the most readily available version on any node, which might not be the latest. Writes propagate once the partition resolves. A good choice for eventual consistency — feeds, counters, DNS.",
      },
      {
        k: "in practice",
        v: "Most systems are neither purely CP nor AP but choose per operation: a checkout is CP, a view counter is AP.",
      },
    ],
  },
  {
    key: "consistency",
    slug: "consistency-patterns",
    anchor: "consistency-patterns",
    headingLevel: 2,
    title: "Consistency patterns",
    lede: "With multiple copies of the same data, decide how they agree — and how long agreement takes.",
    rows: [
      {
        k: "weak",
        v: "After a write, reads may or may not see it. Best effort. memcached, VoIP, video chat, realtime multiplayer — if you drop out of a call, you do not get the seconds you missed.",
      },
      {
        k: "eventual",
        v: "After a write, reads will eventually see it, typically within milliseconds. Asynchronous replication. DNS, email — works well in highly available systems.",
      },
      {
        k: "strong",
        v: "After a write, reads see it. Data is replicated synchronously. File systems and RDBMSes, and anything needing transactions.",
      },
    ],
  },
  {
    key: "availability",
    slug: "availability-patterns",
    anchor: "availability-patterns",
    headingLevel: 2,
    title: "Availability patterns",
    lede: "Two complementary patterns support high availability: fail-over and replication.",
    rows: [
      {
        k: "in sequence",
        v: "Availability (Total) = Availability (Foo) * Availability (Bar). Two components at 99.9% give 99.8% — worse than either alone.",
      },
      {
        k: "in parallel",
        v: "Availability (Total) = 1 - (1 - Foo) * (1 - Bar). The same two components give 99.9999%, because both must fail at once.",
      },
      {
        k: "nines",
        v: "Availability is measured in nines. 99.99% is four nines: about 52 minutes of downtime a year, 8.6 seconds a day.",
      },
    ],
    calc: true,
  },
  {
    key: "dns",
    slug: "domain-name-system",
    anchor: "domain-name-system",
    headingLevel: 2,
    title: "Domain name system",
    lede: "Translates a domain name to an IP address — a hierarchical, heavily cached lookup before any request is made.",
    rows: [
      {
        k: "record types",
        v: "NS points at a name server for the domain. MX at a mail server. A maps a name to an IPv4 address, AAAA to IPv6. CNAME points one name at another name or at an A record.",
      },
      {
        k: "routing",
        v: "Weighted round robin can prevent traffic going to servers under maintenance and balance across cluster sizes. Latency-based routing sends the client to the nearest region. Geolocation-based routing decides by the origin of the request.",
      },
      {
        k: "cost",
        v: "Accessing a DNS server introduces a slight delay, and DNS server management is complex and generally managed by governments, ISPs and large companies. DNS services have recently come under DDoS attack.",
      },
    ],
  },
  {
    key: "cdn",
    slug: "content-delivery-network",
    anchor: "content-delivery-network",
    headingLevel: 2,
    title: "Content delivery network",
    lede: "A globally distributed network of proxy servers, serving content from locations closer to the user.",
    rows: [
      {
        k: "push CDN",
        v: "You upload content when it changes and rewrite URLs to point at the CDN. Content is stored until you replace or expire it. Best for small traffic or content that is not often updated.",
      },
      {
        k: "pull CDN",
        v: "Grabs new content from your server on the first user request. You leave the content on your server and rewrite URLs. The first request is slower until the content is cached; TTLs determine how long it lives.",
      },
      {
        k: "cost",
        v: "CDN costs can be significant depending on traffic — although weigh that against not using one. Content might be stale if it is updated before a TTL expires. Assets need URL rewriting to point at the CDN.",
      },
    ],
  },
  {
    key: "lb",
    slug: "load-balancer",
    anchor: "load-balancer",
    headingLevel: 2,
    title: "Load balancer",
    lede: "Distribute requests across resources so no single one is a bottleneck or a single point of failure.",
    rows: [
      {
        k: "layer 4",
        v: "Looks at transport-layer info — source and destination IPs and ports, not packet contents. Forwards packets with NAT. Cheaper and faster, less flexible.",
      },
      {
        k: "layer 7",
        v: "Looks at the application layer: headers, message, cookies. Terminates traffic, reads the message, then opens a connection to the chosen server. Can route video traffic to video hosts and billing traffic to hardened hosts.",
      },
      {
        k: "routing",
        v: "Random, least loaded, session/cookies, round robin or weighted round robin.",
      },
      {
        k: "cost",
        v: "The balancer can itself become a bottleneck if under-resourced, and a single one is a single point of failure. Multiple balancers add complexity.",
      },
    ],
  },
  {
    key: "proxy",
    slug: "reverse-proxy",
    anchor: "reverse-proxy-web-server",
    headingLevel: 2,
    title: "Reverse proxy",
    lede: "A single web server front that makes internal services look like one origin.",
    rows: [
      {
        k: "hides identity",
        v: "Increased security: information about backend servers is hidden, IPs can be blacklisted, and the number of connections per client is limited.",
      },
      {
        k: "does the chores",
        v: "Increased scalability and flexibility: clients see only the proxy's IP, so you can change server configuration behind it. SSL termination, compression, caching and static file serving all happen once, at the edge.",
      },
      {
        k: "cost",
        v: "Introducing a reverse proxy increases complexity, and a single reverse proxy is a single point of failure — configuring multiple is harder still.",
      },
    ],
  },
  {
    key: "app",
    slug: "application-layer",
    anchor: "application-layer",
    headingLevel: 2,
    title: "Application layer",
    lede: "Separate the web layer from the application layer so each scales — and fails — independently.",
    rows: [
      {
        k: "microservices",
        v: "A suite of independently deployable, small, modular services. Each runs a unique process and communicates through a well-defined, lightweight mechanism to serve a business goal.",
      },
      {
        k: "service discovery",
        v: "Services register their name, address and port; callers look them up rather than hardcoding hosts. Health checks verify integrity, usually over an HTTP endpoint.",
      },
      {
        k: "cost",
        v: "Adding an application layer with loosely coupled services requires a different approach from an architectural, operations, and process viewpoint. Microservices can add complexity in deployments and operations.",
      },
    ],
  },
  {
    key: "async",
    slug: "asynchronism",
    anchor: "asynchronism",
    headingLevel: 2,
    title: "Asynchronism",
    lede: "Move expensive work out of the request path.",
    rows: [
      {
        k: "message queues",
        v: "Redis is a simple broker but can lose messages. RabbitMQ is popular, requires AMQP and your own nodes. Amazon SQS is hosted, with higher latency and possible duplicate delivery.",
      },
      {
        k: "task queues",
        v: "Receive tasks and their data, run them, deliver results. Celery supports scheduling, primarily for Python.",
      },
      {
        k: "back pressure",
        v: "If queues grow past memory you get cache misses and disk reads. Limiting queue size keeps throughput healthy for queued jobs; a full queue returns 503 and the client retries with exponential backoff.",
      },
    ],
  },
  {
    key: "comm",
    slug: "communication",
    anchor: "communication",
    headingLevel: 2,
    title: "Communication",
    lede: "TCP, UDP, RPC and REST — four different bargains between guarantees and speed.",
    rows: [
      {
        k: "RPC",
        v: "A client causes a procedure to execute in a different address space, usually a remote server. Calls are generally slower and less reliable than local calls, so it helps to distinguish RPC calls from local ones. Popular frameworks include Protobuf, Thrift and Avro.",
      },
      {
        k: "REST",
        v: "An architectural style enforcing a client/server model where the client acts on a set of resources managed by the server. The server provides a representation of resources and actions that can manipulate or get a new representation. All communication is stateless and cacheable.",
      },
      {
        k: "RPC vs REST",
        v: "RPC is focused on exposing behaviors and is convenient inside a system you own. REST is focused on resources and evolves better across teams and public clients — but it can be a poor fit when resources are not naturally organized in a hierarchy.",
      },
    ],
  },
  {
    key: "cache",
    slug: "cache",
    anchor: "cache",
    headingLevel: 2,
    title: "Cache",
    lede: "Absorb hot reads close to the caller. Pay in staleness and invalidation.",
    rows: [
      {
        k: "cache-aside",
        v: "The application reads and writes storage; the cache does not. On a miss: load from the database, add to cache, return. Lazy loading, so only requested data is cached — but each miss costs three trips and data can go stale.",
      },
      {
        k: "write-through",
        v: "The application writes to the cache, and the cache synchronously writes to the database. Slower writes, fast subsequent reads, never stale. Most written data may never be read.",
      },
      {
        k: "write-behind",
        v: "The cache acknowledges the write and persists asynchronously. Fastest writes, and outright data loss if the cache dies before the flush.",
      },
      {
        k: "refresh-ahead",
        v: "Refresh recently-accessed entries before they expire. Lower latency when prediction is good, wasted work when it isn't.",
      },
    ],
  },
  {
    key: "db",
    slug: "scaling-a-relational-database",
    anchor: "relational-database-management-system-rdbms",
    headingLevel: 3,
    title: "Scaling a relational database",
    lede: "Five levers, five different bills.",
    rows: [
      {
        k: "master-slave",
        v: "The master serves reads and writes and replicates to slaves that serve reads only. Promoting a slave needs extra logic, and heavy writes make replicas lag while replaying them.",
      },
      {
        k: "master-master",
        v: "Both masters serve reads and writes and coordinate. You need a balancer or write-routing logic, and most such systems are loosely consistent or pay write latency for synchronization.",
      },
      {
        k: "federation",
        v: "Split databases by function — forums, users, products. Less traffic and replication per database, better cache locality, parallel writes. Cross-database joins get harder.",
      },
      {
        k: "sharding",
        v: "Distribute rows across databases, each managing a subset. Smaller indexes, isolated failures, but lopsided shards, complex queries, and painful rebalancing without consistent hashing.",
      },
      {
        k: "denormalization",
        v: "Write redundant copies to avoid expensive joins, trading write performance for read performance. Reads often outnumber writes 100:1. Duplication must be kept in sync.",
      },
    ],
  },
  {
    key: "nosql",
    slug: "nosql",
    anchor: "nosql",
    headingLevel: 3,
    title: "NoSQL",
    lede: "A collection of data items represented in a key-value store, document store, wide column store, or graph database.",
    rows: [
      {
        k: "key-value store",
        v: "A hash table. Allows O(1) reads and writes and is often backed by memory or SSD. Maintaining keys in lexicographic order allows efficient retrieval of key ranges. Often used for simple data models or rapidly-changing data, such as an in-memory cache layer.",
      },
      {
        k: "document store",
        v: "Centered around documents — XML, JSON, binary — where a document stores all information for a given object. Provides APIs or a query language to query based on the internal structure of the document itself. Well suited for occasionally changing data.",
      },
      {
        k: "wide column store",
        v: "The basic unit of data is a column (name/value pair); columns group into families, families into super column families. Data is accessed by specifying a row key and then a column. Bigtable, HBase and Cassandra maintain keys in lexicographic order.",
      },
      {
        k: "graph database",
        v: "Each node is a record and each arc is a relationship between two nodes. Optimized for representing complex relationships with many foreign keys or many-to-many relationships. Often accessed over a REST API.",
      },
    ],
  },
  {
    key: "sqlnosql",
    slug: "sql-or-nosql",
    anchor: "sql-or-nosql",
    headingLevel: 3,
    title: "SQL or NoSQL",
    lede: "Structured data with transactions, or unstructured data at scale. Pick on the shape of the reads.",
    rows: [
      {
        k: "fits NoSQL",
        v: "Rapid ingest of clickstream and log data, leaderboard or scoring data, temporary data such as a shopping cart, frequently accessed tables, metadata and lookup tables.",
      },
      {
        k: "fits SQL",
        v: "Anything where correctness across several rows matters at once — money, inventory, permissions, bookings.",
      },
    ],
  },
  {
    key: "approach",
    slug: "how-to-approach-the-question",
    anchor: "how-to-approach-a-system-design-interview-question",
    headingLevel: 2,
    title: "How to approach the question",
    lede: "Four steps: outline the use cases, sketch a high level design, design core components, then scale it.",
    rows: [
      {
        k: "1. use cases",
        v: "Who uses the system, how, and how often. Constraints: traffic, data volume, read/write ratio, latency budget.",
      },
      {
        k: "2. high level design",
        v: "Sketch the main components and connections. Justify your ideas before adding detail.",
      },
      {
        k: "3. core components",
        v: "Dive into the two or three parts the problem actually turns on — the data model, the hot path, the fan-out.",
      },
      {
        k: "4. scale the design",
        v: "Identify and address bottlenecks. Load balancing, horizontal scaling, caching, database sharding — each with its trade-off named.",
      },
    ],
  },
  {
    key: "estimate",
    slug: "back-of-the-envelope-estimation",
    anchor: "appendix",
    headingLevel: 2,
    // The Appendix subtree also holds latency numbers, further questions and
    // company blogs. Bound it explicitly or it swallows a third of the README.
    stopAtAnchor: "latency-numbers-every-programmer-should-know",
    title: "Back-of-the-envelope estimation",
    lede: "Powers of two, latency numbers, and a willingness to round hard.",
    rows: [
      {
        k: "powers of two",
        v: "2^10 is a thousand — a kilobyte. 2^20 a million — a megabyte. 2^30 a billion — a gigabyte. 2^40 a trillion — a terabyte. 2^50 a quadrillion — a petabyte.",
      },
      {
        k: "a working example",
        v: "1 million users writing 1 KB a day is 1 GB a day, 365 GB a year. That fits on one machine, so the interesting question is not storage but read fan-out.",
      },
    ],
  },
  {
    key: "latency",
    slug: "latency-numbers",
    anchor: "latency-numbers-every-programmer-should-know",
    headingLevel: 3,
    title: "Latency numbers",
    lede: "Each step is roughly ten times the last. This is why memory beats disk and why the round trip is the enemy.",
    rows: [],
    latency: true,
  },
  {
    key: "security",
    slug: "security",
    anchor: "security",
    headingLevel: 2,
    title: "Security",
    lede: "Encrypt in transit and at rest, sanitize input, and grant the least privilege that works.",
    rows: [
      {
        k: "in transit and at rest",
        v: "Encrypt both. Sanitize all user inputs or any input parameters exposed to the user to prevent XSS and SQL injection.",
      },
      {
        k: "parameterize queries",
        v: "Use prepared statements rather than string concatenation to prevent SQL injection.",
      },
      {
        k: "least privilege",
        v: "Users should only be able to access what they need. Same for processes, services and hosts.",
      },
    ],
  },
];

/** Sidebar grouping. Order here is the order shown. */
export const SECTION_GROUPS = [
  { label: "fundamentals", keys: ["perf", "throughput", "cap", "consistency", "availability"] },
  { label: "getting there", keys: ["dns", "cdn", "lb", "proxy"] },
  { label: "the application", keys: ["app", "async", "comm"] },
  { label: "the data", keys: ["cache", "db", "nosql", "sqlnosql"] },
  { label: "in the room", keys: ["approach", "estimate", "latency", "security"] },
];

/**
 * Upstream anchors that are not themselves a mapped section, but that the
 * README links to often enough that sending readers back to GitHub would be a
 * worse answer than picking the closest section here.
 *
 * `#database` is the h2 parent of RDBMS / NoSQL / SQL-or-NoSQL — it has no page
 * of its own, and the scaling section is what a reader following that link
 * wants. Anything not listed here still falls back to GitHub.
 */
export const ANCHOR_ALIASES = {
  database: "db",
  "relational-database-management-system-rdbms": "db",
  "availability-vs-consistency": "cap",
  "horizontal-scaling": "lb",
  "load-balancer-vs-reverse-proxy": "proxy",
  "powers-of-two-table": "estimate",
  "back-of-the-envelope-calculations": "estimate",
};

export const SECTION_BY_KEY = Object.fromEntries(SECTIONS.map((s) => [s.key, s]));
export const SECTION_BY_SLUG = Object.fromEntries(SECTIONS.map((s) => [s.slug, s]));
export const SECTION_ORDER = SECTION_GROUPS.flatMap((g) => g.keys);
export const GROUP_OF = Object.fromEntries(
  SECTION_GROUPS.flatMap((g) => g.keys.map((k) => [k, g.label]))
);
