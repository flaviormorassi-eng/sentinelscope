import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
// Removed Replit-specific plugins to keep config generic

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      workbox: {
        maximumFileSizeToCacheInBytes: 3000000,
      },
      manifest: {
        name: "SentinelScope - Cybersecurity Monitoring",
        short_name: "SentinelScope",
        description: "Real-time cybersecurity monitoring and threat detection platform.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        icons: [
          {
            src: "favicon.svg",
            sizes: "64x64 32x32 24x24 16x16",
            type: "image/svg+xml",
          },
          {
            src: "favicon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "favicon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  envDir: path.resolve(import.meta.dirname, "."),
  css: {
    // Inline PostCSS config so we can set `from` and silence the warning.
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
      // Some plugins complain if `from` is missing; undefined is a valid value
      // and prevents PostCSS from guessing a path.
      // @ts-ignore - not typed on PostCSS config interface
      from: undefined,
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "wouter"],
          leaflet: ["leaflet", "react-leaflet"],
          stripe: ["@stripe/stripe-js", "@stripe/react-stripe-js"],
          charts: ["recharts"],
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
