import Link from "next/link";

import page from "@/components/Page.module.css";
import styles from "./home.module.css";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className={page.scroll}>
      <div className={styles.home}>
        <div className={page.kicker}>404</div>
        <h1 className={styles.title}>No such section.</h1>
        <p className={styles.intro}>
          That URL does not match a reference section, an exercise or a simulation. The
          sidebar lists everything there is, or press <kbd className={styles.kbd}>/</kbd> to
          search the full text.
        </p>
        <div className={styles.footer}>
          <Link className={styles.primary} href="/">
            back to the start →
          </Link>
        </div>
      </div>
    </div>
  );
}
