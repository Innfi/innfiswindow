import { RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"

import { type RefreshIntervalValue, useAppStore } from "../../store/app.store"
import { Button } from "./button"

export function RefreshBar({
  lastRefreshedAt,
  onRefresh,
}: {
  lastRefreshedAt: number | null
  onRefresh: () => void
}): JSX.Element {
  const [secondsAgo, setSecondsAgo] = useState(0)
  const refreshInterval = useAppStore((s) => s.refreshInterval)
  const setRefreshInterval = useAppStore((s) => s.setRefreshInterval)

  useEffect(() => {
    if (lastRefreshedAt === null) return
    const update = (): void =>
      setSecondsAgo(Math.floor((Date.now() - lastRefreshedAt) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [lastRefreshedAt])

  return (
    <div className="flex items-center gap-2">
      {lastRefreshedAt !== null && (
        <span className="text-xs text-muted-foreground">
          Last refreshed: {secondsAgo}s ago
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onRefresh}
        title="Refresh"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <select
        value={refreshInterval}
        onChange={(e) =>
          setRefreshInterval(e.target.value as RefreshIntervalValue)
        }
        className="rounded border px-1.5 py-0.5 text-xs bg-background text-foreground"
        title="Auto-refresh interval"
      >
        <option value="10">10s</option>
        <option value="30">30s</option>
        <option value="60">60s</option>
        <option value="120">120s</option>
        <option value="off">Off</option>
      </select>
    </div>
  )
}
