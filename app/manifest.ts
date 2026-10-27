import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Iyer Mess · Sweets & Savories",
    short_name: "Iyer Mess",
    start_url: "/",
    display: "standalone",
    background_color: "#f4ebdd",
    theme_color: "#7a1f1f",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
