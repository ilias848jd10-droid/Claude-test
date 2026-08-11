import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: "/Claude-test/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Στατιστικά Μετοχών & Κρύπτο",
        short_name: "Stats",
        description: "Νυχτερινά στατιστικά μετοχών και κρυπτονομισμάτων με γραφήματα, αναζήτηση και ιστορικό.",
        theme_color: "#2a78d6",
        background_color: "#1a1a19",
        display: "standalone",
        start_url: "/Claude-test/",
        scope: "/Claude-test/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        // Data files update nightly; use network-first so installed/offline
        // users still get the latest snapshot when online, with a cached
        // fallback when offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/data/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "stats-data",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
});
