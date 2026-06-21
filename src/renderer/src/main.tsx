import React from "react"
import ReactDOM from "react-dom/client"

import { applyTheme } from "../lib/themes"
import App from "./App"

import "../assets/main.css"

// Apply persisted theme before first render to avoid flash of unstyled content
const stored = localStorage.getItem("innfiswindow-app-store")
let themeId = "default"
try {
  if (stored) {
    const parsed = JSON.parse(stored)
    themeId = parsed?.state?.themeId ?? "default"
  }
} catch {
  // ignore
}
const colorScheme = window.matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light"
applyTheme(themeId, colorScheme)

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
