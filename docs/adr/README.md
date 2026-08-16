# Architecture decision records

Short records of decisions that were not obvious, written so that someone
changing them later knows what they are trading away.

Format: Context → Decision → Consequences. A record is immutable once accepted;
if a decision is reversed, add a new record that supersedes it rather than
editing the old one.

| # | Decision | Status |
|---|---|---|
| [0001](0001-static-export-standalone-repo.md) | Standalone repo, static export, no backend | Accepted |
| [0002](0002-content-sync-from-upstream.md) | Rebuild upstream content from source at build time | Accepted |
| [0003](0003-simulation-outside-react-state.md) | Simulation state lives outside React | Accepted |
| [0004](0004-on-device-llm-in-a-worker.md) | On-device LLM, lazily loaded, in a worker | Accepted |
| [0005](0005-naming-and-unofficial-status.md) | Name the site after the primer, state provenance once | Accepted |
| [0006](0006-split-content-and-nav-bundles.md) | Split the content bundle from the navigation bundle | Accepted |
