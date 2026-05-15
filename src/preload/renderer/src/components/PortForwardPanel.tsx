import { useEffect, useRef, useState } from "react"

import { Button } from "../../components/ui/button"

interface PortForwardPanelProps {
  sessionId: string
  resourceKind: "Pod" | "Service"
  resourceName: string
  namespace: string
  defaultLocalPort: number
  defaultTargetPort: number
}

export function PortForwardPanel({
  sessionId,
  resourceKind,
  resourceName,
  namespace,
  defaultLocalPort,
  defaultTargetPort,
}: PortForwardPanelProps): JSX.Element {
  const [localPort, setLocalPort] = useState(defaultLocalPort)
  const [targetPort, setTargetPort] = useState(defaultTargetPort)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const runningRef = useRef(false)

  // Stop on unmount if running
  useEffect(() => {
    return () => {
      if (runningRef.current) {
        window.api.stopPortForward(sessionId)
      }
    }
  }, [sessionId])

  async function handleStart(): Promise<void> {
    setError(null)
    setStatus(null)
    const result = await window.api.startPortForward({
      resourceKind,
      namespace,
      name: resourceName,
      localPort,
      targetPort,
      sessionId,
    })
    if (result.success) {
      setRunning(true)
      runningRef.current = true
      setStatus(
        `Forwarding localhost:${localPort} → ${resourceName}:${targetPort}`,
      )
    } else {
      setError(result.error ?? "Failed to start port-forward")
    }
  }

  async function handleStop(): Promise<void> {
    await window.api.stopPortForward(sessionId)
    setRunning(false)
    runningRef.current = false
    setStatus(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Local Port
          </label>
          <input
            type="number"
            value={localPort}
            min={1}
            max={65535}
            disabled={running}
            onChange={(e) => setLocalPort(Number(e.target.value))}
            className="w-28 rounded border px-2 py-1 text-sm bg-background text-foreground disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Target Port
          </label>
          <input
            type="number"
            value={targetPort}
            min={1}
            max={65535}
            disabled={running}
            onChange={(e) => setTargetPort(Number(e.target.value))}
            className="w-28 rounded border px-2 py-1 text-sm bg-background text-foreground disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Resource
          </label>
          <span className="text-sm font-mono">
            {resourceKind}/{namespace}/{resourceName}
          </span>
        </div>

        {!running ? (
          <Button size="sm" onClick={handleStart}>
            Start
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={handleStop}>
            Stop
          </Button>
        )}
      </div>

      {status && (
        <p className="text-sm font-mono text-green-600 dark:text-green-400">
          {status}
        </p>
      )}
      {error && <p className="text-sm font-mono text-destructive">{error}</p>}
    </div>
  )
}
