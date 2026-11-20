import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      // Legacy service stubs and the old onboarding wizard are gone.
      { source: "/services/gpa", destination: "/gpa", permanent: true },
      { source: "/services/notes", destination: "/contribute?category=lecture-notes", permanent: true },
      { source: "/services/past-papers", destination: "/contribute?category=past-papers", permanent: true },
      { source: "/onboarding", destination: "/today?welcome=1", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
