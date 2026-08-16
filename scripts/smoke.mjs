#!/usr/bin/env node
/**
 * Browser smoke test against the built static export.
 *
 * Checks the things that only break in a real browser: the canvas actually
 * paints, the run loop moves the meters, the overlay opens on "/" and finds
 * things, the theme survives a reload, and no page logs an error.
 *
 *   npm run build && node scripts/smoke.mjs
 */

import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");
const PORT = 4321;
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
      res.writeHead(404, { "content-type": "text/html" });
      res.end(await readFile(join(OUT, "404.html")).catch(() => "not found"));
    }
  });
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const server = serve();
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(e.message));

try {
  /* --- home ------------------------------------------------------------- */
  console.log("\nhome");
  await page.goto(BASE, { waitUntil: "networkidle" });
  check("title renders", (await page.title()).includes("system-design-primer"));
  // Provenance is stated once, in the sidebar. Asserted so it cannot be
  // dropped silently in a redesign.
  check(
    "attribution and independence stated in the sidebar",
    (await page.getByText(/not affiliated with its authors/i).count()) > 0
  );
  check("sidebar lists 20 sections", (await page.locator('aside a[href^="/reference/"]').count()) === 20);
  check("sidebar lists 7 exercises", (await page.locator('aside a[href^="/exercise/"]').count()) === 7);
  check("sidebar lists 6 simulations", (await page.locator('aside a[href^="/simulate/"]').count()) === 6);

  /* --- reference -------------------------------------------------------- */
  console.log("\nreference");
  await page.goto(`${BASE}/reference/load-balancer/`, { waitUntil: "networkidle" });
  const prose = await page.locator("p").filter({ hasText: "Load balancers distribute" }).count();
  check("upstream prose rendered", prose > 0);
  const img = page.locator('img[src^="/primer-images/"]').first();
  await img.waitFor({ state: "attached", timeout: 5000 });
  const loaded = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
  check("vendored diagram loads", loaded);
  check("summary panel present", (await page.getByText("in short — written for this site").count()) === 1);
  check("sync badge says synced", (await page.getByText("synced", { exact: true }).count()) > 0);
  check("simulate cross-link present", (await page.locator('a[href="/simulate/one-box/"]').count()) > 0);

  await page.goto(`${BASE}/reference/communication/`, { waitUntil: "networkidle" });
  check("gfm table rendered", (await page.locator("table").count()) >= 2);

  /* --- availability calculator ------------------------------------------ */
  console.log("\navailability calculator");
  await page.goto(`${BASE}/reference/availability-patterns/`, { waitUntil: "networkidle" });
  // The primer rounds these to 99.8% and 99.9999%; the calculator shows the
  // exact product, so 99.8001% is the right answer, not a rounding bug.
  const total = () => page.locator("text=/^\\d+\\.?\\d*%$/").first().innerText();
  const seq = await total();
  check("99.9 * 99.9 in sequence = 99.8001%", seq === "99.8001%", seq);
  await page.getByRole("button", { name: "in parallel" }).click();
  const par = await total();
  check("99.9 + 99.9 in parallel = 99.9999%", par === "99.9999%", par);
  check("downtime restated in time", (await page.getByText(/year —/).count()) === 1);

  /* --- latency chart ---------------------------------------------------- */
  console.log("\nlatency chart");
  await page.goto(`${BASE}/reference/latency-numbers/`, { waitUntil: "networkidle" });
  check("13 latency bars", (await page.getByText("L1 cache reference").count()) > 0);

  /* --- exercise --------------------------------------------------------- */
  console.log("\nexercise");
  await page.goto(`${BASE}/exercise/pastebin/`, { waitUntil: "networkidle" });
  const openBefore = await page.locator("text=Base62").count();
  check("step 1 open, step 3 closed by default", openBefore === 0);
  await page.getByRole("button", { name: /Core components/ }).click();
  await page.waitForTimeout(150);
  check("step 3 opens on click", (await page.locator("text=Base62").count()) > 0);
  check("read: chips link to reference", (await page.locator('a[href^="/reference/"]').filter({ hasText: "read:" }).count()) > 0);

  /* --- simulation ------------------------------------------------------- */
  console.log("\nsimulation");
  await page.goto(`${BASE}/simulate/one-box/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const painted = await page.locator("canvas").evaluate((c) => {
    const ctx = c.getContext("2d");
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
    return false;
  });
  check("canvas paints the topology", painted);

  await page.getByRole("button", { name: "run traffic" }).click();
  await page.waitForTimeout(2500);
  // The screen-reader live region carries the same numbers as the meters and
  // is unambiguous to select.
  const live = await page.locator('p[aria-live="polite"]').first().innerText();
  const servedCount = Number(live.match(/(\d+) served/)?.[1] ?? 0);
  check("meters move while running", servedCount > 0, live.slice(0, 80));
  check("traffic is being dropped on one box", /(\d+) dropped/.test(live) && Number(live.match(/(\d+) dropped/)[1]) > 0);

  // Buying a part must reset the run rather than change the system mid-flight.
  await page.getByRole("button", { name: /load balancer/ }).click();
  await page.waitForTimeout(200);
  check("buying a part resets to run traffic", (await page.getByRole("button", { name: "run traffic" }).count()) > 0);
  // One server ($100) plus the balancer just bought ($80).
  check("spend updated after purchase", (await page.getByText("$180 / $400").count()) > 0);

  // The two resets have different scopes, and the labels have to keep saying
  // which is which — "reset" alone read as broken because it left the build
  // untouched and nothing visibly changed.
  await page.getByRole("button", { name: "reset run" }).click();
  await page.waitForTimeout(300);
  check("reset run keeps what you built", (await page.getByText("$180 / $400").count()) > 0);
  check(
    "reset run clears the meters",
    /Ready to run/.test(await page.locator('p[aria-live="polite"]').first().innerText())
  );
  await page.getByRole("button", { name: "start over" }).first().click();
  await page.waitForTimeout(300);
  check("start over refunds the build", (await page.getByText("$100 / $400").count()) > 0);

  /* --- hot shard -------------------------------------------------------- */
  console.log("\nhot shard");
  await page.goto(`${BASE}/simulate/hot-shard/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  check("shard palette offered", (await page.getByRole("button", { name: /another shard/ }).count()) === 1);
  check("hashing offered", (await page.getByRole("button", { name: /consistent hashing/ }).count()) === 1);
  const shardAria = await page.locator("canvas").getAttribute("aria-label");
  check("topology describes shards", /shard/i.test(shardAria ?? ""), shardAria?.slice(0, 70));

  /* --- CAP partition ---------------------------------------------------- */
  console.log("\ncap partition");
  await page.goto(`${BASE}/simulate/cap-partition/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  check("consistency choice offered", (await page.getByRole("button", { name: "stay consistent" }).count()) === 1);
  check("stale reads are in the objective", (await page.getByText(/stale reads ≤ 0/).count()) === 1);
  // AP keeps every replica answering, so the cut-off side returns old data.
  // The partition lands at 6s, so this has to run past that to see any.
  await page.getByRole("button", { name: "stay available" }).click();
  await page.getByRole("button", { name: "run traffic" }).click();
  await page.waitForTimeout(11000);
  const capLive = await page.locator('p[aria-live="polite"]').first().innerText();
  const staleCount = Number(capLive.match(/(\d+) stale reads/)?.[1] ?? 0);
  check("AP produces stale reads after the split", staleCount > 0, capLive.slice(0, 90));

  // Buying hardware can never rescue AP here, so the verdict has to say so and
  // name the way out. Without that it reads as an unwinnable level.
  await page.waitForTimeout(7000);
  const capVerdict = await page
    .locator("p")
    .filter({ hasText: /reads came back from the cut-off side/ })
    .first()
    .innerText()
    .catch(() => "");
  check(
    "stale verdict names the way out",
    /stay consistent/i.test(capVerdict) && /no number of replicas/i.test(capVerdict),
    capVerdict.slice(0, 70)
  );

  /* --- ask overlay ------------------------------------------------------ */
  console.log("\nask overlay");
  await page.goto(`${BASE}/reference/cache/`, { waitUntil: "networkidle" });
  await page.keyboard.press("/");
  await page.waitForTimeout(300);
  check("slash opens the overlay", (await page.getByPlaceholder("ask anything in the primer").count()) === 1);
  await page.getByPlaceholder("ask anything in the primer").fill("sharding");
  await page.waitForTimeout(600);
  const hitCount = await page.locator('[role="dialog"] button').filter({ hasText: /./ }).count();
  check("search returns hits for 'sharding'", hitCount > 3, `${hitCount} interactive results`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  check("enter opens the top hit", page.url().includes("/reference/"), page.url().replace(BASE, ""));
  await page.keyboard.press("/");
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("escape closes the overlay", (await page.getByPlaceholder("ask anything in the primer").count()) === 0);

  /* --- theme ------------------------------------------------------------ */
  // Playwright emulates prefers-color-scheme: light, and with nothing stored
  // the site follows the OS. So the starting theme is read, not assumed.
  console.log("\ntheme");
  const started = await page.getAttribute("html", "data-sdp-theme");
  check("follows OS preference when nothing is stored", started === "light", started);

  const other = started === "dark" ? "light" : "dark";
  await page.getByRole("button", { name: `Switch to ${other} theme` }).click();
  await page.waitForTimeout(150);
  check(`toggles to ${other}`, (await page.getAttribute("html", "data-sdp-theme")) === other);

  await page.reload({ waitUntil: "networkidle" });
  check(`${other} survives reload`, (await page.getAttribute("html", "data-sdp-theme")) === other);
  const flashed = await page.evaluate(() => document.documentElement.dataset.sdpTheme);
  check("no theme flash on load", flashed === other, flashed);

  /* --- mobile ----------------------------------------------------------- */
  console.log("\nmobile (375px)");
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 375, height: 780 });
  await mob.goto(`${BASE}/reference/load-balancer/`, { waitUntil: "networkidle" });
  const overflow = await mob.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check("no horizontal overflow", overflow <= 1, `${overflow}px`);
  check("menu button present", (await mob.getByRole("button", { name: "menu" }).count()) === 1);
  await mob.getByRole("button", { name: "menu" }).click();
  await mob.waitForTimeout(250);
  check("drawer opens", await mob.locator("aside").isVisible());
  await mob.close();

  /* --- 404 -------------------------------------------------------------- */
  console.log("\n404");
  await page.goto(`${BASE}/reference/does-not-exist/`, { waitUntil: "networkidle" });
  check("unknown section 404s cleanly", (await page.getByText("No such section.").count()) === 1);

  /* --- console ---------------------------------------------------------- */
  console.log("\nconsole");
  const real = errors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
  check("no console errors", real.length === 0, real.slice(0, 2).join(" | "));
} catch (err) {
  check("smoke run completed", false, err.message.split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error(`\nfailed:\n${failed.map((f) => `  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`).join("\n")}`);
  process.exit(1);
}
