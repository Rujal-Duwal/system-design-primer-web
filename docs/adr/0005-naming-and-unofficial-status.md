# 0005 — Name the site after the primer, state provenance once

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
`system-design-primer.rujalduwal.com.np`, and state provenance **once, clearly**,
in the sidebar footer that appears on every page:

> Content from donnemartin/system-design-primer · CC BY 4.0. An independent
> project, not affiliated with its authors.

Plus the first line of the README, and the full detail in `LICENSE`.

Deliberately **not** everywhere else. A first pass put a disclaimer in the
tagline, the meta description, the Open Graph card and the README as well —
a reader met it twice per page and twice more in link previews. That reads as
apologetic, and it spent the most prominent line on the page saying what the
site is *not*. The tagline now says what it does: *"run it, don't just read it"*.

CC BY 4.0 requires attribution, a licence link, and an indication that changes
were made. It does not require the word "unofficial". The non-affiliation line
is there because the site carries the upstream name, and one clear statement
discharges that.

Hosting on a personal subdomain does part of the work already — the URL reads as
one person's project, not an official property.

Assert the sidebar statement in `scripts/smoke.mjs` so it cannot be dropped
silently.

## Consequences

- A reader arriving from the issue knows what the site covers before it loads.
- The relationship to the upstream project is stated on every page, in the one
  place a reader looks for provenance, without crowding what the site is for.
- The statement is load-bearing. Removing it fails the smoke test rather than
  shipping quietly — this is the main reason the assertion exists.
- The name is long. It wraps in the 252px sidebar and takes the smallest type on
  the mobile bar, both of which were laid out for a much shorter wordmark.
- If the upstream maintainer objects to the naming, the fix is a rename across
  roughly six strings plus a domain alias. Nothing structural depends on it.
- Supersedes the earlier `scale-it` naming. The hosting project retains that
  name internally; it is not user-visible.
