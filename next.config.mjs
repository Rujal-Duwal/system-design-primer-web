/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Static export has no image optimizer at runtime.
  images: { unoptimized: true },
  // Every route becomes a directory with an index.html, so the site works on
  // any static host (GitHub Pages included) without rewrite rules.
  trailingSlash: true,
};

export default nextConfig;
