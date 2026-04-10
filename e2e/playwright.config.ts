import path from "path"
import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: path.join(__dirname),
  timeout: 60000,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "../playwright-report" }],
  ],
  use: {
    screenshot: "only-on-failure",
    video: "off",
  },
})
