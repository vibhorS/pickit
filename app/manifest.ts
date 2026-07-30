import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PickIt",
    short_name: "PickIt",
    description: "Stop scrolling. Start watching.",
    start_url: "/",
    display: "standalone",
    background_color: "#141414",
    theme_color: "#e50914",
    icons: [
      {
        src: "/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
