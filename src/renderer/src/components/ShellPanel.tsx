import { useEffect, useRef } from "react"
import { FitAddon } from "@xterm/addon-fit"
import { Terminal } from "@xterm/xterm"

import "@xterm/xterm/css/xterm.css"

interface ShellPanelProps {
  sessionId: string
  namespace: string
  podName: string
  containerName: string
}

export function ShellPanel({
  sessionId,
  namespace,
  podName,
  containerName,
}: ShellPanelProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
  }, [sessionId, namespace, podName, containerName])

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
      style={{ backgroundColor: "#000", padding: "4px" }}
    />
  )
}
