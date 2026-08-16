"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import styles from "./Shell.module.css";
import { AppStateProvider, useApp } from "./AppState";
import { AskOverlay } from "./AskOverlay";
import {
  NAV_BY_KEY,
  NAV_EXERCISES,
  NAV_REFERENCE,
  LEVELS,
  SECTION_GROUPS,
  SOURCE,
} from "@/content/nav";
import type { Level } from "@/lib/types";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <ShellInner>{children}</ShellInner>
    </AppStateProvider>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { askOpen, setAskOpen } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation, or it covers the page you just chose.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAskOpen(false);
        setDrawerOpen(false);
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        setAskOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setAskOpen]);

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main">
        skip to content
      </a>

      <div className={styles.mobileBar}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-expanded={drawerOpen}
          aria-controls="sidebar"
        >
          {drawerOpen ? "close" : "menu"}
        </button>
        <Link href="/" className={styles.wordmark}>
          system-design-primer
        </Link>
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setAskOpen(true)}
        >
          search
        </button>
      </div>

      {drawerOpen && (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <Sidebar open={drawerOpen} />

      <main className={styles.main} id="main">
        {children}
      </main>

      {askOpen && <AskOverlay onClose={() => setAskOpen(false)} />}
    </div>
  );
}

function Sidebar({ open }: { open: boolean }) {
  const { passed, theme, toggleTheme, setAskOpen } = useApp();
  const [query, setQuery] = useState("");
  const pathname = usePathname();

  const q = query.trim().toLowerCase();

  const groups = useMemo(
    () =>
      SECTION_GROUPS.map((g: { label: string; keys: string[] }) => ({
        label: g.label,
        items: g.keys
          .map((k) => NAV_BY_KEY[k])
          .filter(
            (r) =>
              !q ||
              r.title.toLowerCase().includes(q) ||
              r.lede.toLowerCase().includes(q)
          ),
      })).filter((g) => g.items.length > 0),
    [q]
  );

  const isActive = (href: string) => pathname === href || pathname === `${href}/`;

  return (
    <aside
      id="sidebar"
      className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}
      aria-label="Sections"
    >
      <div className={styles.brand}>
        <div>
          <Link href="/" className={styles.wordmark}>
            system-design-primer
          </Link>
          <div className={styles.tagline}>run it, don&rsquo;t just read it</div>
        </div>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? "light" : "dark"}
        </button>
      </div>

      <div className={styles.groupLabel}>simulations</div>
      <div className={styles.list}>
        {(LEVELS as Level[]).map((lv, i) => {
          const href = `/simulate/${lv.slug}/`;
          return (
            <Link
              key={lv.slug}
              href={href}
              className={`${styles.nav} ${isActive(href) ? styles.navActive : ""}`}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <span className={styles.navLeft}>
                <span className={styles.navNum}>{String(i + 1).padStart(2, "0")}</span>
                <span>{lv.title}</span>
              </span>
              {passed[i] && (
                <span className={styles.navMark} aria-label="passed">
                  ✓
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className={styles.groupLabelRow}>
        <span>reference</span>
        <span className={styles.count}>{NAV_REFERENCE.length} sections</span>
      </div>
      <div className={styles.filterWrap}>
        <label className="sr-only" htmlFor="section-filter">
          Filter sections
        </label>
        <input
          id="section-filter"
          type="text"
          className={styles.filter}
          placeholder="filter sections"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={styles.list}>
        {groups.map((g) => (
          <div key={g.label} className={styles.list}>
            <div className={styles.subGroup}>{g.label}</div>
            {g.items.map((r) => {
              const href = `/reference/${r.slug}/`;
              return (
                <Link
                  key={r.key}
                  href={href}
                  className={`${styles.nav} ${isActive(href) ? styles.navActive : ""}`}
                  aria-current={isActive(href) ? "page" : undefined}
                >
                  <span>{r.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && (
          <div className={styles.empty}>
            Nothing matches “{query}”. Try a component name — cache, shard, queue.
          </div>
        )}
      </div>

      <div className={styles.groupLabel} style={{ paddingTop: 4 }}>
        exercises
      </div>
      <div className={styles.list} style={{ paddingBottom: 22 }}>
        {NAV_EXERCISES.map((ex) => {
          const href = `/exercise/${ex.slug}/`;
          return (
            <Link
              key={ex.key}
              href={href}
              className={`${styles.nav} ${isActive(href) ? styles.navActive : ""}`}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <span>{ex.title}</span>
            </Link>
          );
        })}
      </div>

      <div className={styles.askWrap}>
        <button type="button" className={styles.askButton} onClick={() => setAskOpen(true)}>
          <span>ask the primer</span>
          <span className={styles.askHint}>/</span>
        </button>
      </div>

      {/* The one place provenance is stated. Persistent, factual, and enough:
          attribution, licence, and that this is not the upstream project. */}
      <div className={styles.attribution}>
        Content from <a href={SOURCE.url}>donnemartin/system-design-primer</a> ·{" "}
        {SOURCE.licence}. An independent project, not affiliated with its authors.
        Simulation is a teaching model, not a benchmark.
      </div>
    </aside>
  );
}
