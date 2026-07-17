import { useCallback } from "react"

import { HistoryEntry, useAppStore } from "../../store/app.store"

/** Identifies what was written; the same value describes success and failure. */
export type HistoryTarget = Omit<
  HistoryEntry,
  "id" | "timestamp" | "context" | "success" | "error"
>

export type HistoryResult = { success: boolean; error?: string }

/** Records a write against the selected context, which every call site shares. */
export function useRecordHistory(): (
  target: HistoryTarget,
  result: HistoryResult,
) => void {
  const appendHistory = useAppStore((s) => s.appendHistory)
  const selectedContext = useAppStore((s) => s.selectedContext)
  return useCallback(
    (target, result) => {
      appendHistory({ ...target, context: selectedContext ?? "", ...result })
    },
    [appendHistory, selectedContext],
  )
}
