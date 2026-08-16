# 0003 — Simulation state lives outside React

**Status:** Accepted · 2026-08-16

## Context

The four simulations animate a few hundred request packets moving between nodes,
each with a position, a service timer, a queue slot and a colour by kind, on a
full-bleed canvas targeting 60fps.

Holding packets in React state would mean a state update and reconciliation pass
per frame over hundreds of objects. It will not hold frame rate.

There is a second, subtler problem. Once routes exist, the simulation page
unmounts every time the reader navigates away. Leaving a simulation to read a
reference section and coming back should preserve what you built — that is the
whole point of the cross-links between the two — while loading a *different*
simulation should start fresh. Naive component state loses the build on every
navigation.

## Decision

`lib/sim/engine.ts` is a **plain class**, not a hook or a component. It owns
packets, nodes, timers and metrics as mutable fields driven by
`requestAnimationFrame`, and reports metrics to React through a callback
throttled to roughly 8 times a second.

**Build state is hoisted into `AppState`**, a provider in the root layout, keyed
by level index — so it outlives the page component.

The engine exposes `runHeadless()`, which runs a full simulation at a fixed
timestep with no canvas and no rAF.

## Consequences

- Frame rate holds, and React re-renders only when a displayed number changes.
- The engine is testable without a DOM. `scripts/verify-levels.mjs` runs every
  level 12 times and asserts each fails with the starting build and passes with
  the intended one, exercising the same code the browser runs via an esbuild
  bundle. A level that stops teaching its lesson fails CI.
- The engine is imperative and does not follow React's data flow. Changing it
  means understanding `step()` and `draw()` directly; there is no declarative
  seam.
- Because the engine holds a reference to the build, `buy()` must push changes
  into it explicitly. Forgetting that would leave the canvas showing a topology
  that no longer matches the palette.
- Canvas rendering has no accessibility affordances of its own, so the topology
  and live metrics are mirrored into a screen-reader live region.
