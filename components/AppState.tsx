"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Build } from "@/lib/types";
import { FRESH_BUILD as FRESH } from "@/content/authored/levels.mjs";

const FRESH_BUILD = FRESH as Build;

type AppState = {
  /** Levels the reader has passed, persisted so progress survives a reload. */
  passed: Record<number, boolean>;
  markPassed: (level: number) => void;

  /**
   * Build state per level, held here rather than in the simulation page.
   *
   * Leaving a simulation to read the reference and coming back should keep
   * what you bought, while loading a different simulation starts fresh. With
   * real routes the page unmounts on every navigation, so the build has to
   * outlive it.
   */
  buildFor: (level: number) => Build;
  setBuild: (level: number, build: Build) => void;
  resetBuild: (level: number) => void;
  freshBuild: Build;

  askOpen: boolean;
  setAskOpen: (open: boolean) => void;

  /** What the reader chose. "system" means follow the OS, and is the default. */
  themeChoice: ThemeChoice;
  /** What that currently resolves to, for labelling. */
  theme: "dark" | "light";
  setThemeChoice: (choice: ThemeChoice) => void;
};

export type ThemeChoice = "system" | "light" | "dark";

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside <AppStateProvider>");
  return ctx;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [passed, setPassed] = useState<Record<number, boolean>>({});
  const [builds, setBuilds] = useState<Record<number, Build>>({});
  const [askOpen, setAskOpen] = useState(false);
  const [themeChoice, setChoice] = useState<ThemeChoice>("system");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [hydrated, setHydrated] = useState(false);

  // Read persisted state after mount. The theme attribute itself is already
  // applied by the bootstrap script in the document head; this only syncs the
  // React copy so the toggle label is right.
  useEffect(() => {
    try {
      const t = document.documentElement.getAttribute("data-sdp-theme");
      if (t === "light" || t === "dark") setTheme(t);
      const stored = localStorage.getItem("sdp-theme");
      if (stored === "light" || stored === "dark") setChoice(stored);
      const raw = localStorage.getItem("sdp-passed");
      if (raw) setPassed(JSON.parse(raw));
    } catch {
      /* private mode, or storage disabled — progress just will not persist */
    }
    // Only now is `themeChoice` trustworthy. Until this runs it still holds its
    // initial "system", and the effect below would apply the OS theme over a
    // stored choice the bootstrap script had already applied correctly.
    setHydrated(true);
  }, []);

  // While following the system, track it live rather than only at load. Someone
  // on a schedule that flips at sunset should see the site flip with it.
  useEffect(() => {
    if (!hydrated || themeChoice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const next = mq.matches ? "light" : "dark";
      document.documentElement.setAttribute("data-sdp-theme", next);
      setTheme(next);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [hydrated, themeChoice]);

  const markPassed = useCallback((level: number) => {
    setPassed((prev) => {
      if (prev[level]) return prev;
      const next = { ...prev, [level]: true };
      try {
        localStorage.setItem("sdp-passed", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const buildFor = useCallback(
    (level: number) => builds[level] ?? FRESH_BUILD,
    [builds]
  );

  const setBuild = useCallback((level: number, build: Build) => {
    setBuilds((prev) => ({ ...prev, [level]: build }));
  }, []);

  const resetBuild = useCallback((level: number) => {
    setBuilds((prev) => ({ ...prev, [level]: FRESH_BUILD }));
  }, []);

  const setThemeChoice = useCallback((choice: ThemeChoice) => {
    setChoice(choice);
    try {
      // Following the system is stored as no preference at all, so it stays
      // the default rather than becoming a third remembered value.
      if (choice === "system") localStorage.removeItem("sdp-theme");
      else localStorage.setItem("sdp-theme", choice);
    } catch {
      /* ignore */
    }
    if (choice === "system") return; // the matchMedia effect applies it
    document.documentElement.setAttribute("data-sdp-theme", choice);
    setTheme(choice);
  }, []);

  const value = useMemo(
    () => ({
      passed,
      markPassed,
      buildFor,
      setBuild,
      resetBuild,
      freshBuild: FRESH_BUILD,
      askOpen,
      setAskOpen,
      themeChoice,
      theme,
      setThemeChoice,
    }),
    [passed, markPassed, buildFor, setBuild, resetBuild, askOpen, themeChoice, theme, setThemeChoice]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { FRESH_BUILD };
