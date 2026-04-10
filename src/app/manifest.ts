import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "mesh.me",
    short_name: "mesh",
    description: "A creator-first social operating system for your unified digital footprint.",
    start_url: "/mesh",
    display: "standalone",
    background_color: "#05070c",
    theme_color: "#2d7ff9",
    orientation: "portrait",
    icons: [
      {
        src: "/meshi-favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
