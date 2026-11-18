import type { MetadataRoute } from "next";

import { APP_NAME } from "@/lib/brand";

/**
 * Lets drivers and customers add the site to their home screen and open it
 * full screen, like an app. It starts at /login, which sends a signed-in user
 * straight to their own area.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Materials",
    description: "We buy construction materials and deliver them to your site.",
    start_url: "/login",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
