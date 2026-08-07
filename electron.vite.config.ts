import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import { resolve } from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@kubernetes/client-node"] })],
  },
  // A sandboxed preload can only `require` electron and a few polyfilled
  // builtins, so every npm dependency it uses has to be bundled in rather than
  // left as an external require.
  preload: {
    plugins: [
      externalizeDepsPlugin({ exclude: ["@electron-toolkit/preload"] }),
    ],
  },
  renderer: {
    root: resolve("src/renderer"),
    build: {
      rollupOptions: {
        input: resolve("src/renderer/index.html"),
      },
    },
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
