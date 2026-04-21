import { Square } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "../../components/ui/button"

interface K8sPodContainer {
  name: string
  image: string
  restartCount: number
}

interface PodLogPanelProps {
  tabKey: string
  namespace: string
  podName: string
  containers: K8sPodContainer[]
}

export function PodLogPanel({
  tabKey,
  namespace,
  podName,
  containers,
}: PodLogPanelProps): JSX.Element {
  const [lines, setLines] = useState<string[]>([])
  const [selectedContainer, setSelectedContainer] = useState(
    containers[0]?.name ?? "",
  )
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)

  function startStream(containerName: string): void {
    setLines([])
    setStreaming(true)
    userScrolledRef.current = false
    window.api
      .startPodLog(namespace, podName, containerName, tabKey)
      .catch((err) => {
        console.error("startPodLog error:", err)
        setStreaming(false)
      })
  }

  function stopStream(): void {
    window.api.stopPodLog(namespace, podName).catch(console.error)
    setStreaming(false)
  }

  // Subscribe to log data events — filter by tabKey
  useEffect(() => {
    const unsubscribe = window.api.onPodLogData((data) => {
      if (data.tabKey === tabKey) {
        setLines((prev) => [...prev, data.line])
      }
    })
    return unsubscribe
  }, [tabKey])

  // Reset selected container when pod changes
  useEffect(() => {
    setSelectedContainer(containers[0]?.name ?? "")
  }, [namespace, podName])

  // Start stream on mount and when container changes
  useEffect(() => {
    if (selectedContainer) {
      startStream(selectedContainer)
    }
    return () => {
      window.api.stopPodLog(namespace, podName).catch(console.error)
    }
  }, [namespace, podName, selectedContainer])

  // Auto-scroll to bottom when new lines arrive
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

  function handleContainerChange(name: string): void {
    stopStream()
    setSelectedContainer(name)
  }

  function handleStop(): void {
    stopStream()
  }

  return (
    <div className="flex flex-col w-full h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-200">
            {namespace}/{podName}
          </span>
          {containers.length > 1 && (
            <select
              value={selectedContainer}
              onChange={(e) => handleContainerChange(e.target.value)}
              className="text-xs bg-zinc-800 text-zinc-200 border border-zinc-700 rounded px-1.5 py-0.5 focus:outline-none"
            >
              {containers.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {containers.length === 1 && (
            <span className="text-xs text-zinc-500">{selectedContainer}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {streaming && (
            <Button
              size="icon"
              variant="ghost"
              title="Stop"
              onClick={handleStop}
              className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-relaxed"
      >
        {lines.length === 0 && (
          <span className="text-zinc-500">
            {streaming ? "Waiting for logs…" : "No logs."}
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
