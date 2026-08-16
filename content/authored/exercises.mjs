/**
 * The 7 design problems.
 *
 * Authored here, never synced: key, slug, title, statement, constraints, and
 * each step's `lede` paragraphs and `refs` chips.
 *
 * Synced from `solutions/system_design/<dir>/README.md`: each step's `body`
 * blocks, taken from the matching `## Step N` heading upstream. Every solution
 * README shares that four-step structure, which is what makes the mapping safe.
 *
 * So each accordion reads: our summary first, the primer's own words below it —
 * the same contract as a reference page.
 */
export const EXERCISES = [
  {
    key: "pastebin",
    slug: "pastebin",
    dir: "pastebin",
    title: "Pastebin",
    statement:
      "Design Pastebin.com — users paste a block of text and get back a short, randomly generated link to it. Bit.ly is the same problem with the text replaced by a URL.",
    constraints: [
      "10 million users a month",
      "10 million pastes a month",
      "Read-heavy at 100:1",
      "Pastes expire",
      "Links are not guessable",
      "Analytics on views",
      "Service is highly available",
    ],
    steps: [
      {
        label: "Use cases and constraints",
        refs: ["estimate"],
        lede: [
          "Scope to the paths that matter: a user enters a block of text and gets a generated link; a user enters the link and sees the paste; expired pastes are deleted; the service tracks analytics on page views.",
          "Do the arithmetic before designing. 10 million writes a month at an average paste size of 1 KB is 10 GB of new content a month, 360 GB over three years. That is one machine's worth of data, so the design pressure comes from reads, not storage.",
        ],
      },
      {
        label: "High level design",
        refs: ["lb", "app"],
        lede: [
          "Client to web server to write API, which generates a unique key, checks it is not taken, and stores the paste in an object store with its metadata in a SQL table. Reads take the key, look up the metadata, and return the content from the object store.",
          "Separating content from metadata is the decision the whole design rests on: the metadata row is small and queryable, the paste blob is large and never queried.",
        ],
      },
      {
        label: "Core components",
        refs: ["db", "nosql"],
        lede: [
          "Generating the key: take an MD5 of the IP address plus timestamp, Base62-encode it, and take the first seven characters. Base62 gives 62^7 ≈ 3.5 trillion possibilities, which is more than enough and, unlike a sequential counter, not guessable.",
          "Expiry runs as a background job scanning for expired rows rather than checking on read. Analytics writes go to a separate path so a spike in views never slows a paste.",
        ],
      },
      {
        label: "Scale the design",
        refs: ["cache", "cdn"],
        lede: [
          "At 100:1 reads to writes, the read path is where the money goes. A memory cache in front of the metadata lookup absorbs the hot pastes; a CDN in front of the object store serves the content itself.",
          "Benchmark and profile before adding anything. Address the bottleneck you measured, not the one you expect.",
        ],
      },
    ],
  },
  {
    key: "twitter",
    slug: "twitter-timeline",
    dir: "twitter",
    title: "Twitter timeline and search",
    statement:
      "Design the Twitter timeline: a user posts a tweet, and their followers see it in a home timeline. Also design search over all tweets.",
    constraints: [
      "100 million active users a day",
      "500 million tweets a day",
      "Fan-out to an average of 100 followers",
      "Deliver in under a second",
      "Read-heavy timeline",
      "Search must be fast",
      "High availability",
    ],
    steps: [
      {
        label: "Use cases and constraints",
        refs: ["estimate", "throughput"],
        lede: [
          "The core use cases are posting a tweet, viewing the home timeline, viewing the user timeline, and searching keywords.",
          "500 million tweets a day is about 5,800 tweets a second, with peaks far above that. Each tweet fans out to 100 followers on average, so the write amplification, not the tweet volume, sets the load.",
        ],
      },
      {
        label: "High level design",
        refs: ["async", "app"],
        lede: [
          "Posting a tweet writes to a SQL database, then hands off to a fan-out service. The fan-out service stores the tweet in the home timeline of each follower in a memory cache, and posts it to the search index and the notification service.",
          "The user is not made to wait for delivery. Their own timeline updates immediately; propagation to followers is asynchronous.",
        ],
      },
      {
        label: "Core components",
        refs: ["cache", "nosql"],
        lede: [
          "Home timelines live in memory, not in a query. Building a timeline by joining tweets from everyone a user follows is too slow at read time, so it is precomputed at write time and stored as a list of tweet ids per user.",
          "The exception is the celebrity account. Fanning out to 100 million followers is not viable, so those tweets are merged in at read time instead — a hybrid of push and pull.",
        ],
      },
      {
        label: "Scale the design",
        refs: ["db", "cap"],
        lede: [
          "Keep only a few hundred tweets per home timeline in cache and page the rest from storage. Shard the timeline cache by user id.",
          "The timeline can be eventually consistent — a tweet arriving a second late is acceptable. That choice is what makes the whole asynchronous fan-out possible.",
        ],
      },
    ],
  },
  {
    key: "crawler",
    slug: "web-crawler",
    dir: "web_crawler",
    title: "Web crawler",
    statement:
      "Design a web crawler that scrapes a large set of links, generates reverse indices, and serves search results — without crawling the same page twice or getting stuck in loops.",
    constraints: [
      "1 billion links to crawl",
      "Pages recrawled on a schedule by popularity",
      "Duplicate content must be deduplicated",
      "Support 5 billion searches a month",
      "Results ranked by relevance",
      "High availability",
    ],
    steps: [
      {
        label: "Use cases and constraints",
        refs: ["estimate"],
        lede: [
          "Crawl a list of links, generate a reverse index and page titles, serve search results with relevance ranking and pagination.",
          "1 billion links at an average page size of 500 KB is 500 TB of content. The crawl rate, not the storage, is the constraint that shapes the design.",
        ],
      },
      {
        label: "High level design",
        refs: ["async", "app"],
        lede: [
          "A crawler service pulls from a queue of links to crawl, fetches each page, and passes it to a document service that generates the reverse index and stores the result.",
          "Links to crawl live in a queue, and the crawler is many workers reading from it. This is the shape of every large batch pipeline.",
        ],
      },
      {
        label: "Core components",
        refs: ["nosql", "consistency"],
        lede: [
          "Deduplication uses a signature of the page contents, not the URL, so the same content under two URLs is crawled once and indexed once.",
          "Crawl frequency is set per page by how often the content changes, estimated from the difference between successive crawls. Popular, fast-changing pages get revisited more often.",
        ],
      },
      {
        label: "Scale the design",
        refs: ["db", "cache"],
        lede: [
          "Shard the crawl queue and the index by URL hash so workers do not contend. Rate-limit per domain and respect robots.txt — being polite is a hard requirement, not an optimization.",
          "Serving results is a separate, read-heavy system with its own cache in front of the index.",
        ],
      },
    ],
  },
  {
    key: "mint",
    slug: "mint",
    dir: "mint",
    title: "Mint.com",
    statement:
      "Design Mint.com: users connect financial accounts, transactions are pulled in and categorized automatically, and users see spending against budgets.",
    constraints: [
      "10 million users",
      "10 accounts per user",
      "5 transactions a day per account",
      "Categories are recommended and can be corrected",
      "Monthly budget by category",
      "Service is highly available",
    ],
    steps: [
      {
        label: "Use cases and constraints",
        refs: ["estimate"],
        lede: [
          "Users connect an account, the service extracts transactions daily, categorizes them, allows manual recategorization, and shows spending against a monthly budget.",
          "10 million users with 10 accounts each at 5 transactions a day is 500 million transactions a day. The extraction runs as a daily batch, not on request.",
        ],
      },
      {
        label: "High level design",
        refs: ["async", "app"],
        lede: [
          "An accounts API validates and stores the account, then queues an extraction job. A transaction extraction service pulls transactions on a schedule and writes them to storage; a category service assigns each one a category.",
          "Nothing in this design happens in the request path except reading results.",
        ],
      },
      {
        label: "Core components",
        refs: ["db", "nosql"],
        lede: [
          "Categorization starts from a seed list of merchant names to categories. User corrections feed back as overrides, and popular corrections improve the seed.",
          "Budget totals are recomputed per user per month rather than summed on every page view.",
        ],
      },
      {
        label: "Scale the design",
        refs: ["cache", "db"],
        lede: [
          "Shard transaction storage by user id — every query is scoped to one user, so this shards cleanly with no cross-shard joins.",
          "The daily batch is the scaling risk: it must finish before users wake up, so it is sized against the window, not the average.",
        ],
      },
    ],
  },
  {
    key: "salesrank",
    slug: "sales-rank",
    dir: "sales_rank",
    title: "Amazon sales rank",
    statement:
      "Design a feature that ranks products by total sales within a category, updated hourly from a stream of sales.",
    constraints: [
      "10 million products",
      "1000 categories",
      "1 billion transactions a month",
      "100 billion read requests a month",
      "Rank by category recalculated hourly",
      "High availability",
    ],
    steps: [
      {
        label: "Use cases and constraints",
        refs: ["estimate", "throughput"],
        lede: [
          "The service calculates the past week's most popular products by category and serves that ranking to users.",
          "100 billion reads a month against a ranking that changes hourly is the definition of a cacheable workload.",
        ],
      },
      {
        label: "High level design",
        refs: ["async"],
        lede: [
          "Sales are written to a log. A batch job runs hourly over the log, aggregates sales by product and category, and writes a sales rank table the read API serves from.",
          "Ranking is never computed on read.",
        ],
      },
      {
        label: "Core components",
        refs: ["db", "nosql"],
        lede: [
          "The aggregation is a map-reduce: map each sale to a category-product key, reduce to a count, sort within category, take the top n.",
          "Only the top of each category is stored for serving. Nobody pages to rank 40,000.",
        ],
      },
      {
        label: "Scale the design",
        refs: ["cache", "cdn"],
        lede: [
          "The result is small, identical for all users, and changes hourly, so it caches at every layer including the CDN.",
          "The batch job is the part that scales with data volume; the read path barely scales at all, which is the point.",
        ],
      },
    ],
  },
  {
    key: "datastore",
    slug: "key-value-store",
    dir: "query_cache",
    title: "Key-value store",
    statement:
      "Design a key-value store for a search engine — a cache that returns results for a query it has seen recently, and evicts what it has not.",
    constraints: [
      "High volume of repeated queries",
      "Sub-millisecond reads",
      "Least-recently-used eviction",
      "Results expire when stale",
      "Cache misses fall through to the index",
      "High availability",
    ],
    steps: [
      {
        label: "Use cases and constraints",
        refs: ["cache"],
        lede: [
          "A user sends a search request; the cache returns the result if it holds one, otherwise the query runs against the index and the result is added to the cache.",
          "The whole design is one decision made well: what to keep and what to throw away.",
        ],
      },
      {
        label: "High level design",
        refs: ["cache"],
        lede: [
          "A hash table maps the query to the result, paired with a doubly linked list ordering entries by recency. A hit moves the node to the head; an insert past capacity evicts the tail.",
          "Both operations are O(1), which is why this structure is the standard answer.",
        ],
      },
      {
        label: "Core components",
        refs: ["consistency"],
        lede: [
          "Entries expire on a TTL as well as on eviction, because a result can go stale before it goes cold.",
          "Updating the index invalidates the affected entries rather than waiting for their TTL.",
        ],
      },
      {
        label: "Scale the design",
        refs: ["nosql", "cap"],
        lede: [
          "Shard the cache across machines by consistent hashing of the query, so adding a machine moves only a fraction of the keys.",
          "Each shard is independent and holds no durable state, so a lost node is a cold cache, not lost data.",
        ],
      },
    ],
  },
  {
    key: "aws",
    slug: "scaling-on-aws",
    dir: "scaling_aws",
    title: "Scaling to millions on AWS",
    statement:
      "Take a service from one box to millions of users, one bottleneck at a time — the whole primer applied in order.",
    constraints: [
      "Start with a single server",
      "Traffic grows steadily",
      "Keep costs proportional to load",
      "Minimize downtime during each step",
      "Measure before each change",
    ],
    steps: [
      {
        label: "One box",
        refs: ["perf"],
        lede: [
          "Web server, application and database on a single machine, with DNS pointing at its IP. This works longer than people expect, and every next step should be justified by a measurement rather than a prediction.",
        ],
      },
      {
        label: "Separate and replicate",
        refs: ["lb", "availability", "db"],
        lede: [
          "Move the database onto its own host so the two can be sized independently. Put a load balancer in front of multiple application servers across availability zones, and add a read replica for the database.",
          "This is the step that removes the single point of failure, and it is also the first simulation on this site.",
        ],
      },
      {
        label: "Cache and offload",
        refs: ["cache", "cdn"],
        lede: [
          "Move static content to object storage behind a CDN. Add a memory cache in front of the hottest queries, and move sessions out of the application servers so they stay stateless.",
          "Stateless application servers are what make autoscaling possible.",
        ],
      },
      {
        label: "Split and shard",
        refs: ["async", "nosql", "db"],
        lede: [
          "Move expensive work to queues and workers. Split the database by function, then shard what remains, and move write-heavy or schema-loose data to a store built for it.",
          "Each step buys headroom and adds an operational burden. The judgment being tested is knowing which one you actually need next.",
        ],
      },
    ],
  },
];

export const EXERCISE_BY_KEY = Object.fromEntries(EXERCISES.map((e) => [e.key, e]));
export const EXERCISE_BY_SLUG = Object.fromEntries(EXERCISES.map((e) => [e.slug, e]));
