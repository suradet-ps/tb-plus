import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8")) as { version: string };

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    vue(),
    {
      name: "html-app-version",
      transformIndexHtml(html) {
        return html.replaceAll("%APP_VERSION%", pkg.version);
      },
    },
  ],
  resolve: {
    alias: {
       '@': path.resolve(__dirname, 'src'),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri` and Rust build output
      ignored: ["**/src-tauri/**", "**/target/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('/node_modules/leaflet')) {
            return 'leaflet';
          }
          if (id.includes('lucide-vue-next')) {
            return 'lucide';
          }
          if (
            id.includes('/node_modules/vue') ||
            id.includes('/node_modules/vue-router') ||
            id.includes('/node_modules/pinia')
          ) {
            return 'vue';
          }
        },
      },
    },
  },
}));
