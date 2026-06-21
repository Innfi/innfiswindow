import { useState } from "react"

import { Button } from "../../components/ui/button"
import { useAppStore } from "../../store/app.store"

export function CustomStreamView(): JSX.Element {
  const [socketPath, setSocketPath] = useState("")
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)

  function handleConnect(): void {
    const trimmed = socketPath.trim()
    if (!trimmed) return
    const label = trimmed.split("/").filter(Boolean).pop() ?? trimmed
    openDrawerTab({
      tabKey: `custom-stream:${trimmed}`,
      type: "custom-stream",
      socketPath: trimmed,
      label,
    })
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="text-base font-semibold">Custom Stream</h2>
      <p className="text-sm text-muted-foreground">
        Connect to a Unix domain socket and tail its output.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={socketPath}
          onChange={(e) => setSocketPath(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          placeholder="/tmp/myapp.sock"
          className="rounded border px-2 py-1 text-sm bg-background text-foreground w-72 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="sm" onClick={handleConnect} disabled={!socketPath.trim()}>
          Connect
        </Button>
      </div>
    </div>
  )
}
