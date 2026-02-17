import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean,
  ),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // UI primitives — loaded on every page
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-select",
            "@radix-ui/react-accordion",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-label",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-switch",
            "@radix-ui/react-progress",
            "@radix-ui/react-avatar",
            "@radix-ui/react-collapsible",
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
            "cmdk",
            "sonner",
            "lucide-react",
          ],
          // Charts — only loaded on chart pages
          "vendor-charts": ["recharts"],
          // Data layer
          "vendor-data": [
            "@tanstack/react-query",
            "@tanstack/react-table",
            "@supabase/supabase-js",
          ],
          // Animation — lazy loaded
          "vendor-motion": ["framer-motion"],
          // React core
          "vendor-react": [
            "react",
            "react-dom",
            "react-router-dom",
          ],
          // Forms + validation
          "vendor-forms": [
            "react-hook-form",
            "@hookform/resolvers",
            "zod",
            "react-day-picker",
            "date-fns",
            "input-otp",
          ],
          // Analytics + monitoring (defer)
          "vendor-analytics": [
            "@sentry/react",
            "@vercel/analytics",
            "posthog-js",
          ],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
  },
}));
