import { vi } from "vitest"

import type { Api } from "../../../preload/api"

type Overrides = {
  [K in keyof Api]?: Api[K] extends (...args: never[]) => unknown
    ? Api[K]
    : Partial<Api[K]>
}

/** A call no test set up: it never settles, so the component that made it
 *  stays in its loading state instead of failing the test on a shape it was
 *  not asked about. */
function pending(): Promise<never> {
  return new Promise<never>(() => {})
}

/** Default for a member nobody overrode, by naming convention: `on*` is a
 *  subscription and hands back an unsubscriber, `send*` / `close*` are
 *  fire-and-forget, anything else is an invoke. */
function stub(name: string): unknown {
  if (name.startsWith("on")) return vi.fn(() => () => {})
  if (name.startsWith("send") || name.startsWith("close")) return vi.fn()
  return vi.fn(pending)
}

function namespace(overrides: Record<string, unknown> = {}): unknown {
  return new Proxy(overrides, {
    get(target, prop: string) {
      if (!(prop in target)) target[prop] = stub(prop)
      return target[prop]
    },
  })
}

const NESTED = new Set(["k8s", "helm", "alarm"])

/**
 * Installs a `window.api` whose members are the given overrides plus a
 * never-settling stub for everything else, and returns it so a test can
 * inspect the calls. Overrides for `k8s`, `helm` and `alarm` are partial.
 */
export function installApi(overrides: Overrides = {}): Api {
  const root: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(overrides)) {
    root[key] = NESTED.has(key)
      ? namespace({ ...(value as Record<string, unknown>) })
      : value
  }
  const api = new Proxy(root, {
    get(target, prop: string) {
      if (!(prop in target)) {
        target[prop] = NESTED.has(prop) ? namespace() : stub(prop)
      }
      return target[prop]
    },
  }) as unknown as Api
  window.api = api
  return api
}

/** How an IPC rejection reaches the renderer: the main-process error wrapped
 *  in Electron's own prefix. */
export function ipcError(channel: string, message: string): Error {
  return new Error(
    `Error invoking remote method '${channel}': Error: ${message}`,
  )
}
