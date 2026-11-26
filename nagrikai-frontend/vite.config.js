import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    jsx: "automatic"
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api/nvapi": {
        target: "https://integrate.api.nvidia.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvapi/, "/v1"),
      },
    },
  },
});
