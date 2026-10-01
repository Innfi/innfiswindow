import { IpcMain } from "electron"

import { InvalidateContext } from "./context-clients"

/** A 401 from the API server, either as client-node's `ApiException` or
 *  rewrapped by a handler that kept the original message. */
export function isUnauthorized(err: unknown): boolean {
  const e = err as { code?: unknown; statusCode?: unknown; message?: unknown }
  if (e?.code === 401 || e?.statusCode === 401) return true
  return /HTTP-Code: 401\b/.test(String(e?.message ?? err))
}

function contextNameOf(args: unknown[]): string | undefined {
  const first = args[0] as { contextName?: unknown } | null | undefined
  return typeof first?.contextName === "string" ? first.contextName : undefined
}

/**
 * Wraps `ipcMain` so every `handle` registered through it retries once after a
 * 401, with the context's exec credentials dropped in between. A 401 means
 * the request was rejected before it ran, so retrying writes is safe.
 */
export function withAuthRetry(
  ipcMain: IpcMain,
  invalidateContext: InvalidateContext,
): IpcMain {
  const handle: IpcMain["handle"] = (channel, listener) =>
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await listener(event, ...args)
      } catch (err) {
        if (!isUnauthorized(err)) throw err
        invalidateContext(contextNameOf(args))
        return await listener(event, ...args)
      }
    })
  return new Proxy(ipcMain, {
    get(target, prop) {
      if (prop === "handle") return handle
      const value = Reflect.get(target, prop, target)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}
