import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "../../listening",
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 15_000,
  },
});
