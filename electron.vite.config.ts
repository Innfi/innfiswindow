import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import { resolve } from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@kubernetes/client-node"] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: resolve("src/preload/renderer"),
    build: {
      rollupOptions: {
        input: resolve("src/preload/renderer/index.html"),
      },
    },
    resolve: {
      alias: {
        "@renderer": resolve("src/preload/renderer/src"),
        "@components": resolve("src/preload/renderer/components"),
        "@lib": resolve("src/preload/renderer/lib"),
        "@store": resolve("src/preload/renderer/store"),
      },
    },
    plugins: [tailwindcss(), react()],
  },
})
