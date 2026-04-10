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
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@components": resolve("src/renderer/components"),
        "@lib": resolve("src/renderer/lib"),
        "@store": resolve("src/renderer/store"),
      },
    },
    plugins: [tailwindcss(), react()],
  },
})
