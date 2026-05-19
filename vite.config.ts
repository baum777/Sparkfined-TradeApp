import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy API requests to backend during development
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/sw",
      filename: "service-worker.ts",
      registerType: "prompt",
      includeAssets: ["robots.txt"],
      manifest: {
        name: "TradeApp",
        short_name: "TradeApp",
        description: "Trading journal & signals",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0B0F19",
        background_color: "#0B0F19",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        globIgnores: ["**/manifest.webmanifest", "**/pwa-*.png"],
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          const moduleId = id.replace(/\\/g, "/");

          if (
            moduleId.includes("@solana/wallet-adapter") ||
            moduleId.includes("@solana/wallet-standard") ||
            moduleId.includes("@wallet-standard") ||
            moduleId.includes("@solana-mobile") ||
            moduleId.includes("@solflare-wallet") ||
            moduleId.includes("@project-serum") ||
            moduleId.includes("@keystonehq") ||
            moduleId.includes("@ledgerhq") ||
            moduleId.includes("@particle-network") ||
            moduleId.includes("@walletconnect") ||
            moduleId.includes("@reown") ||
            moduleId.includes("@toruslabs") ||
            moduleId.includes("@fractalwagmi") ||
            moduleId.includes("salmon-adapter-sdk")
          ) {
            return "vendor-wallet-adapters";
          }
          if (moduleId.includes("@solana/")) {
            return "vendor-solana-web3";
          }
          if (
            moduleId.includes("/node_modules/buffer/") ||
            moduleId.includes("/node_modules/borsh/") ||
            moduleId.includes("/node_modules/bs58/") ||
            moduleId.includes("/node_modules/bs58check/") ||
            moduleId.includes("/node_modules/base-x/") ||
            moduleId.includes("/node_modules/bn.js/") ||
            moduleId.includes("/node_modules/safe-buffer/") ||
            moduleId.includes("/node_modules/tweetnacl/") ||
            moduleId.includes("/node_modules/@noble/") ||
            moduleId.includes("/node_modules/@scure/")
          ) {
            return "vendor-crypto-buffer";
          }
          if (moduleId.includes("@radix-ui")) {
            return "vendor-radix";
          }
          if (moduleId.includes("recharts") || moduleId.includes("lightweight-charts")) {
            return "vendor-charts";
          }
          if (moduleId.includes("date-fns") || moduleId.includes("react-day-picker")) {
            return "vendor-date";
          }
          if (moduleId.includes("/node_modules/idb/") || moduleId.includes("/node_modules/idb-keyval/")) {
            return "vendor-storage";
          }
          if (
            moduleId.includes("cmdk") ||
            moduleId.includes("vaul") ||
            moduleId.includes("sonner") ||
            moduleId.includes("embla-carousel-react") ||
            moduleId.includes("lucide-react")
          ) {
            return "vendor-ui";
          }
          if (moduleId.includes("@sentry")) {
            return "vendor-monitoring";
          }
          if (moduleId.includes("zod")) {
            return "vendor-validation";
          }
          if (moduleId.includes("zustand")) {
            return "vendor-state";
          }
          if (moduleId.includes("react-router-dom")) {
            return "vendor-router";
          }
          if (moduleId.includes("@tanstack/react-query")) {
            return "vendor-react-query";
          }
          if (moduleId.includes("react") || moduleId.includes("scheduler")) {
            return "vendor-react";
          }

          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));
