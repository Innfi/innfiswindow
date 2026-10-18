import { afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

import { useAppStore } from "../../store/app.store"
import { installApi } from "./mock-api"

// The store is a module singleton; every test starts from the state it had
// when first loaded, with nothing persisted from the last one.
const initialState = useAppStore.getState()

installApi()

// jsdom does no layout, so every element measures 0×0 and a virtualized table
// (ResourceListView) decides none of its rows are in view. A fixed viewport
// lets it render them.
const VIEWPORT = { width: 1024, height: 768 }
Object.defineProperties(HTMLElement.prototype, {
  offsetWidth: { configurable: true, get: () => VIEWPORT.width },
  offsetHeight: { configurable: true, get: () => VIEWPORT.height },
})
Element.prototype.getBoundingClientRect = function (): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: VIEWPORT.width,
    bottom: VIEWPORT.height,
    ...VIEWPORT,
    toJSON: () => ({}),
  }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
  useAppStore.setState(initialState, true)
  installApi()
})
