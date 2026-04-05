import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const basePath = process.env.PAGES_BASE_PATH || "";
const normalizedBasePath = basePath ? `${basePath.replace(/\/+$/, "")}/` : "/";

export default defineConfig({
  plugins: [react()],
  base: normalizedBasePath,
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/healthz": "http://127.0.0.1:8080"
    }
  }
});
