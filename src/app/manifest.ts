import type { MetadataRoute } from "next";

// Web app manifest — lets the app be installed to the home screen and launch
// standalone (full-screen, no browser chrome).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LedgerLite",
    short_name: "LedgerLite",
    description: "Lightweight accounting platform",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
