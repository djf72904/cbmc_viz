import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
  server: {
    port: 5181,
    strictPort: false,
    proxy: {
      "/api": {
        target: process.env.CBMC_VIZ_API ?? "http://localhost:3017",
        changeOrigin: true,
      },
    },
  },
});
