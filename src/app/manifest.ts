import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kings Canteen",
    short_name: "Kings Canteen",
    description: "Seamlessly order and manage your canteen meals.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/image.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}