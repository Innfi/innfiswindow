import { Square } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

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
  const [searchTerm, setSearchTerm] = useState("")
  const [regexMode, setRegexMode] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  const searchActive = searchTerm.length > 0

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

  // Auto-scroll to bottom when new lines arrive (paused when search active)
  useEffect(() => {
    if (!userScrolledRef.current && !searchActive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, searchActive])

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

  // Derive filtered lines, build regex for highlighting, detect invalid regex
  const { filteredLines, matchRegex, regexError } = useMemo(() => {
    if (!searchTerm)
      return { filteredLines: lines, matchRegex: null, regexError: false }
    if (regexMode) {
      try {
        const re = new RegExp(searchTerm, "gi")
        const filtered = lines.filter((l) => re.test(l))
        return {
          filteredLines: filtered,
          matchRegex: new RegExp(searchTerm, "gi"),
          regexError: false,
        }
      } catch {
        return { filteredLines: lines, matchRegex: null, regexError: true }
      }
    }
    const lower = searchTerm.toLowerCase()
    const filtered = lines.filter((l) => l.toLowerCase().includes(lower))
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return {
      filteredLines: filtered,
      matchRegex: new RegExp(escaped, "gi"),
      regexError: false,
    }
  }, [lines, searchTerm, regexMode])

  function highlightLine(line: string, re: RegExp): JSX.Element {
    const parts: JSX.Element[] = []
    let last = 0
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) {
      if (m.index > last)
        parts.push(<span key={last}>{line.slice(last, m.index)}</span>)
      parts.push(
        <mark key={m.index} className="bg-yellow-400 text-zinc-900">
          {m[0]}
        </mark>,
      )
      last = m.index + m[0].length
      if (m[0].length === 0) {
        re.lastIndex++
        break
      }
    }
    if (last < line.length)
      parts.push(<span key={last}>{line.slice(last)}</span>)
    return <>{parts}</>
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

      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 shrink-0">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter logs…"
          className={`flex-1 text-xs bg-zinc-800 text-zinc-200 border rounded px-2 py-0.5 focus:outline-none ${regexError ? "border-red-500" : "border-zinc-700"}`}
        />
        <button
          onClick={() => setRegexMode((v) => !v)}
          title={
            regexMode
              ? "Regex mode (click for substring)"
              : "Substring mode (click for regex)"
          }
          className={`text-xs px-1.5 py-0.5 rounded border font-mono ${regexMode ? "bg-zinc-600 border-zinc-400 text-zinc-100" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}
        >
          .*
        </button>
        {searchTerm && (
          <span className="text-xs text-zinc-400 whitespace-nowrap">
            {filteredLines.length} line{filteredLines.length !== 1 ? "s" : ""}{" "}
            match
          </span>
        )}
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-relaxed"
      >
        {filteredLines.length === 0 && (
          <span className="text-zinc-500">
            {searchTerm
              ? "No matching lines."
              : streaming
                ? "Waiting for logs…"
                : "No logs."}
          </span>
        )}
        {filteredLines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all text-zinc-200">
            {matchRegex ? highlightLine(line, matchRegex) : line}
          </div>
        ))}
      </div>
    </div>
  )
}
