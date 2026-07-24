import { useState } from "react"

import { Button } from "../../components/ui/Button"
import { HistoryEntry, useAppStore } from "../../store/app.store"

const ACTION_BADGE: Record<
  HistoryEntry["action"],
  { label: string; className: string }
> = {
  create: {
    label: "create",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  },
  update: {
    label: "update",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  },
  delete: {
    label: "delete",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  },
  apply: {
    label: "apply",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  },
  restart: {
    label: "restart",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  },
}

export function HistoryView(): JSX.Element {
  const writeHistory = useAppStore((s) => s.writeHistory)
  const clearHistory = useAppStore((s) => s.clearHistory)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = [...writeHistory].reverse()

  return (
    <div className="flex flex-col h-full overflow-hidden p-4">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-lg font-semibold">Write History</h1>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={clearHistory}
          disabled={writeHistory.length === 0}
        >
          Clear history
        </Button>
      </div>

      {writeHistory.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No write actions recorded yet.
        </p>
      )}

      <div className="flex-1 overflow-y-auto space-y-1">
        {sorted.map((entry) => {
          const badge = ACTION_BADGE[entry.action]
          const isExpanded = expandedId === entry.id
          const localTime = new Date(entry.timestamp).toLocaleString()

          return (
            <div key={entry.id} className="border rounded text-xs bg-card">
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              >
                <span className="text-muted-foreground w-36 shrink-0 truncate">
                  {localTime}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
                <span className="font-medium truncate">
                  {entry.resourceKind}/{entry.resourceName}
                </span>
                {entry.namespace && (
                  <span className="text-muted-foreground truncate">
                    {entry.namespace}
                  </span>
                )}
                {!entry.namespace && (
                  <span className="text-muted-foreground italic">
                    cluster-scoped
                  </span>
                )}
                <span className="text-muted-foreground truncate ml-auto">
                  {entry.context}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${
                    entry.success
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                  }`}
                >
                  {entry.success ? "ok" : "fail"}
                </span>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t">
                  {entry.error && (
                    <p className="text-destructive font-mono whitespace-pre-wrap mt-2">
                      {entry.error}
                    </p>
                  )}
                  {entry.yamlSnapshot && (
                    <pre className="bg-muted rounded p-2 overflow-x-auto text-xs font-mono whitespace-pre mt-2 max-h-64 overflow-y-auto">
                      {entry.yamlSnapshot}
                    </pre>
                  )}
                  {!entry.error && !entry.yamlSnapshot && (
                    <p className="text-muted-foreground mt-2">
                      No additional details.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
