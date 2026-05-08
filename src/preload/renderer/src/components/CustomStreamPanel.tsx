import { useEffect, useRef, useState } from "react"

import { Button } from "../../components/ui/button"

interface CustomStreamPanelProps {
  sessionId: string
  socketPath: string
  label: string
}

export function CustomStreamPanel({
  sessionId,
  socketPath,
  label,
}: CustomStreamPanelProps): JSX.Element {
  const [lines, setLines] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)

  function startStream(): void {
    setLines([])
    setConnected(true)
    userScrolledRef.current = false
    window.api.startSocketStream(socketPath, sessionId).catch((err) => {
      setLines((prev) => [...prev, `Error: ${String(err)}`])
      setConnected(false)
    })
  }

  function stopStream(): void {
    window.api.stopSocketStream(sessionId)
    setConnected(false)
  }

  useEffect(() => {
    const unsubData = window.api.onSocketData((data) => {
      if (data.sessionId === sessionId) {
        setLines((prev) => [...prev, data.line])
      }
    })
    const unsubEnd = window.api.onSocketEnd((data) => {
      if (data.sessionId === sessionId) {
        setConnected(false)
        if (data.reason) {
          setLines((prev) => [...prev, `[disconnected: ${data.reason}]`])
        } else {
          setLines((prev) => [...prev, "[disconnected]"])
        }
      }
    })
    return () => {
      unsubData()
      unsubEnd()
    }
  }, [sessionId])

  useEffect(() => {
    startStream()
    return () => {
      window.api.stopSocketStream(sessionId)
    }
  }, [sessionId, socketPath])

  useEffect(() => {
    if (!userScrolledRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  function handleScroll(): void {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10
    userScrolledRef.current = !atBottom
  }

  return (
    <div className="flex flex-col w-full h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-sm font-semibold text-zinc-200">{label}</span>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-2 text-zinc-400 hover:text-zinc-100"
            onClick={() => {
              setLines([])
              userScrolledRef.current = false
            }}
          >
            Clear
          </Button>
          {connected ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2 text-zinc-400 hover:text-zinc-100"
              onClick={stopStream}
            >
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2 text-zinc-400 hover:text-zinc-100"
              onClick={startStream}
            >
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* Stream output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-relaxed"
      >
        {lines.length === 0 && (
          <span className="text-zinc-500">
            {connected ? "Waiting for data…" : "Not connected."}
          </span>
        )}
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all text-zinc-200">
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}
