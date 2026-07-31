import type { MetadataRoute } from "next";
import { meshBrand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${meshBrand.name} - ${meshBrand.motto}`,
    short_name: meshBrand.name,
    description: `${meshBrand.motto}. ${meshBrand.description}`,
    start_url: "/mesh",
    display: "standalone",
    orientation: "any",
    background_color: meshBrand.colors.ink,
    theme_color: meshBrand.colors.ink,
    categories: ["social", "communication", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-72x72.png",
        sizes: "72x72",
        type: "image/png",
      },
      {
        src: "/icons/icon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/icons/icon-128x128.png",
        sizes: "128x128",
        type: "image/png",
      },
      {
        src: "/icons/icon-144x144.png",
        sizes: "144x144",
        type: "image/png",
      },
      {
        src: "/icons/icon-152x152.png",
        sizes: "152x152",
        type: "image/png",
      },
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-384x384.png",
        sizes: "384x384",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: meshBrand.assets.favicon,
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: meshBrand.assets.icon,
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    // Other apps' share sheets can send INTO mesh.me: the installed app
    // registers as a share target and /share lands the text in the composer.
    // GET with text params only — file sharing needs a POST/multipart
    // handler and is a later slice.
    share_target: {
      action: "/share",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
    shortcuts: [
      {
        name: "The Mesh",
        short_name: "Mesh",
        url: "/mesh",
        description: "View your digital footprint",
      },
      {
        name: "Feed",
        short_name: "Feed",
        url: "/feed",
        description: "Browse your unified feed",
      },
      {
        name: "Messages",
        short_name: "Chat",
        url: "/messages",
        description: "Open MeChat",
      },
    ],
  };
}
