# 0002 — Rebuild upstream content from source at build time

**Status:** Accepted · 2026-08-16

## Context

The primer is a living document with hundreds of contributors. Any companion site
that copies its text becomes a fork of the content: it drifts, and within a year
it is quietly wrong while still carrying the original's name and licence.

That gives the project its central constraint: *contributors update the README,
and this site must not deviate from it.*

Three options were on the table:

1. **Copy the text in.** Fastest to a demo, guaranteed to rot.
2. **Fetch at runtime in the browser.** Always current, but costs a round trip
   per page, hits GitHub rate limits, and puts the site's core content behind a
   network call that can fail.
3. **Fetch and transform at build time.** Content is current as of the last
   build, ships in the HTML, and the transformation can be validated.

Inspecting the actual README turned up complications that ruled out any naive
split: six of the twenty sections map to `###` headings rather than `##`;
`#appendix` contains three unrelated subtrees and would swallow a third of the
document if split naively; the solution files hotlink images from imgur over
plain `http://`; and internal links like `(#active-passive)` point at
sub-headings that have no page of their own on this site.

## Decision

Sync at **build time** via `scripts/sync.mjs`, committing the output.

- Parse with `mdast-util-from-markdown` + GFM rather than hand-rolling. The
  corpus uses tables, blockquotes, nested lists and raw-HTML figures.
- Split sections using an **explicit mapping table** in
  `content/authored/sections.mjs`, where each entry declares its anchor, heading
  depth and optional stop anchor. No inference.
- Emit a **block tree**, not HTML. `Blocks.tsx` builds React elements from it, so
  upstream content can never inject markup.
- **Vendor every image**, including imgur hotlinks and GitHub camo URLs, to fix
  mixed content and remove a third-party dependency.
- Rewrite internal anchors against an index of *every* heading, resolving each to
  the mapped section that contains it; fall back to GitHub for anchors outside
  any mapped section.
- **Exit non-zero when a mapped anchor is missing.**

Split every page visibly: an authored summary panel labelled *"in short — written
for this site"*, and the upstream body labelled *"from the primer — full
section"*. The sync never touches the authored half.

## Consequences

- The site cannot silently drift from the repo it credits, which is what makes it
  defensible to the upstream maintainer.
- Content is current as of the last build, not the last page view. A weekly
  GitHub Action opens a PR when upstream changes, so the lag is bounded.
- An upstream heading rename **breaks the build**. This is intended: the
  alternative is a page that quietly renders empty. It does mean upstream churn
  can block a deploy until the mapping is updated.
- The mapping table is manual work, and adding a section means editing it. That
  is the price of not guessing.
- Committing the generated JSON means the site builds without network access, and
  content changes show up as reviewable diffs.
- The authored/upstream split must stay visible in the UI. Collapsing it would
  make the site's claims about provenance untrue.
