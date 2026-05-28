import { RefreshCw } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@components/ui/button"
import { useAppStore } from "@store/app.store"
import { FitAddon } from "@xterm/addon-fit"
import { Terminal } from "@xterm/xterm"

import "@xterm/xterm/css/xterm.css"

interface ShellPanelProps {
  sessionId: string
  namespace: string
  podName: string
  containerName: string
  restored?: boolean
}

export function ShellPanel({
  sessionId,
  namespace,
  podName,
  containerName,
  restored,
}: ShellPanelProps): JSX.Element {
  const markTabReconnected = useAppStore((s) => s.markTabReconnected)
  const [sessionEnded, setSessionEnded] = useState(restored ?? false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sessionEnded) return
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    if (containerRef.current) {
      term.open(containerRef.current)
      fitAddon.fit()
    }

    window.api
      .startPodExec(sessionId, namespace, podName, containerName)
      .catch((err) => {
        term.write(`\r\nFailed to connect: ${String(err)}\r\n`)
      })

    const removeOutputListener = window.api.onPodExecOutput((msg) => {
      if (msg.sessionId === sessionId) {
        term.write(msg.data)
      }
    })

    term.onData((data) => {
      window.api.sendPodExecInput(sessionId, data)
    })

    let ro: ResizeObserver | null = null
    if (containerRef.current) {
      ro = new ResizeObserver(() => {
        fitAddon.fit()
      })
      ro.observe(containerRef.current)
    }

    return () => {
      removeOutputListener()
      window.api.closePodExec(sessionId)
      ro?.disconnect()
      term.dispose()
    }
  }, [sessionId, namespace, podName, containerName, sessionEnded])

  if (sessionEnded) {
    return (
      <div className="flex flex-col w-full h-full bg-zinc-950 text-zinc-100 items-center justify-center gap-3">
        <p className="text-sm text-zinc-400">Session ended — reconnect?</p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          onClick={() => {
            markTabReconnected(sessionId)
            setSessionEnded(false)
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reconnect
        </Button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
      style={{ backgroundColor: "#000", padding: "4px" }}
    />
  )
}
