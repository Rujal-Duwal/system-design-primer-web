# 0005 — Name the site after the primer, disclaim loudly

**Status:** Accepted · 2026-08-16

## Context

The project was first called **scale-it**, and the earliest build carried that
through to the wordmark, package name and deployment.

Two problems surfaced when choosing a permanent domain.

`scale-it` says nothing about the subject. The one place this link will be posted
is a GitHub issue about the system design primer, and a reader seeing
`scale-it.rujalduwal.com.np` has no idea what they are clicking.

The obvious alternative — naming it after the primer — risks reading as the
*official* site. The primer is donnemartin's work, reused here under CC BY 4.0,
with no affiliation or endorsement. A name that implies otherwise misrepresents
the relationship regardless of intent.

## Decision

Name the site **`system-design-primer`**, served from
`system-design-primer.rujalduwal.com.np`, and carry the disclaimer everywhere the
name goes:

- **Tagline**, beside the wordmark on every page: *"simulated · an unofficial companion"*
- **Sidebar footer**: *"An unofficial companion to donnemartin/system-design-primer · CC BY 4.0. Not affiliated with the upstream project."*
- **Meta description and Open Graph**, so it appears in search results and link previews
- **README**, in the first line

Hosting on a personal subdomain rather than a bare domain does part of this work
already — the URL reads as one person's project, not an official property.

Assert the sidebar disclaimer in `scripts/smoke.mjs`.

## Consequences

- A reader arriving from the issue knows what the site covers before it loads.
- The relationship to the upstream project is stated on every page, not buried in
  a footer on one.
- The disclaimer is load-bearing. Removing it fails the smoke test rather than
  shipping quietly — this is the main reason the assertion exists.
- The name is long. It wraps in the 252px sidebar and takes the smallest type on
  the mobile bar, both of which were laid out for a much shorter wordmark.
- If the upstream maintainer objects to the naming, the fix is a rename across
  roughly six strings plus a domain alias. Nothing structural depends on it.
- Supersedes the earlier `scale-it` naming. The hosting project retains that
  name internally; it is not user-visible.
