# 0004 — On-device LLM, lazily loaded, in a worker

**Status:** Accepted · 2026-08-16

## Context

The site has an "ask the primer" overlay with two modes: find sections, and
explain on-device. The explain mode makes a specific promise — a model runs in
the tab, grounded only in the synced primer text, with nothing sent to a server.

That promise is only worth making if it is kept, which constrains the
implementation more than it first appears:

- A server-side model would break the promise outright and require a backend that
  [ADR-0001](0001-static-export-standalone-repo.md) rules out.
- Model weights are large. Putting them, or even the runtime library, in the
  initial bundle would tax every reader for a feature most will never use.
- Running inference on the main thread would stall the simulation canvas, which
  is animating behind the overlay.
- An embedding model for retrieval would mean a *second* download.
- `navigator.gpu` existing does not mean WebGPU works. Browsers expose it and
  then fail to return an adapter on blocklisted drivers, so sniffing the property
  reports false readiness — and here that means promising a 1 GB download that
  cannot run.

## Decision

Use **`@mlc-ai/web-llm`** with `Llama-3.2-1B-Instruct-q4f16_1-MLC` — 879 MB,
four-bit, flagged `low_resource_required` so it runs on integrated graphics. The
size is what makes the "~1 GB, once, then offline" wording on the gate honest.

- Run it in a **web worker** via `CreateWebWorkerMLCEngine`.
- **Dynamically import** the library, so neither it nor the weights touch the
  initial bundle.
- Detect WebGPU by **actually requesting an adapter**, not by checking
  `navigator.gpu`.
- Ground answers with the **same lexical index** that powers find mode — top
  passages stuffed into the prompt. No embedding model.
- Keep find mode fully functional with no model and no WebGPU.
- Scope the system prompt to explaining supplied excerpts, and instruct it to
  decline full system designs and point at the relevant exercise instead.

## Consequences

- The privacy claim in the footer is literally true: retrieval and inference both
  happen in the tab.
- The library lands in a ~6 MB chunk that no page references until the reader
  opts in.
- The canvas keeps animating while the model loads and generates.
- Search and the model can never disagree about what the primer says, because
  they read the same index.
- A 1B model is weak. It is adequate for "federation or sharding?" and poor at
  open-ended design, which is why the prompt and the UI both steer away from the
  latter. Answer quality is the accepted trade for the privacy guarantee.
- Readers without WebGPU lose explain mode entirely. Find mode is the primary
  path for exactly this reason, and the gate says so plainly rather than failing
  after a long download.
- Weights come from a third-party CDN at runtime, the one external dependency the
  site has. It is opt-in and behind an explicit gate.
