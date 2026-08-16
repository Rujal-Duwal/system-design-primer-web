"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Build } from "@/lib/types";

const FRESH_BUILD: Build = { servers: 1, lb: false, cache: false, queue: false };

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

  askOpen: boolean;
  setAskOpen: (open: boolean) => void;

  theme: "dark" | "light";
  toggleTheme: () => void;
};

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
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const hydrated = useRef(false);

  // Read persisted state after mount. The theme attribute itself is already
  // applied by the bootstrap script in the document head; this only syncs the
  // React copy so the toggle label is right.
  useEffect(() => {
    hydrated.current = true;
    try {
      const t = document.documentElement.getAttribute("data-sdp-theme");
      if (t === "light" || t === "dark") setTheme(t);
      const raw = localStorage.getItem("sdp-passed");
      if (raw) setPassed(JSON.parse(raw));
    } catch {
      /* private mode, or storage disabled — progress just will not persist */
    }
  }, []);

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

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-sdp-theme", next);
      try {
        localStorage.setItem("sdp-theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      passed,
      markPassed,
      buildFor,
      setBuild,
      resetBuild,
      askOpen,
      setAskOpen,
      theme,
      toggleTheme,
    }),
    [passed, markPassed, buildFor, setBuild, resetBuild, askOpen, theme, toggleTheme]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { FRESH_BUILD };
