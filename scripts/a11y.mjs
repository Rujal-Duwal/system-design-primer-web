#!/usr/bin/env node
/**
 * Accessibility audit against WCAG 2.2 Level AA.
 *
 * Runs axe-core over every kind of page, in both themes, plus the checks axe
 * cannot make on its own:
 *   - target size (2.5.8), which needs real layout boxes
 *   - reflow at 320px (1.4.10)
 *   - text spacing (1.4.12), applied as the spec's override
 *   - keyboard reachability of the simulation controls (2.1.1)
 *
 *   npm run build && node scripts/a11y.mjs
 */

import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");
const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}`;

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain",
};

function serve() {
  return createServer(async (req, res) => {
    try {
      let path = decodeURIComponent((req.url ?? "/").split("?")[0]);
      let file = join(OUT, path);
      const s = await stat(file).catch(() => null);
      if (!s || s.isDirectory()) file = join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      // Serve the real 404 page, as a static host would. Returning a bare
      // string here made axe report a missing title, lang and main landmark
      // that the actual page has.
      res.writeHead(404, { "content-type": "text/html" });
      res.end(await readFile(join(OUT, "404.html")).catch(() => "not found"));
    }
  });
}

const PAGES = [
  ["home", "/"],
  ["reference", "/reference/load-balancer/"],
  ["reference+widget", "/reference/availability-patterns/"],
  ["reference+table", "/reference/communication/"],
  ["exercise", "/exercise/pastebin/"],
  ["simulation", "/simulate/one-box/"],
  ["simulation+mode", "/simulate/cap-partition/"],
  ["404", "/reference/nope/"],
];

// WCAG 2.2 AA and below. axe tags map onto the spec levels.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const findings = [];
const record = (page, theme, id, impact, help, nodes) => {
  findings.push({ page, theme, id, impact, help, count: nodes.length, sample: nodes[0] });
};

const server = serve();
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();

try {
  /* ---- axe over every page, both themes -------------------------------- */
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: theme,
    });
    const page = await ctx.newPage();

    for (const [label, url] of PAGES) {
      await page.goto(BASE + url, { waitUntil: "networkidle" });
      await page.waitForTimeout(350);
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      for (const v of results.violations) {
        record(label, theme, v.id, v.impact, v.help, v.nodes.map((n) => n.target.join(" ")));
      }
    }
    await ctx.close();
  }

  /* ---- 2.5.8 target size (minimum), 24x24 ------------------------------ */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const small = [];
  for (const [label, url] of PAGES) {
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const boxes = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("button, a[href], input, [role='button']")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        // Inline links in prose are exempt from 2.5.8.
        const inProse = !!el.closest("p, li, figcaption, td, th");
        if (inProse && el.tagName === "A") continue;
        if (r.width < 24 || r.height < 24) {
          out.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || "").trim().slice(0, 28),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
      }
      return out;
    });
    for (const b of boxes) small.push({ page: label, ...b });
  }

  /* ---- 1.4.10 reflow at 320px ------------------------------------------ */
  await page.setViewportSize({ width: 320, height: 640 });
  const reflow = [];
  for (const [label, url] of PAGES) {
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (over > 1) reflow.push({ page: label, over });
  }

  /* ---- 1.4.12 text spacing --------------------------------------------- */
  // The spec's override: if content is lost or clipped, it fails.
  await page.setViewportSize({ width: 1440, height: 900 });
  const spacing = [];
  for (const [label, url] of PAGES) {
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
                    word-spacing: 0.16em !important; }
                p { margin-bottom: 2em !important; }`,
    });
    await page.waitForTimeout(350);
    const clipped = await page.evaluate(() => {
      let n = 0;
      for (const el of document.querySelectorAll("button, h1, h2, .nav, span, div")) {
        const s = getComputedStyle(el);
        if (s.overflow === "hidden" && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) n++;
      }
      return n;
    });
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (clipped > 0 || over > 1) spacing.push({ page: label, clipped, over });
  }

  /* ---- 2.1.1 keyboard reach on the simulation -------------------------- */
  await page.goto(`${BASE}/simulate/cap-partition/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  // Controls that cannot do anything yet are deliberately absent: "start over"
  // until something is bought, "reset run" until a run has begun. Put the page
  // into the state where all of them exist before checking they are reachable.
  // Run then pause: starting the run makes "reset run" exist, and pausing
  // re-enables the controls that are deliberately locked mid-flight, so every
  // control is present and operable at once.
  await page.getByRole("button", { name: /another replica/ }).click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "run traffic" }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "pause" }).click();
  await page.waitForTimeout(300);
  const reached = new Set();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const t = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      return (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 32);
    });
    if (t) reached.add(t);
  }
  const needed = ["run traffic", "reset run", "start over", "stay consistent", "stay available"];
  const missed = needed.filter((n) => ![...reached].some((r) => r.toLowerCase().includes(n)));

  await ctx.close();

  /* ---- report ---------------------------------------------------------- */
  console.log("WCAG 2.2 AA audit\n");

  if (findings.length) {
    const byId = new Map();
    for (const f of findings) {
      const k = `${f.id}|${f.theme}`;
      if (!byId.has(k)) byId.set(k, { ...f, pages: new Set(), total: 0 });
      const e = byId.get(k);
      e.pages.add(f.page);
      e.total += f.count;
    }
    console.log(`axe violations (${byId.size} distinct):`);
    for (const e of [...byId.values()].sort((a, b) => b.total - a.total)) {
      console.log(`  [${e.impact}] ${e.id} (${e.theme}) — ${e.total} nodes across ${e.pages.size} page(s)`);
      console.log(`      ${e.help}`);
      console.log(`      e.g. ${e.sample}`);
    }
  } else {
    console.log("axe violations: none");
  }

  console.log(`\ntarget size < 24px (2.5.8): ${small.length}`);
  const uniq = new Map();
  for (const s of small) {
    const k = `${s.tag}:${s.text}:${s.w}x${s.h}`;
    if (!uniq.has(k)) uniq.set(k, s);
  }
  for (const s of uniq.values()) console.log(`  ${s.w}x${s.h}  <${s.tag}> "${s.text}"  (${s.page})`);

  console.log(`\nreflow overflow at 320px (1.4.10): ${reflow.length}`);
  for (const r of reflow) console.log(`  ${r.page}: ${r.over}px`);

  console.log(`\ntext spacing problems (1.4.12): ${spacing.length}`);
  for (const s of spacing) console.log(`  ${s.page}: clipped=${s.clipped} overflow=${s.over}px`);

  console.log(`\nkeyboard unreachable controls (2.1.1): ${missed.length}`);
  for (const m of missed) console.log(`  ${m}`);

  const total = findings.length + uniq.size + reflow.length + spacing.length + missed.length;
  console.log(`\n${total === 0 ? "clean" : `${total} issue group(s) to address`}`);
  process.exit(total === 0 ? 0 : 1);
} finally {
  await browser.close();
  server.close();
}
