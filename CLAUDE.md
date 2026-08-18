# CLAUDE.md

Guidance for working in this repo.

## What this is

An interactive companion to [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer), built for [issue #1363](https://github.com/donnemartin/system-design-primer/issues/1363). Next.js 16 App Router, TypeScript, `output: 'export'` — a fully static site, no backend, no runtime data fetching.

Live at https://system-design-primer.rujalduwal.com.np

## The one rule that matters

**Upstream content is rebuilt from source; it is never edited by hand.**

Every reference page is split visibly between an authored summary and the primer's own text. If you find yourself editing prose inside `content/generated/`, stop — that directory is output. Change `scripts/sync.mjs` or the mapping in `content/authored/sections.mjs` and re-run the sync.

The sync **must never** overwrite: section keys, slugs, groups, summary panels (`lede` + `rows`), the simulation definitions, the availability calculator, or the latency chart. Those are authored and live in `content/authored/`.

A mapped anchor that disappears upstream **fails the build on purpose**. Do not "fix" that by making it warn instead — a section silently vanishing is the failure mode the loud exit exists to prevent.

Refreshing is manual — `npm run sync`, or the *sync content from the primer*
workflow, which pushes a branch to review. There is no schedule; that was turned
off deliberately, so do not add one back without asking.

`meta.json` holds a hash of the emitted content and `syncedAt` only moves when
that hash moves. Do not stamp the time unconditionally: doing so made every run
produce a diff, and the scheduled job pushed a branch containing nothing but a
new timestamp.

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
npm run a11y            # WCAG 2.2 AA audit against out/
```

Before opening a PR: `npm run verify && npm run build && npm run smoke && npm run a11y`.

## Accessibility

The site targets **WCAG 2.2 AA** and `npm run a11y` gates it in CI. Two things
that are easy to undo by accident:

- **`--dim` is the floor, not a starting point.** It is tuned to clear 4.5:1 on
  every background it appears on, including `--accent-bg`. Do not layer
  `opacity` on top of it — that is exactly what put the sidebar group labels
  back under threshold once already.
- **`--line` and `--control-line` are not interchangeable.** Hairline rules and
  panel edges use `--line`; anything whose border is what makes it read as a
  control uses `--control-line`, which clears 3:1 for 1.4.11.

## Architecture

Stack, directory layout, and the build-time vs. runtime data flow (with a
diagram) are in [`ARCHITECTURE.md`](ARCHITECTURE.md) — read it before a change
that touches more than one file. `docs/adr/` has the reasoning behind each
non-obvious choice referenced from there.

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

The site carries the upstream project's name, so it states provenance — attribution, CC BY 4.0, and that it is independent — **once**, in the sidebar footer on every page. `npm run smoke` asserts it, so removing it fails the test rather than shipping quietly.

Don't add the disclaimer back to the tagline, meta description or OG card. It was there once; it read as apologetic and crowded out what the site is for. See [ADR-0005](docs/adr/0005-naming-and-unofficial-status.md).

## Deployment

Pushes to `main` deploy via the Vercel GitHub integration, and the custom domain
follows the new production deployment automatically. Do not deploy with
`vercel --prod` from a laptop; that bypasses CI and makes the deployed commit
ambiguous.

The Vercel project is `system-design-primer-web`, matching the repo. It has
exactly one domain — `system-design-primer.rujalduwal.com.np`. If a
`*.vercel.app` alias ever reappears in the project's domains, it will be
re-aliased on every deploy and give the site a second public URL; remove it from
the **project domains**, not with `vercel alias rm`, which does not stick.
