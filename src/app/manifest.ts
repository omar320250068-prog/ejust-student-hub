import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "E-JUST Student Hub",
    short_name: "E-JUST Hub",
    description:
      "Timetable, exams, GPA and campus tools for Egypt-Japan University of Science and Technology students.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#070d1a",
    background_color: "#070d1a",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
