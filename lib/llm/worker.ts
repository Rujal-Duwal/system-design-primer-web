/**
 * The on-device model runs here, not on the main thread.
 *
 * The simulation canvas is animating at 60fps behind this overlay; model load
 * and token generation on the main thread would stall it outright. WebLLM ships
 * a worker handler for exactly this, so the whole engine lives off-thread and
 * the page only ever sees messages.
 */
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
