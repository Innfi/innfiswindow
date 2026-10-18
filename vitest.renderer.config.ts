import { resolve } from "path"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

// Renderer tests: React components and hooks in jsdom, with `window.api`
// replaced by the mock in src/renderer/src/test/mock-api.ts. Run on request
// only (`npm run test:renderer`) — nothing in the build or the git hooks
// starts them.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@renderer": resolve("src/renderer/src"),
      "@components": resolve("src/renderer/components"),
      "@lib": resolve("src/renderer/lib"),
      "@store": resolve("src/renderer/store"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/renderer/**/__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["src/renderer/src/test/setup.ts"],
    restoreMocks: true,
  },
})
