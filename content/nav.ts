/**
 * The navigation index — titles, slugs and groups only.
 *
 * Client components import from here rather than from `@/content`. The full
 * content module carries every section body and every exercise step, which is
 * roughly 770 KB of JSON; pulling that into the sidebar would put it in the
 * bundle of every page on the site. Pages that actually render a body import
 * it directly and it stays in that page's prerendered output.
 */
import navJson from "./generated/nav.json";

import { SECTION_GROUPS } from "./authored/sections.mjs";
import { LEVELS, COSTS, TOOL_META } from "./authored/levels.mjs";
import { SOURCE } from "./authored/latencies.mjs";

export type NavSection = {
  key: string;
  slug: string;
  title: string;
  lede: string;
  group: string;
};

export type NavExercise = { key: string; slug: string; title: string };

const nav = navJson as unknown as { reference: NavSection[]; exercises: NavExercise[] };

export const NAV_REFERENCE = nav.reference;
export const NAV_EXERCISES = nav.exercises;

export const NAV_BY_KEY: Record<string, NavSection> = Object.fromEntries(
  NAV_REFERENCE.map((r) => [r.key, r])
);

export { SECTION_GROUPS, LEVELS, COSTS, TOOL_META, SOURCE };
