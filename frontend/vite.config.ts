import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
  server: {
    port: 2256,
    host: true,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8180",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
