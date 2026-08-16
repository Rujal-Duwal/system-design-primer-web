/**
 * Loads the real simulation engine into Node.
 *
 * The engine is TypeScript and imports through the `@/` alias, so it is bundled
 * on the fly rather than duplicated here. Duplicating it would defeat the
 * purpose: the tuning check has to exercise the same code the browser runs, or
 * it proves nothing.
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const dir = await mkdtemp(join(tmpdir(), "sdp-sim-"));
const outfile = join(dir, "engine.mjs");

await build({
  entryPoints: [join(ROOT, "lib/sim/engine.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile,
  logLevel: "warning",
  alias: { "@": ROOT },
  loader: { ".json": "json" },
});

const mod = await import(pathToFileURL(outfile).href);
await rm(dir, { recursive: true, force: true });

export const { SimEngine } = mod;
