"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./Ask.module.css";
import { hrefFor, loadIndex, search } from "@/lib/search";
import { MODEL_SIZE_MB, hasWebGPU, loadEngine, explain, type Grounding } from "@/lib/llm/engine";
import type { MLCEngineInterface } from "@mlc-ai/web-llm";

type Mode = "find" | "explain";
type ModelState = "idle" | "loading" | "ready" | "error";

/** Real queries, so an empty field is never the only thing on offer. */
const FIND_EXAMPLES = ["cache invalidation", "sharding", "back pressure", "CAP"];
const EXPLAIN_EXAMPLES = [
  "when should I shard instead of federating?",
  "why does a queue lower p99?",
  "what does a cache actually cost me?",
];

export function AskOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("find");

  const [gpu, setGpu] = useState<boolean | null>(null);
  const [model, setModel] = useState<ModelState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [answer, setAnswer] = useState("");
  const [grounding, setGrounding] = useState<Grounding[]>([]);
  const [thinking, setThinking] = useState(false);

  const engineRef = useRef<MLCEngineInterface | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);

  // The index is fetched on first open rather than bundled with every page.
  const [indexReady, setIndexReady] = useState(false);
  const hits = useMemo(
    () => (indexReady ? search(query) : []),
    [query, indexReady]
  );

  useEffect(() => {
    inputRef.current?.focus();
    hasWebGPU().then(setGpu);
    let live = true;
    loadIndex().then(() => {
      if (live) setIndexReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const startLoad = useCallback(async () => {
    if (model === "loading" || model === "ready") return;
    setModel("loading");
    setError(null);
    try {
      engineRef.current = await loadEngine((p) => {
        setProgress(p.progress);
        setProgressText(p.text);
      });
      setModel("ready");
    } catch (err) {
      setModel("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [model]);

  const ask = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !query.trim()) return;
    const runId = ++runIdRef.current;
    setThinking(true);
    setAnswer("");
    setGrounding([]);
    try {
      for await (const step of explain(engine, query)) {
        if (runIdRef.current !== runId) return; // a newer question superseded this one
        setAnswer(step.text);
        setGrounding(step.grounding);
      }
    } catch (err) {
      if (runIdRef.current === runId) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (runIdRef.current === runId) setThinking(false);
    }
  }, [query]);

  /** What Enter and the submit button both do. */
  const submit = useCallback(() => {
    if (!query.trim()) return;
    if (mode === "explain" && model === "ready") {
      void ask();
      return;
    }
    if (hits.length) {
      router.push(hrefFor(hits[0].doc));
      onClose();
    }
  }, [query, mode, model, ask, hits, router, onClose]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    submit();
  };

  const go = (href: string) => {
    router.push(href);
    onClose();
  };

  const modelStatus =
    gpu === false
      ? "webgpu unavailable"
      : model === "ready"
        ? "model ready · on-device"
        : model === "loading"
          ? `downloading ${progress}%`
          : model === "error"
            ? "model failed to load"
            : "model not loaded";

  const showGate = mode === "explain" && model !== "ready";

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Ask the primer"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        {/* A titled dialog bar. Without it the input was the topmost thing in
            the panel and read as a heading rather than a field. */}
        <div className={styles.titleBar}>
          <h2 className={styles.title}>ask the primer</h2>
          <button type="button" className={styles.close} onClick={onClose}>
            close <kbd className={styles.kbd}>esc</kbd>
          </button>
        </div>

        {/* Mode before the field: decide what kind of answer you want, then
            write the question. The other order made the tabs look like they
            were filtering results that did not exist yet. */}
        <div className={styles.modeRow}>
          <div className={styles.tabs} role="group" aria-label="Answer mode">
            <button
              type="button"
              className={`${styles.tab} ${mode === "find" ? styles.tabActive : ""}`}
              onClick={() => setMode("find")}
              aria-pressed={mode === "find"}
            >
              find sections
            </button>
            <button
              type="button"
              className={`${styles.tab} ${mode === "explain" ? styles.tabActive : ""}`}
              onClick={() => setMode("explain")}
              aria-pressed={mode === "explain"}
            >
              explain on-device
            </button>
          </div>
          <span
            className={`${styles.status} ${model === "ready" ? styles.statusReady : ""}`}
            aria-live="polite"
          >
            {modelStatus}
          </span>
        </div>

        {/* The composer. A visible box with a label and a submit button, so
            there is no question about where the typing goes. */}
        <div className={styles.composer}>
          <label className={styles.composerLabel} htmlFor="ask-input">
            {mode === "explain" ? "your question" : "search for"}
          </label>
          <div className={styles.field}>
            <input
              id="ask-input"
              ref={inputRef}
              type="text"
              className={styles.input}
              placeholder={
                mode === "explain"
                  ? "e.g. when should I shard instead of federating?"
                  : "e.g. cache invalidation"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              className={styles.submit}
              onClick={submit}
              disabled={!query.trim() || (mode === "explain" && model !== "ready")}
            >
              {mode === "explain" ? "ask" : "open"} <span aria-hidden="true">⏎</span>
            </button>
          </div>

          {/* A blank field is the hardest thing to answer. These are real
              queries, one click away. */}
          {!query.trim() && (
            <div className={styles.examples}>
              <span className={styles.examplesLabel}>try</span>
              {(mode === "explain" ? EXPLAIN_EXAMPLES : FIND_EXAMPLES).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className={styles.example}
                  onClick={() => {
                    setQuery(ex);
                    inputRef.current?.focus();
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {showGate && (
          <div className={styles.gate}>
            <p className={styles.gateText}>{gateCopy(gpu, model, error)}</p>
            <div className={styles.gateActions}>
              <button
                type="button"
                className={styles.gateButton}
                onClick={startLoad}
                disabled={gpu === false || model === "loading"}
              >
                {gpu === false
                  ? "unavailable here"
                  : model === "loading"
                    ? "downloading…"
                    : model === "error"
                      ? "try again"
                      : `download model (~${Math.round(MODEL_SIZE_MB / 100) / 10} GB)`}
              </button>
              {model === "loading" && (
                <div className={styles.progressWrap}>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                  </div>
                  {progressText && <div className={styles.progressText}>{progressText}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.results}>
          {mode === "explain" && model === "ready" && (
            <div className={styles.answerWrap}>
              {thinking && !answer && <p className={styles.hint}>reading the primer…</p>}
              {answer && (
                <>
                  <p className={styles.answer}>{answer}</p>
                  {grounding.length > 0 && (
                    <div className={styles.grounding}>
                      <div className={styles.groundingLabel}>grounded in</div>
                      <div className={styles.chips}>
                        {grounding.map((g) => (
                          <button
                            key={g.doc.id}
                            type="button"
                            className={styles.chip}
                            onClick={() => go(hrefFor(g.doc))}
                          >
                            {g.doc.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {hits.length > 0 ? (
            <div className={styles.hitList}>
              {mode === "explain" && model === "ready" && (
                <div className={styles.hitsLabel}>sections that match</div>
              )}
              {hits.map((hit) => (
                <button
                  key={hit.doc.id}
                  type="button"
                  className={styles.hit}
                  onClick={() => go(hrefFor(hit.doc))}
                >
                  <div className={styles.hitHead}>
                    <span className={styles.hitTitle}>{hit.doc.title}</span>
                    <span className={styles.hitKind}>{hit.doc.kind}</span>
                  </div>
                  <div className={styles.hitSnippet}>{hit.snippet}</div>
                </button>
              ))}
            </div>
          ) : (
            /* With nothing typed in explain mode the composer's examples are
               the instruction; a line about searching would contradict them. */
            (query.trim() || mode === "find") && (
              <p className={styles.empty}>
                {!indexReady
                  ? "loading the index…"
                  : query.trim()
                    ? "Nothing in the primer matches that. Try a component name — cache, shard, queue, replica — or a symptom, like “tail latency”."
                    : "Searching 20 reference sections and 7 exercises."}
              </p>
            )
          )}
        </div>

        {/* Precise on purpose. The site does send cookieless pageview counts,
            so "nothing leaves the browser" would be too broad a claim — but
            search and the model both run locally, and the question itself
            genuinely never goes anywhere. */}
        <div className={styles.footer}>
          Answers are grounded in the synced primer text only. Your question never leaves
          the browser.
        </div>
      </div>
    </div>
  );
}

function gateCopy(gpu: boolean | null, model: ModelState, error: string | null) {
  if (gpu === false) {
    return "This browser has no WebGPU, so the on-device model cannot run. Finding sections still works — it is a local index over the same text and needs no model at all.";
  }
  if (model === "error") {
    return `The model failed to load${error ? `: ${error}` : ""}. Finding sections is unaffected and still searches the full text.`;
  }
  if (model === "loading") {
    return "Downloading weights. This happens once and is cached by the browser; the tab stays usable and the simulation keeps running.";
  }
  return "Explaining runs a small language model in this tab over the synced primer text. It downloads about 1 GB once, then works offline with nothing sent to a server. Finding sections needs none of that.";
}
