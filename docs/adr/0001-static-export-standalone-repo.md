# 0001 — Standalone repo, static export, no backend

**Status:** Accepted · 2026-08-16

## Context

[Issue #1363](https://github.com/donnemartin/system-design-primer/issues/1363) asks
for a website because the primer is a single ~110 KB README: no navigation, no
search, no way to link to one topic. The issue suggests MkDocs or Docusaurus.

Two questions had to be settled before writing anything.

**Where does this live?** Opening a pull request against the upstream repo means
the maintainer must accept a whole application into a repo that has never had a
build step. The issue has no maintainer response and no assignee, so the odds of
that landing unreviewed are poor, and the work would be invisible until it did.

**What renders it?** The site's value is that a reader can find and link to one
section. That is a routing and indexing problem, and secondarily an SEO one — a
reader searching for "cache-aside" should be able to land on that section
directly.

An off-the-shelf docs generator was considered and rejected: the site needs a
canvas simulator, an availability calculator, a latency chart and a search
overlay, none of which fit a Markdown-driven theme without fighting it.

## Decision

Build as a **standalone repository**, deploy it, and link the running site from
the issue. Keep the layout PR-portable — the content sync is the only thing that
touches upstream, so it can be repointed at local files if this ever moves into a
fork.

Use **Next.js App Router with `output: 'export'`**. Every reference section,
exercise and simulation is a real route, prerendered to its own HTML file.

Take **no backend**. The content is static, the simulation runs on the client,
and search is a local index.

## Consequences

- Deep links work and section prose is in the HTML source, so search engines and
  link previews both see real content. This is the actual fix the issue asked for.
- Hosting is trivial and free — any static host, no server to keep alive.
- The maintainer can evaluate a running site rather than a diff. Nothing is
  blocked on review.
- The project carries its own build, CI and dependency surface, which upstream
  does not have to maintain. That is the cost of not being in-tree.
- No server means no analytics, no feedback endpoint and no dynamic content
  without adding infrastructure this decision deliberately avoids.
- `generateStaticParams` must enumerate every route at build time. A section that
  exists only in the sync output but not in the authored mapping would not get a
  page — which is why the mapping is explicit and the sync fails loudly.
