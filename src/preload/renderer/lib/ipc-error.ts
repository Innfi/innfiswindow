import { toast } from "sonner"

import { useAppStore } from "../store/app.store"

export function handleIpcError(err: unknown, context: string): void {
  const message = err instanceof Error ? err.message : String(err)
  toast.error(`${context}: ${message}`, { duration: 5000 })
  useAppStore.getState().addGlobalError(message, context)
}
