# 0006 — Split the content bundle from the navigation bundle

**Status:** Accepted · 2026-08-16

## Context

`content/index.ts` began as a single barrel exporting everything: reference
bodies, exercise steps, the search index and the authored constants. Convenient,
and correct for server components, which render a body and leave the JSON in the
prerendered output.

It is wrong for client components. The persistent sidebar lives in the root
layout, is a client component (it needs the active route, a filter input and the
theme toggle), and imported that barrel for section titles.

The result: every page shipped **~770 KB of content JSON** to the browser to
render a list of links. Measured, a reference page pulled 1256 KB of eager
JavaScript, and the simulation page the same again because `lib/sim/engine.ts`
imported the barrel for three cost constants.

The search index is a related case. It is the full text of all 27 documents —
~160 KB — needed only if the reader opens the overlay.

## Decision

Split the content surface by who consumes it:

- **`content/index.ts`** — full bodies. Server components only.
- **`content/nav.ts`** — titles, slugs, groups and authored constants. What
  client components import. Backed by a `nav.json` the sync emits alongside the
  rest.
- **`lib/search.ts`** — loads its index through a **dynamic import** on first
  overlay open, not at module scope.

`lib/sim/engine.ts` imports cost constants directly from
`content/authored/levels.mjs` rather than through the barrel.

## Consequences

- Eager JavaScript fell from ~1256 KB to ~704 KB per page, about 190 KB gzipped
  across all chunks — a normal App Router baseline.
- Nobody pays for the search index unless they press `/`.
- There are now two ways to import content and picking the wrong one silently
  regresses bundle size. This is documented in `CLAUDE.md`, but it is a footgun
  and the first thing to check if a bundle grows.
- The overlay has a brief loading state on first open, which is why it shows
  "loading the index…" rather than "no results".
- The sync emits one more artefact that must stay consistent with the others.
  Since all four come from the same run, they cannot drift independently.
