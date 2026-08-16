import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";

import "./globals.css";
import { Shell } from "@/components/Shell";

/**
 * The type split is strict: mono for anything that is a control or a
 * measurement, sans for anything that is a sentence to read. Self-hosted via
 * next/font so a static export makes no request to Google at runtime.
 */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-sans",
  display: "swap",
});

const SITE = "system-design-primer";

/** Says what the site does. Provenance is stated once, in the sidebar footer. */
const TAGLINE = "run it, don't just read it";

export const metadata: Metadata = {
  metadataBase: new URL("https://system-design-primer.rujalduwal.com.np"),
  title: {
    default: `${SITE} — ${TAGLINE}`,
    template: `%s — ${SITE}`,
  },
  description:
    "An interactive companion to donnemartin's system design primer: run traffic through a system you build, read the reference, and work the design problems.",
  applicationName: SITE,
  openGraph: {
    type: "website",
    siteName: SITE,
    title: `${SITE} — ${TAGLINE}`,
    description:
      "Run traffic through a system you build, read the primer's reference, and work the design problems. An independent companion to donnemartin/system-design-primer.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0c0b" },
    { media: "(prefers-color-scheme: light)", color: "#f6f6f3" },
  ],
};

/**
 * Applies the stored theme before first paint. Without this a reader who chose
 * light gets a dark flash on every navigation, which on a reading site is worse
 * than the inline script it costs.
 */
const THEME_BOOTSTRAP = `
(function () {
  try {
    var t = localStorage.getItem("sdp-theme");
    if (!t) t = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.setAttribute("data-sdp-theme", t);
  } catch (e) {
    document.documentElement.setAttribute("data-sdp-theme", "dark");
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-sdp-theme="dark" className={`${mono.variable} ${sans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
