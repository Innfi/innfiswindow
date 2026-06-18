import { AlertTriangle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useAppStore } from "../../store/app.store"

export function GlobalFooter(): JSX.Element {
  const globalErrors = useAppStore((s) => s.globalErrors)
  const unreadErrorCount = useAppStore((s) => s.unreadErrorCount)
  const resetUnreadErrorCount = useAppStore((s) => s.resetUnreadErrorCount)
  const clearGlobalErrors = useAppStore((s) => s.clearGlobalErrors)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const contextAliases = useAppStore((s) => s.contextAliases)

  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const displayContext = selectedContext
    ? (contextAliases[selectedContext] ?? selectedContext)
    : null

  function togglePanel(): void {
    if (!open) {
      resetUnreadErrorCount()
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent): void {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const sorted = [...globalErrors].reverse()

  return (
    <div className="relative">
      {open && (
        <div
          ref={panelRef}
          className="absolute bottom-full right-0 w-96 max-h-64 overflow-y-auto bg-popover border border-border shadow-lg rounded-t z-50 flex flex-col"
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0">
            <span className="text-xs font-semibold">Errors</span>
            <button
              onClick={() => {
                clearGlobalErrors()
                setOpen(false)
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">
              No errors recorded.
            </p>
          ) : (
            sorted.map((entry) => (
              <div
                key={entry.id}
                className="px-3 py-1.5 border-b last:border-0 text-xs"
              >
                <div className="flex items-center gap-2 text-muted-foreground mb-0.5">
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  {entry.source && (
                    <span className="font-medium text-foreground">
                      {entry.source}
                    </span>
                  )}
                </div>
                <p className="break-all">{entry.message}</p>
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex h-8 shrink-0 items-center border-t bg-muted px-3 text-xs text-muted-foreground">
        <span className="flex-1 truncate">
          {displayContext ? `Context: ${displayContext}` : "No context selected"}
        </span>
        <button
          onClick={togglePanel}
          className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Show errors"
        >
          <AlertTriangle className="h-3 w-3" />
          {unreadErrorCount > 0 && (
            <span className="rounded-full bg-destructive text-destructive-foreground px-1 min-w-[1rem] text-center leading-tight">
              {unreadErrorCount > 99 ? "99+" : unreadErrorCount}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
