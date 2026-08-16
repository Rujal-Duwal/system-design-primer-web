import Link from "next/link";
import { Fragment } from "react";

import styles from "./Blocks.module.css";
import type { Block, Inline, ListItem } from "@/lib/types";

/**
 * Renders the synced upstream markdown.
 *
 * Everything goes through React elements — the sync produces a block tree, not
 * an HTML string, so nothing from the upstream repo is ever injected as raw
 * HTML. That is deliberate: the site rebuilds from whatever the README says
 * today, and a compromised or merely careless upstream edit should not be able
 * to put markup on the page.
 */

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className={styles.body}>
      {blocks.map((b, i) => (
        <BlockNode key={i} block={b} />
      ))}
    </div>
  );
}

function BlockNode({ block }: { block: Block }) {
  switch (block.kind) {
    case "h": {
      const Tag = (`h${Math.min(6, Math.max(2, block.depth))}` as "h2");
      return (
        <Tag
          id={block.anchor}
          className={`${styles.h} ${styles[`h${block.depth}`] ?? ""}`}
        >
          {block.text}
        </Tag>
      );
    }

    case "p":
      return (
        <p className={styles.p}>
          <Inlines nodes={block.inline} />
        </p>
      );

    case "ul":
    case "ol":
      return (
        <ul className={styles.list}>
          {block.items.map((item, i) => (
            <Item
              key={i}
              item={item}
              marker={block.kind === "ol" ? `${(block.start ?? 1) + i}.` : "·"}
            />
          ))}
        </ul>
      );

    case "code":
      return <pre className={styles.code}>{block.text}</pre>;

    case "img":
      return (
        <figure className={styles.figure}>
          {/* Vendored at sync time and served from our own origin, so the
              dimensions are unknown here; a plain img avoids layout guessing. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.figureImg}
            src={block.src}
            alt={block.alt || "Diagram from the system design primer"}
            loading="lazy"
            decoding="async"
          />
          {block.caption && (
            <figcaption className={styles.caption}>
              {block.captionHref ? (
                <a href={block.captionHref} target="_blank" rel="noreferrer noopener">
                  {block.caption}
                </a>
              ) : (
                block.caption
              )}
            </figcaption>
          )}
        </figure>
      );

    case "table":
      return (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={i} scope="col">
                    <Inlines nodes={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>
                      <Inlines nodes={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "quote":
      return (
        <blockquote className={styles.quote}>
          {block.blocks.map((b, i) => (
            <BlockNode key={i} block={b} />
          ))}
        </blockquote>
      );

    case "hr":
      return <hr className={styles.hr} />;

    default:
      return null;
  }
}

function Item({ item, marker }: { item: ListItem; marker: string }) {
  return (
    <li className={styles.item}>
      <span className={styles.bullet} aria-hidden="true">
        {marker}
      </span>
      <span>
        <Inlines nodes={item.inline} />
        {item.children.length > 0 && (
          <div className={styles.nested}>
            {item.children.map((b, i) => (
              <BlockNode key={i} block={b} />
            ))}
          </div>
        )}
      </span>
    </li>
  );
}

export function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => (
        <InlineNode key={i} node={n} />
      ))}
    </>
  );
}

function InlineNode({ node }: { node: Inline }) {
  switch (node.t) {
    case "text":
      return <>{node.v}</>;
    case "code":
      return <code className={styles.inlineCode}>{node.v}</code>;
    case "br":
      return <br />;
    case "strong":
      return (
        <strong>
          <Inlines nodes={node.c} />
        </strong>
      );
    case "em":
      return (
        <em>
          <Inlines nodes={node.c} />
        </em>
      );
    case "del":
      return (
        <del>
          <Inlines nodes={node.c} />
        </del>
      );
    case "link":
      // Internal links were rewritten by the sync to point at our own routes;
      // everything else leaves the site and says so.
      return node.internal ? (
        <Link href={node.href} className={styles.link}>
          <Inlines nodes={node.c} />
        </Link>
      ) : (
        <a
          href={node.href}
          className={`${styles.link} ${styles.extLink}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          <Inlines nodes={node.c} />
        </a>
      );
    case "img":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={node.src} alt={node.alt} className={styles.figureImg} loading="lazy" />;
    default:
      return <Fragment />;
  }
}
