# CLAUDE.md

Guidance for working in this repo.

## What this is

An unofficial interactive companion to [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer), built for [issue #1363](https://github.com/donnemartin/system-design-primer/issues/1363). Next.js 16 App Router, TypeScript, `output: 'export'` — a fully static site, no backend, no runtime data fetching.

Live at https://system-design-primer.rujalduwal.com.np

## The one rule that matters

**Upstream content is rebuilt from source; it is never edited by hand.**

Every reference page is split visibly between an authored summary and the primer's own text. If you find yourself editing prose inside `content/generated/`, stop — that directory is output. Change `scripts/sync.mjs` or the mapping in `content/authored/sections.mjs` and re-run the sync.

The sync **must never** overwrite: section keys, slugs, groups, summary panels (`lede` + `rows`), the simulation definitions, the availability calculator, or the latency chart. Those are authored and live in `content/authored/`.

A mapped anchor that disappears upstream **fails the build on purpose**. Do not "fix" that by making it warn instead — a section silently vanishing is the failure mode the loud exit exists to prevent.

## Node

**Node 24** (Krypton, the current Active LTS) — pinned in `.nvmrc`, `engines`, both
workflows, and the Vercel project. Keep those four in step: CI silently testing a
different runtime from the one that builds production is the bug this pinning
exists to prevent.

## Commands

```bash
npm run sync            # fetch upstream content (--offline reuses .cache/)
npm run dev
npm run build           # static export to out/
npm run verify          # typecheck + level tuning
npm run verify:levels   # simulation tuning only
npm run smoke           # browser tests against out/ — run build first
```

Before opening a PR: `npm run verify && npm run build && npm run smoke`.

## Layout

```
content/
  authored/     hand-written: summaries, simulations, latency figures, section mapping
  generated/    sync output — committed, never hand-edited
  index.ts      full content (bodies) — server components only
  nav.ts        titles/slugs only — for client components
scripts/
  sync.mjs           fetch → parse → map → emit
  verify-levels.mjs  headless simulation tuning check
  smoke.mjs          Playwright smoke test
  sim-harness.mjs    bundles the TS engine for Node
lib/
  sim/engine.ts  the simulation — plain class, mutable refs, rAF
  search.ts      lexical index, shared by search and LLM retrieval
  llm/           WebLLM in a worker
app/             reference/[slug], exercise/[slug], simulate/[slug]
docs/adr/        architecture decision records — read before large changes
```

## Things that will bite you

**Never import `@/content` from a client component.** It pulls every section body — about 770 KB of JSON — into that page's bundle. Client components import `@/content/nav`, which carries titles and slugs only. This regressed once already; if a page's bundle jumps, check this first.

**Packets must not go into React state.** A few hundred objects re-rendering per frame will not hold 60fps. `SimEngine` owns them as mutable state driven by rAF and reports metrics to React roughly 8 times a second. Keep it that way.

**`grid-template-rows: minmax(0, 1fr)` in the simulation grid is load-bearing.** A content-sized row lets the canvas push the shell past the viewport and the whole page starts scrolling. Same for the sidebar's own `overflow-y: auto`.

**Canvas `font` strings cannot resolve CSS variables.** The engine reads `--font-mono` out of the cascade in `readColors()`. Writing `font: "12px var(--font-mono)"` silently falls back to the browser default.

**Simulation build state lives in `AppState`, not in the page.** Leaving a simulation to read the reference and coming back must preserve what you bought; the page unmounts on navigation, so that state sits above the route.

**Nothing upstream is injected as HTML.** The sync emits a block tree and `Blocks.tsx` builds React elements from it. Do not introduce `dangerouslySetInnerHTML` for upstream content — the site rebuilds from whatever the README says today.

## Simulation tuning

Each level must **fail** with the starting build and **pass** with the intended one. `npm run verify:levels` asserts this over 12 runs per case using the same engine the browser runs, bundled through esbuild.

If you touch any number in `content/authored/levels.mjs`, run it. A level that becomes winnable without its lesson has stopped teaching, and nothing in the UI would tell you.

## Attribution

The site is named after the upstream project, so it states that it is unofficial in the tagline, the sidebar footer, the meta description and the README. Content is CC BY 4.0. **Keep those disclaimers intact** — `npm run smoke` asserts the sidebar one, so removing it fails the test rather than shipping quietly.

## Deployment

Pushes to `main` deploy via the Vercel GitHub integration. Do not deploy with `vercel --prod` from a laptop; that bypasses CI and makes the deployed commit ambiguous.
