import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Afloat",
    short_name: "Afloat",
    description: "Personal plan mirror",
    lang: "zh-CN",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7f2e8",
    theme_color: "#111111",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon"
      }
    ]
  };
}
