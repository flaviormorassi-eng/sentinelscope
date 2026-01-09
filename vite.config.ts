import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
// Removed Replit-specific plugins to keep config generic

export default defineConfig({
  plugins: [react()],
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
