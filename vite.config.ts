import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

function manualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;

  // Keep heavy Solana/wallet dependencies in a dedicated shared chunk.
  if (
    id.includes("@solana/") ||
    id.includes("@solana-mobile/") ||
    id.includes("@noble/") ||
    id.includes("bn.js") ||
    id.includes("borsh") ||
    id.includes("bs58") ||
    id.includes("tweetnacl") ||
    id.includes("superstruct")
  ) {
    return "vendor-solana";
  }

  // Router stack commonly shared by all routes.
  if (id.includes("react-router") || id.includes("@remix-run/router")) {
    return "vendor-router";
  }

  // React runtime/core packages.
  if (id.includes("react-dom") || id.includes("/react/")) {
    return "vendor-react";
  }

  // Large UI libraries used across many screens.
  if (
    id.includes("@radix-ui/") ||
    id.includes("vaul") ||
    id.includes("lucide-react") ||
    id.includes("cmdk")
  ) {
    return "vendor-ui";
  }

  // Query/cache layer.
  if (id.includes("@tanstack/")) {
    return "vendor-data";
  }

  return "vendor-misc";
}

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
      includeAssets: ["favicon.svg", "favicon.ico", "robots.txt", "apple-touch-icon.png"],
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
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
<<<<<<< HEAD
        manualChunks,
=======
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("@solana/web3.js")) {
            return "vendor-solana-web3";
          }
          if (id.includes("@solana/wallet-adapter")) {
            return "vendor-solana-wallet";
          }
          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }
          if (id.includes("recharts")) {
            return "vendor-recharts";
          }
          if (id.includes("react-router-dom")) {
            return "vendor-router";
          }
          if (id.includes("@tanstack/react-query")) {
            return "vendor-react-query";
          }
          if (id.includes("react") || id.includes("scheduler")) {
            return "vendor-react";
          }

          return "vendor";
        },
>>>>>>> codex/terminal-provider-runtime-gates-fresh
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
