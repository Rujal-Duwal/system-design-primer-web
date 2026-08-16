"use client";

import Link from "next/link";

import page from "./Page.module.css";
import { useApp } from "./AppState";

/**
 * The contextual simulation link on a reference page.
 *
 * Reads "simulate:" the first time and "replay:" once the reader has passed it,
 * which needs client state — hence its own component rather than inlining the
 * link in the prerendered page.
 */
export function SimLink({
  slug,
  title,
  index,
}: {
  slug: string;
  title: string;
  index: number;
}) {
  const { passed } = useApp();
  return (
    <Link className={page.simButton} href={`/simulate/${slug}/`}>
      {passed[index] ? "replay" : "simulate"}: {title} →
    </Link>
  );
}
