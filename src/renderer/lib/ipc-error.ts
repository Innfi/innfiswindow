import { toast } from "sonner"

import { useAppStore } from "../store/app.store"

/** Electron wraps anything an `ipcMain.handle` throws, so the renderer sees
 *  `Error invoking remote method 'k8s:pods:list': HttpError: ...`. Strip the
 *  wrapper — the channel name is noise to the user, and the repeated `Error:`
 *  prefixes the k8s client adds on top of it are too. */
export function normalizeIpcError(err: unknown): string {
  let message = err instanceof Error ? err.message : String(err)
  message = message.replace(/^Error invoking remote method '[^']*':\s*/, "")
  while (/^(Error|HttpError|ApiException):\s*/.test(message)) {
    message = message.replace(/^(Error|HttpError|ApiException):\s*/, "")
  }
  return message.trim() || "Unknown error"
}

export function handleIpcError(err: unknown, context: string): void {
  const message = normalizeIpcError(err)
  toast.error(`${context}: ${message}`, { duration: 5000 })
  useAppStore.getState().addGlobalError(message, context)
}
