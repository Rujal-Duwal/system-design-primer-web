import type { MLCEngineInterface } from "@mlc-ai/web-llm";

import { retrieve } from "@/lib/search";
import type { SearchDoc } from "@/lib/types";

/**
 * The on-device explainer.
 *
 * Llama 3.2 1B, 879 MB, four-bit. Chosen because it is the largest model that
 * is honest to offer on a reading site: it fits the "~1 GB, once, then offline"
 * promise the gate makes, and it is flagged low-resource so it runs on
 * integrated graphics rather than only on a discrete GPU.
 *
 * It is scoped to explaining passages we hand it. A model this size answers
 * "federation or sharding?" well and "design me Twitter" badly, so the prompt
 * keeps it on the former and the UI never invites the latter.
 */
export const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
export const MODEL_SIZE_MB = 879;

export type LoadProgress = { progress: number; text: string };

export type Grounding = { doc: SearchDoc; passage: string };

let enginePromise: Promise<MLCEngineInterface> | null = null;

/**
 * True only when a WebGPU adapter is actually obtainable.
 *
 * `navigator.gpu` alone is not enough — it exists in browsers that then fail to
 * hand out an adapter (blocklisted drivers, headless, some Linux setups). The
 * gate should say "unavailable here" before a 1 GB download, not after.
 */
export async function hasWebGPU(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

export async function loadEngine(
  onProgress: (p: LoadProgress) => void
): Promise<MLCEngineInterface> {
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    // Dynamic, so neither the library nor the weights touch the initial bundle.
    const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

    return CreateWebWorkerMLCEngine(worker, MODEL_ID, {
      initProgressCallback: (report) => {
        onProgress({
          progress: Math.round((report.progress ?? 0) * 100),
          text: report.text ?? "",
        });
      },
    });
  })();

  try {
    return await enginePromise;
  } catch (err) {
    enginePromise = null;
    throw err;
  }
}

const SYSTEM_PROMPT = `You explain system design concepts using ONLY the excerpts provided.

Rules:
- Answer from the excerpts. If they do not cover the question, say so plainly and name which section the reader should open instead.
- Be concrete and brief: three or four sentences, or a short list.
- Always name the trade-off. Every technique in this material costs something.
- Never invent numbers, product names, or citations that are not in the excerpts.
- Do not attempt full system designs. Point the reader at the relevant exercise instead.`;

export function buildPrompt(question: string, grounding: Grounding[]) {
  const context = grounding
    .map((g, i) => `[${i + 1}] ${g.doc.title}\n${g.passage}`)
    .join("\n\n---\n\n");

  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `Excerpts from the system design primer:\n\n${context}\n\n---\n\nQuestion: ${question}`,
    },
  ];
}

/**
 * Streams an answer grounded in the retrieved passages. Yields the running text
 * so the overlay can render tokens as they arrive.
 */
export async function* explain(
  engine: MLCEngineInterface,
  question: string
): AsyncGenerator<{ text: string; grounding: Grounding[] }> {
  const grounding = retrieve(question);

  if (!grounding.length) {
    yield {
      text: "Nothing in the primer matches that closely enough to answer from. Try a component name — cache, shard, queue, replica — or a symptom like \"tail latency\".",
      grounding: [],
    };
    return;
  }

  const chunks = await engine.chat.completions.create({
    messages: buildPrompt(question, grounding),
    stream: true,
    temperature: 0.3,
    max_tokens: 400,
  });

  let text = "";
  for await (const chunk of chunks) {
    text += chunk.choices[0]?.delta?.content ?? "";
    yield { text, grounding };
  }
}

export function resetEngine() {
  enginePromise = null;
}
