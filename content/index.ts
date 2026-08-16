/**
 * The single place the app reads content from.
 *
 * Authored data (summaries, simulations, groups) comes from content/authored/;
 * upstream bodies come from content/generated/, which scripts/sync.mjs writes.
 * Importing the JSON directly means it is bundled at build time — no runtime
 * fetch, and every page prerenders with its prose already in the HTML.
 */
import referenceJson from "./generated/reference.json";
import exercisesJson from "./generated/exercises.json";
import searchJson from "./generated/search-index.json";
import metaJson from "./generated/meta.json";

import { SECTION_GROUPS, SECTION_ORDER, GROUP_OF } from "./authored/sections.mjs";
import { LEVELS, COSTS, TOOL_META, SIM_OF_SECTION, HOP_MS, PX_PER_MS } from "./authored/levels.mjs";
import { LATENCIES, SOURCE } from "./authored/latencies.mjs";

import type {
  Exercise,
  Level,
  ReferenceSection,
  SearchDoc,
  SyncMeta,
} from "@/lib/types";

export const REFERENCE = referenceJson as unknown as Record<string, ReferenceSection>;
export const EXERCISES = exercisesJson as unknown as Record<string, Exercise>;
export const SEARCH_DOCS = searchJson as unknown as SearchDoc[];
export const SYNC_META = metaJson as unknown as SyncMeta;

export const LEVEL_LIST = LEVELS as unknown as Level[];
export { SECTION_GROUPS, SECTION_ORDER, GROUP_OF, COSTS, TOOL_META, SIM_OF_SECTION, HOP_MS, PX_PER_MS, LATENCIES, SOURCE };

export const REFERENCE_LIST: ReferenceSection[] = SECTION_ORDER.map(
  (k: string) => REFERENCE[k]
);
export const EXERCISE_LIST: Exercise[] = Object.values(EXERCISES);

export const REFERENCE_BY_SLUG: Record<string, ReferenceSection> = Object.fromEntries(
  REFERENCE_LIST.map((r) => [r.slug, r])
);
export const EXERCISE_BY_SLUG: Record<string, Exercise> = Object.fromEntries(
  EXERCISE_LIST.map((e) => [e.slug, e])
);

/** Reference key -> the simulation that teaches it, where one exists. */
export const SIM_INDEX_OF: Record<string, number> = SIM_OF_SECTION;

export function levelIndexBySlug(slug: string): number {
  return LEVEL_LIST.findIndex((l) => l.slug === slug);
}

/**
 * The site says "synced" only when the sync actually ran and reported nothing
 * broken. Anything else keeps the honest "sync pending" badge.
 */
export const SYNC_OK = SYNC_META.problems.length === 0;
export const SYNCED_LABEL = SYNC_OK
  ? `synced from ${SYNC_META.repo}@${SYNC_META.branch}`
  : "authored copy — not yet wired to the repo";
