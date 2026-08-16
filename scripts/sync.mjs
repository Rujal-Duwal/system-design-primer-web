#!/usr/bin/env node
/**
 * Content sync.
 *
 * Fetches the primer's own markdown and turns it into the JSON this site
 * renders, so the site can never drift from the source it credits.
 *
 *   README.md                                -> the 20 reference section bodies
 *   solutions/system_design/<dir>/README.md  -> the 7 exercises' four steps
 *   images/*                                 -> vendored into public/
 *
 * What it never touches: section keys, slugs, groups, summary panels, the
 * simulations, the availability calculator, the latency chart. Those are
 * authored in content/authored/ and are the reason this site is worth reading.
 *
 * A mapped anchor that disappears upstream fails the run loudly. A section
 * must never silently vanish.
 *
 *   node scripts/sync.mjs            fetch from GitHub
 *   node scripts/sync.mjs --offline  reuse .cache/ (no network)
 */

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { fromMarkdown } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown } from "mdast-util-gfm";

import {
  SECTIONS,
  SECTION_ORDER,
  GROUP_OF,
  SECTION_BY_KEY,
  ANCHOR_ALIASES,
} from "../content/authored/sections.mjs";
import { EXERCISES } from "../content/authored/exercises.mjs";
import { SOURCE } from "../content/authored/latencies.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache");
const OUT = join(ROOT, "content/generated");
const IMG_OUT = join(ROOT, "public/primer-images");

const OFFLINE = process.argv.includes("--offline");

/* -------------------------------------------------------------------------- */
/* fetching                                                                    */
/* -------------------------------------------------------------------------- */

