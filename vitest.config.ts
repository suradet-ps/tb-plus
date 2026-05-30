import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: [],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/main.ts",
        "src/router/**",
      ],
    },
  },
});
