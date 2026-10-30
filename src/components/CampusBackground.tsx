"use client";

import { usePathname } from "next/navigation";

const routeImages: Array<[string, string]> = [
  ["/today", "/images/campus/hero-sunset.jpg.png"],
  ["/login", "/images/campus/main-gate.jpg.png"],
  ["/cafeteria", "/images/campus/night-campus.jpg.png"],
  ["/scholarships", "/images/campus/night-campus.jpg.png"],
];

export default function CampusBackground({ image }: { image?: string }) {
  const pathname = usePathname();
  const resolvedImage = image ?? routeImages.find(([route]) => pathname === route)?.[1];
  if (!resolvedImage) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat before:absolute before:inset-0 before:bg-white/75 before:backdrop-blur-[2px] dark:before:bg-slate-950/78 dark:before:backdrop-blur-md"
      style={{ backgroundImage: `url("${resolvedImage}")` }}
    />
  );
}