async function fetchText(path) {
  const cacheFile = join(CACHE, path.replace(/\//g, "__"));
  if (OFFLINE) {
    if (!existsSync(cacheFile)) throw new Error(`--offline but ${path} is not cached`);
    return readFile(cacheFile, "utf8");
  }
  const url = `${SOURCE.raw}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const text = await res.text();
  await mkdir(CACHE, { recursive: true });
  await writeFile(cacheFile, text);
  return text;
}

/* -------------------------------------------------------------------------- */
/* GitHub heading anchors                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Reproduces GitHub's heading -> anchor slug. Lowercase, drop everything that
 * is not alphanumeric / space / hyphen, then spaces to hyphens.
 * "Reverse proxy (web server)" -> "reverse-proxy-web-server"
 */
function slugifyHeading(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "-");
}

/** Flatten an mdast node to its plain text. */
function toPlainText(node) {
  if (!node) return "";
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  if (node.type === "break") return " ";
  if (node.type === "image") return node.alt || "";
  if (node.type === "html") return "";
  if (Array.isArray(node.children)) return node.children.map(toPlainText).join("");
  return "";
}

/* -------------------------------------------------------------------------- */
/* inline conversion                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `resolveLink` turns an upstream href into one of ours. Injected so the README
 * and the solution files can resolve relative links differently.
 */
function inlineFrom(nodes, ctx) {
  const out = [];
  for (const n of nodes || []) {
    switch (n.type) {
      case "text":
        out.push({ t: "text", v: n.value });
        break;
      case "inlineCode":
        out.push({ t: "code", v: n.value });
        break;
      case "strong":
        out.push({ t: "strong", c: inlineFrom(n.children, ctx) });
        break;
      case "emphasis":
        out.push({ t: "em", c: inlineFrom(n.children, ctx) });
        break;
      case "delete":
        out.push({ t: "del", c: inlineFrom(n.children, ctx) });
        break;
      case "break":
        out.push({ t: "br" });
        break;
      case "link": {
        const resolved = ctx.resolveLink(n.url);
        out.push({
          t: "link",
          href: resolved.href,
          internal: resolved.internal,
          c: inlineFrom(n.children, ctx),
        });
        break;
      }
      case "image":
        out.push({ t: "img", src: ctx.resolveImage(n.url), alt: n.alt || "" });
        break;
      case "html": {
        // Inline HTML in this corpus is only <br>, <i>, <a>, <b>. Keep the text,
        // drop the tag rather than trusting raw HTML into the page.
        const stripped = n.value.replace(/<[^>]*>/g, "");
        if (stripped.trim()) out.push({ t: "text", v: stripped });
        break;
      }
      default:
        if (n.children) out.push(...inlineFrom(n.children, ctx));
        else if (n.value) out.push({ t: "text", v: String(n.value) });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* raw HTML figure blocks                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The primer's diagrams are raw HTML, not markdown:
 *   <p align="center">
 *     <img src="images/h81n9iK.png">
 *     <br/>
 *     <i><a href=...>Source: ...</a></i>
 *   </p>
 * Pull out the image and its caption; ignore any other HTML.
 */
function figureFromHtml(value, ctx) {
  const img = value.match(/<img[^>]+src=["']?([^"'\s>]+)["']?[^>]*>/i);
  if (!img) return null;
  const src = img[1];
  if (!src.startsWith("images/")) return null;

  const altMatch = value.match(/<img[^>]+alt=["']([^"']*)["']/i);
  const caption = value
    .replace(/<img[^>]*>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const href = value.match(/<a[^>]+href=["']?([^"'\s>]+)["']?/i);

  return {
    kind: "img",
    src: ctx.resolveImage(src),
    alt: altMatch ? altMatch[1] : caption || "Diagram from the system design primer",
    caption: caption || "",
    captionHref: href ? href[1] : null,
  };
}

/* -------------------------------------------------------------------------- */
/* block conversion                                                            */
/* -------------------------------------------------------------------------- */

function listItems(node, ctx) {
  return (node.children || []).map((li) => {
    const inline = [];
    const children = [];
    for (const child of li.children || []) {
      if (child.type === "paragraph") {
        if (inline.length) inline.push({ t: "br" });
        inline.push(...inlineFrom(child.children, ctx));
      } else {
        children.push(...blocksFrom([child], ctx));
      }
    }
    return { inline, children };
  });
}

function blocksFrom(nodes, ctx) {
  const out = [];
  for (const n of nodes || []) {
    switch (n.type) {
      case "heading": {
        const text = toPlainText(n);
        out.push({ kind: "h", depth: n.depth, text, anchor: slugifyHeading(text) });
        break;
      }
      case "paragraph": {
        // A paragraph that is nothing but an image is a figure, not prose.
        const kids = (n.children || []).filter(
          (c) => !(c.type === "text" && !c.value.trim())
        );
        if (kids.length === 1 && kids[0].type === "image") {
          out.push({
            kind: "img",
            src: ctx.resolveImage(kids[0].url),
            alt: kids[0].alt || "",
            caption: kids[0].title || "",
            captionHref: null,
          });
          break;
        }
        const inline = inlineFrom(n.children, ctx);
        if (inline.length) out.push({ kind: "p", inline });
        break;
      }
      case "list":
        out.push({
          kind: n.ordered ? "ol" : "ul",
          start: n.start || 1,
          items: listItems(n, ctx),
        });
        break;
      case "code":
        out.push({ kind: "code", text: n.value, lang: n.lang || null });
        break;
      case "blockquote":
        out.push({ kind: "quote", blocks: blocksFrom(n.children, ctx) });
        break;
      case "table": {
        const rows = (n.children || []).map((row) =>
          (row.children || []).map((cell) => inlineFrom(cell.children, ctx))
        );
        if (!rows.length) break;
        out.push({
          kind: "table",
          align: n.align || [],
          head: rows[0],
          rows: rows.slice(1),
        });
        break;
      }
      case "thematicBreak":
        out.push({ kind: "hr" });
        break;
      case "html": {
        const fig = figureFromHtml(n.value, ctx);
        if (fig) out.push(fig);
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/**
 * Renumber a section's headings so they only ever step down by one.
 *
 * Upstream depths are relative to the whole README, so a section that starts at
 * `###` and contains `####` renders under our page `<h1>` as h1 -> h3 -> h4.
 * Skipping a level breaks the document outline for anyone navigating by
 * headings (WCAG 1.3.1). The nesting *shape* is what matters, not the original
 * numbers, so this maps depth onto how deeply nested the heading actually is.
 */
function normaliseHeadingDepths(blocks) {
  const stack = [];
  for (const b of blocks) {
    if (b.kind !== "h") continue;
    while (stack.length && stack[stack.length - 1] >= b.depth) stack.pop();
    stack.push(b.depth);
    // +1 because the page title is the h1.
    b.depth = Math.min(6, stack.length + 1);
  }
  return blocks;
}

/* -------------------------------------------------------------------------- */
/* section splitting                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Index every heading in the document, in order, so we can (a) find where each
 * mapped section starts and stops and (b) resolve any #anchor to the section
 * that contains it.
 */
function indexHeadings(tree) {
  const headings = [];
  tree.children.forEach((node, i) => {
    if (node.type !== "heading") return;
    const text = toPlainText(node);
    headings.push({ index: i, depth: node.depth, text, anchor: slugifyHeading(text) });
  });
  return headings;
}

function sliceSection(tree, headings, section, problems) {
  const startAt = headings.find(
    (h) => h.anchor === section.anchor && h.depth === section.headingLevel
  );
  if (!startAt) {
    // Fall back to an anchor match at any depth before giving up — upstream
    // occasionally re-levels a heading without renaming it.
    const loose = headings.find((h) => h.anchor === section.anchor);
    if (!loose) {
      problems.push(
        `reference "${section.key}": anchor #${section.anchor} not found in README.md`
      );
      return null;
    }
    problems.push(
      `reference "${section.key}": #${section.anchor} moved from h${section.headingLevel} to h${loose.depth} — update headingLevel`
    );
    return sliceFrom(tree, headings, loose, section);
  }
  return sliceFrom(tree, headings, startAt, section);
}

function sliceFrom(tree, headings, startAt, section) {
  let endIndex = tree.children.length;
  for (const h of headings) {
    if (h.index <= startAt.index) continue;
    if (section.stopAtAnchor && h.anchor === section.stopAtAnchor) {
      endIndex = h.index;
      break;
    }
    if (h.depth <= startAt.depth) {
      endIndex = h.index;
      break;
    }
  }
  return {
    // Skip the section's own heading — the page renders our authored title.
    nodes: tree.children.slice(startAt.index + 1, endIndex),
    headings: headings.filter((h) => h.index > startAt.index && h.index < endIndex),
    depth: startAt.depth,
  };
}

/* -------------------------------------------------------------------------- */
/* link resolution                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Build anchor -> { slug, anchor } for every heading in the README, mapping each
 * to whichever mapped section contains it. This is what stops an internal link
 * like (#active-passive) from 404ing: it lives inside availability-patterns, so
 * it resolves to /reference/availability-patterns#active-passive.
 */
function buildAnchorIndex(sliced) {
  const index = {};
  for (const [key, sec] of Object.entries(sliced)) {
    const section = SECTIONS.find((s) => s.key === key);
    index[section.anchor] = { slug: section.slug, anchor: null };
    for (const h of sec.headings) {
      if (index[h.anchor]) continue;
      index[h.anchor] = { slug: section.slug, anchor: h.anchor };
    }
  }
  return index;
}

function makeReadmeCtx(anchorIndex, unresolved) {
  return {
    resolveLink(url) {
      if (url.startsWith("#")) {
        const anchor = url.slice(1);
        const hit = anchorIndex[anchor];
        if (hit) {
          return {
            href: `/reference/${hit.slug}/${hit.anchor ? `#${hit.anchor}` : ""}`,
            internal: true,
          };
        }
        // A heading with no page of its own, but with an authored best match.
        const alias = ANCHOR_ALIASES[anchor];
        if (alias && SECTION_BY_KEY[alias]) {
          return { href: `/reference/${SECTION_BY_KEY[alias].slug}/`, internal: true };
        }
        // Outside any mapped section (study guide, credits, flashcards...).
        // Send it upstream rather than dropping the reader somewhere wrong.
        unresolved.add(anchor);
        return { href: `${SOURCE.url}#${anchor}`, internal: false };
      }
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return { href: url, internal: false };
      }
      // Relative repo path.
      return { href: `${SOURCE.blob}/${url.replace(/^\.?\//, "")}`, internal: false };
    },
    resolveImage,
  };
}

function makeSolutionCtx(dir, anchorIndex, unresolved) {
  const base = makeReadmeCtx(anchorIndex, unresolved);
  return {
    resolveImage,
    resolveLink(url) {
      if (url.startsWith("#")) {
        // Anchors inside a solution file point at its own headings; we render
        // the whole file, so send readers to the upstream file for those.
        return {
          href: `${SOURCE.blob}/solutions/system_design/${dir}/README.md${url}`,
          internal: false,
        };
      }
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return { href: url, internal: false };
      }
      // Solution files link back to the root README with ../../../README.md#x
      const readmeLink = url.match(/README\.md#(.+)$/);
      if (readmeLink && url.includes("..")) {
        return base.resolveLink(`#${readmeLink[1]}`);
      }
      return { href: `${SOURCE.blob}/solutions/system_design/${dir}/${url}`, internal: false };
    },
  };
}

/**
 * Every image ends up vendored under /primer-images, whatever its upstream
 * form. Three cases, and all three matter:
 *
 *   images/h81n9iK.png                    repo-relative, the common case
 *   http://i.imgur.com/BKsBnmG.png        the solution files hotlink imgur over
 *                                         plain http — mixed content a browser
 *                                         would block on an https site
 *   https://camo.githubusercontent.com/…  GitHub's proxy, with the real URL
 *                                         hex-encoded in the last path segment
 *
 * Several imgur images are also committed to the repo under the same basename,
 * so those resolve to the repo copy and never touch imgur at all.
 */
const IMAGES = { repoFiles: new Set(), jobs: new Map() };

function decodeCamo(url) {
  const hex = url.split("/").pop();
  if (!hex || !/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null;
  try {
    const decoded = Buffer.from(hex, "hex").toString("utf8");
    return /^https?:\/\//.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function resolveImage(url) {
  let src = url;
  if (src.includes("camo.githubusercontent.com")) src = decodeCamo(src) || src;

  const isExternal = /^https?:\/\//.test(src);
  const base = src.split("/").pop().split("?")[0];

  if (!isExternal) {
    const file = src.replace(/^\.?\//, "").replace(/^images\//, "");
    IMAGES.jobs.set(file, `${SOURCE.raw}/images/${file}`);
    return `/primer-images/${file}`;
  }

  // An imgur image that is also committed to the repo: prefer the repo.
  if (IMAGES.repoFiles.has(base)) {
    IMAGES.jobs.set(base, `${SOURCE.raw}/images/${base}`);
    return `/primer-images/${base}`;
  }

  // Otherwise vendor it from source, upgrading http to https on the way.
  const name = base.includes(".") ? base : `${base}.png`;
  IMAGES.jobs.set(name, src.replace(/^http:\/\//, "https://"));
  return `/primer-images/${name}`;
}

async function listRepoImages() {
  const cacheFile = join(CACHE, "images-listing.json");
  let json;
  if (OFFLINE) {
    if (!existsSync(cacheFile)) return new Set();
    json = JSON.parse(await readFile(cacheFile, "utf8"));
  } else {
    const res = await fetch(
      `https://api.github.com/repos/${SOURCE.repo}/contents/images?ref=${SOURCE.branch}`
    );
    if (!res.ok) {
      console.warn(`  ! images listing -> ${res.status}, falling back to hotlink names`);
      return new Set();
    }
    json = await res.json();
    await mkdir(CACHE, { recursive: true });
    await writeFile(cacheFile, JSON.stringify(json));
  }
  return new Set(json.filter((f) => f.type === "file").map((f) => f.name));
}

/* -------------------------------------------------------------------------- */
/* images                                                                      */
/* -------------------------------------------------------------------------- */

async function vendorImages(problems) {
  await mkdir(IMG_OUT, { recursive: true });
  const have = new Set(existsSync(IMG_OUT) ? await readdir(IMG_OUT) : []);
  let fetched = 0;
  for (const [file, url] of IMAGES.jobs) {
    if (have.has(file)) continue;
    if (OFFLINE) {
      problems.push(`image "${file}": --offline and not vendored yet`);
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) {
      // A missing diagram degrades the page but should not block a release,
      // so this is a warning with an alt-text fallback, not a hard failure.
      console.warn(`  ! image ${file} <- ${url} -> ${res.status}`);
      continue;
    }
    await writeFile(join(IMG_OUT, file), Buffer.from(await res.arrayBuffer()));
    fetched++;
  }
  return { fetched, total: IMAGES.jobs.size };
}

/* -------------------------------------------------------------------------- */
/* search index                                                                */
/* -------------------------------------------------------------------------- */

function blocksToText(blocks) {
  const parts = [];
  const inlineText = (inline) =>
    (inline || [])
      .map((i) => {
        if (i.t === "text" || i.t === "code") return i.v;
        if (i.c) return inlineText(i.c);
        return "";
      })
      .join("");

  const walk = (bs) => {
    for (const b of bs || []) {
      if (b.kind === "h") parts.push(b.text);
      else if (b.kind === "p") parts.push(inlineText(b.inline));
      else if (b.kind === "code") parts.push(b.text);
      else if (b.kind === "img") parts.push(b.alt);
      else if (b.kind === "quote") walk(b.blocks);
      else if (b.kind === "ul" || b.kind === "ol") {
        for (const item of b.items) {
          parts.push(inlineText(item.inline));
          walk(item.children);
        }
      } else if (b.kind === "table") {
        for (const row of [b.head, ...b.rows]) {
          parts.push(row.map(inlineText).join(" "));
        }
      }
    }
  };
  walk(blocks);
  return parts.join("\n");
}

/* -------------------------------------------------------------------------- */
/* main                                                                        */
/* -------------------------------------------------------------------------- */

function parse(markdown) {
  return fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
}

async function main() {
  const problems = [];
  const unresolved = new Set();

  console.log(OFFLINE ? "sync (offline, using .cache)" : "sync from github");

  // Known before any conversion, so an imgur hotlink can prefer the repo copy.
  IMAGES.repoFiles = await listRepoImages();

  /* ---- reference sections ---- */
  const readme = await parse(await fetchText("README.md"));
  const headings = indexHeadings(readme);
  console.log(`  README.md: ${headings.length} headings`);

  const sliced = {};
  for (const section of SECTIONS) {
    const slice = sliceSection(readme, headings, section, problems);
    if (slice) sliced[section.key] = slice;
  }

  const anchorIndex = buildAnchorIndex(sliced);
  const ctx = makeReadmeCtx(anchorIndex, unresolved);

  const reference = {};
  for (const section of SECTIONS) {
    const slice = sliced[section.key];
    const body = slice ? normaliseHeadingDepths(blocksFrom(slice.nodes, ctx)) : [];
    if (slice && body.length === 0) {
      problems.push(`reference "${section.key}": #${section.anchor} resolved but produced no blocks`);
    }
    reference[section.key] = {
      key: section.key,
      slug: section.slug,
      title: section.title,
      anchor: section.anchor,
      group: GROUP_OF[section.key],
      lede: section.lede,
      rows: section.rows,
      calc: !!section.calc,
      latency: !!section.latency,
      link: `${SOURCE.url}#${section.anchor}`,
      body,
    };
  }

  /* ---- exercises ---- */
  const exercises = {};
  for (const ex of EXERCISES) {
    const path = `solutions/system_design/${ex.dir}/README.md`;
    const tree = await parse(await fetchText(path));
    const exHeadings = indexHeadings(tree);
    const exCtx = makeSolutionCtx(ex.dir, anchorIndex, unresolved);

    const steps = ex.steps.map((step, i) => {
      const heading = exHeadings.find(
        (h) => h.depth === 2 && /^step\s*\d/i.test(h.text) && h.text.includes(String(i + 1))
      );
      if (!heading) {
        problems.push(`exercise "${ex.key}": no "## Step ${i + 1}" heading in ${path}`);
        return { ...step, body: [] };
      }
      const slice = sliceFrom(tree, exHeadings, heading, {});
      return {
        label: step.label,
        refs: step.refs,
        lede: step.lede,
        upstreamTitle: heading.text,
        body: normaliseHeadingDepths(blocksFrom(slice.nodes, exCtx)),
      };
    });

    exercises[ex.key] = {
      key: ex.key,
      slug: ex.slug,
      title: ex.title,
      statement: ex.statement,
      constraints: ex.constraints,
      file: path,
      link: `${SOURCE.blob}/${path}`,
      steps,
    };
  }

  /* ---- images ---- */
  // resolveImage registered every referenced file while converting blocks.
  const img = await vendorImages(problems);

  /* ---- search index ---- */
  const searchIndex = [
    ...SECTION_ORDER.map((key) => {
      const r = reference[key];
      return {
        id: `ref:${key}`,
        view: "reference",
        slug: r.slug,
        title: r.title,
        kind: r.group,
        snippet: r.lede,
        text: [r.title, r.lede, r.rows.map((x) => `${x.k} ${x.v}`).join("\n"), blocksToText(r.body)].join("\n"),
      };
    }),
    ...EXERCISES.map((ex) => {
      const e = exercises[ex.key];
      return {
        id: `ex:${ex.key}`,
        view: "exercise",
        slug: e.slug,
        title: e.title,
        kind: "exercise",
        snippet: e.statement,
        text: [
          e.title,
          e.statement,
          e.constraints.join("\n"),
          e.steps.map((s) => [s.label, s.lede.join("\n"), blocksToText(s.body)].join("\n")).join("\n"),
        ].join("\n"),
      };
    }),
  ];

  /* ---- write ---- */
  await mkdir(OUT, { recursive: true });
  const syncedAt = new Date().toISOString();
  const meta = {
    syncedAt,
    repo: SOURCE.repo,
    branch: SOURCE.branch,
    licence: SOURCE.licence,
    sections: Object.keys(reference).length,
    exercises: Object.keys(exercises).length,
    images: img.total,
    problems,
    unresolvedAnchors: [...unresolved].sort(),
  };

  /**
   * A tiny index for the sidebar, the exercise chips and the debrief links.
   *
   * These all run in client components, and importing the full reference from
   * one would pull every section body — about 770 KB of JSON — into the bundle
   * of every page. Navigation only needs titles and slugs, so it gets its own
   * file and the bodies stay on the pages that render them.
   */
  const nav = {
    reference: SECTION_ORDER.map((key) => ({
      key,
      slug: reference[key].slug,
      title: reference[key].title,
      lede: reference[key].lede,
      group: reference[key].group,
    })),
    exercises: EXERCISES.map((ex) => ({
      key: ex.key,
      slug: ex.slug,
      title: ex.title,
    })),
  };

  await writeFile(join(OUT, "nav.json"), JSON.stringify(nav, null, 1));
  await writeFile(join(OUT, "reference.json"), JSON.stringify(reference, null, 1));
  await writeFile(join(OUT, "exercises.json"), JSON.stringify(exercises, null, 1));
  await writeFile(join(OUT, "search-index.json"), JSON.stringify(searchIndex, null, 1));
  await writeFile(join(OUT, "meta.json"), JSON.stringify(meta, null, 2));

  /* ---- report ---- */
  const blocks = Object.values(reference).reduce((n, r) => n + r.body.length, 0);
  const stepBlocks = Object.values(exercises).reduce(
    (n, e) => n + e.steps.reduce((m, s) => m + s.body.length, 0),
    0
  );
  console.log(`  reference: ${Object.keys(reference).length} sections, ${blocks} blocks`);
  console.log(`  exercises: ${Object.keys(exercises).length} problems, ${stepBlocks} blocks`);
  console.log(`  images:    ${img.total} used, ${img.fetched} newly fetched`);
  if (unresolved.size) {
    console.log(`  note:      ${unresolved.size} anchors outside mapped sections -> upstream`);
  }

  if (problems.length) {
    console.error(`\n  BROKEN CONTENT MAPPING (${problems.length}):`);
    for (const p of problems) console.error(`    - ${p}`);
    console.error(
      "\n  The upstream README moved. Fix content/authored/sections.mjs — do not let a section vanish.\n"
    );
    process.exit(1);
  }
  console.log("  ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
