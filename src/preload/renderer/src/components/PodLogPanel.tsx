import { Layers, RefreshCw, Square } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAppStore } from "@store/app.store"

import { Button } from "../../components/ui/button"

interface K8sPodContainer {
  name: string
  image: string
  restartCount: number
}

interface MergedLine {
  containerName: string
  line: string
}

interface PodLogPanelProps {
  tabKey: string
  namespace: string
  podName: string
  containers: K8sPodContainer[]
  restored?: boolean
}

export function PodLogPanel({
  tabKey,
  namespace,
  podName,
  containers,
  restored,
}: PodLogPanelProps): JSX.Element {
  const markTabReconnected = useAppStore((s) => s.markTabReconnected)
  const [sessionEnded, setSessionEnded] = useState(restored ?? false)
  const [lines, setLines] = useState<string[]>([])
  const [mergedLines, setMergedLines] = useState<MergedLine[]>([])
  const [selectedContainer, setSelectedContainer] = useState(
    containers[0]?.name ?? "",
  )
  const [streaming, setStreaming] = useState(false)
  const [mergeMode, setMergeMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [regexMode, setRegexMode] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  // sessionId → containerName for active merge streams
  const mergeSessionMapRef = useRef<Map<string, string>>(new Map())
  const mergeSessionIdsRef = useRef<string[]>([])
  const prevContainerRef = useRef(containers[0]?.name ?? "")
  const searchActive = searchTerm.length > 0

  function startSingleStream(containerName: string): void {
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

  function stopSingleStream(): void {
    window.api.stopPodLogSession(tabKey).catch(console.error)
    setStreaming(false)
  }

  function startMergeStreams(): void {
    setMergedLines([])
    userScrolledRef.current = false
    const ts = Date.now()
    const sessionMap = new Map<string, string>()
    const sessionIds: string[] = []
    for (const c of containers) {
      const sid = `pod-log-${podName}-${c.name}-${ts}`
      sessionIds.push(sid)
      sessionMap.set(sid, c.name)
      window.api
        .startPodLog(namespace, podName, c.name, sid)
        .catch(console.error)
    }
    mergeSessionMapRef.current = sessionMap
    mergeSessionIdsRef.current = sessionIds
    setStreaming(true)
  }

  function stopMergeStreams(): void {
    for (const sid of mergeSessionIdsRef.current) {
      window.api.stopPodLogSession(sid).catch(console.error)
    }
    mergeSessionMapRef.current = new Map()
    mergeSessionIdsRef.current = []
    setStreaming(false)
  }

  function toggleMergeMode(): void {
    if (!mergeMode) {
      prevContainerRef.current = selectedContainer
      stopSingleStream()
      setMergeMode(true)
    } else {
      stopMergeStreams()
      setMergeMode(false)
      setMergedLines([])
      setSelectedContainer(prevContainerRef.current)
    }
  }

  // Subscribe to log data events
  useEffect(() => {
    const unsub = window.api.onPodLogData((data) => {
      if (data.tabKey === tabKey) {
        setLines((prev) => [...prev, data.line])
      } else {
        const cname = mergeSessionMapRef.current.get(data.tabKey)
        if (cname !== undefined) {
          setMergedLines((prev) => [
            ...prev,
            { containerName: cname, line: data.line },
          ])
        }
      }
    })
    return unsub
  }, [tabKey])

  // Reset when pod changes
  useEffect(() => {
    const first = containers[0]?.name ?? ""
    setSelectedContainer(first)
    prevContainerRef.current = first
    setMergeMode(false)
    setMergedLines([])
    mergeSessionMapRef.current = new Map()
    mergeSessionIdsRef.current = []
  }, [namespace, podName])

  // Single-container mode stream lifecycle
  useEffect(() => {
    if (sessionEnded) return
    if (mergeMode) return
    if (!selectedContainer) return
    startSingleStream(selectedContainer)
    return () => {
      window.api.stopPodLogSession(tabKey).catch(console.error)
    }
  }, [namespace, podName, selectedContainer, mergeMode, sessionEnded])

  // Merge mode stream lifecycle
  useEffect(() => {
    if (sessionEnded) return
    if (!mergeMode) return
    startMergeStreams()
    return () => {
      stopMergeStreams()
    }
  }, [mergeMode, namespace, podName, sessionEnded])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.api.stopPodLogSession(tabKey).catch(console.error)
      for (const sid of mergeSessionIdsRef.current) {
        window.api.stopPodLogSession(sid).catch(console.error)
      }
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (!userScrolledRef.current && !searchActive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, mergedLines, searchActive])

  function handleScroll(): void {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10
    userScrolledRef.current = !atBottom
  }

  function handleContainerChange(name: string): void {
    stopSingleStream()
    setSelectedContainer(name)
  }

  function handleStop(): void {
    if (mergeMode) {
      stopMergeStreams()
    } else {
      stopSingleStream()
    }
  }

  const { filteredLines, filteredMerged, matchRegex, regexError } =
    useMemo(() => {
      let matchRe: RegExp | null = null
      let hasError = false

      if (searchTerm) {
        if (regexMode) {
          try {
            matchRe = new RegExp(searchTerm, "gi")
          } catch {
            hasError = true
          }
        } else {
          const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          matchRe = new RegExp(escaped, "gi")
        }
      }

      const testLine = (line: string): boolean => {
        if (!matchRe) return true
        matchRe.lastIndex = 0
        return matchRe.test(line)
      }

      const filtered = hasError ? lines : lines.filter(testLine)
      const filteredM = hasError
        ? mergedLines
        : mergedLines.filter((m) => testLine(`[${m.containerName}] ${m.line}`))

      return {
        filteredLines: filtered,
        filteredMerged: filteredM,
        matchRegex: matchRe ? new RegExp(matchRe.source, matchRe.flags) : null,
        regexError: hasError,
      }
    }, [lines, mergedLines, searchTerm, regexMode])

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

  const displayCount = mergeMode ? filteredMerged.length : filteredLines.length

  if (sessionEnded) {
    return (
      <div className="flex flex-col w-full h-full bg-zinc-950 text-zinc-100 items-center justify-center gap-3">
        <p className="text-sm text-zinc-400">Session ended — reconnect?</p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          onClick={() => {
            markTabReconnected(tabKey)
            setSessionEnded(false)
            startSingleStream(selectedContainer)
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reconnect
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-200">
            {namespace}/{podName}
          </span>
          {!mergeMode && containers.length > 1 && (
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
          {!mergeMode && containers.length === 1 && (
            <span className="text-xs text-zinc-500">{selectedContainer}</span>
          )}
          {mergeMode && (
            <span className="text-xs text-zinc-400 italic">merged</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {containers.length > 1 && (
            <button
              onClick={toggleMergeMode}
              title={
                mergeMode ? "Single container mode" : "Merge all containers"
              }
              className={`text-xs px-2 py-0.5 rounded border font-mono flex items-center gap-1 ${
                mergeMode
                  ? "bg-zinc-600 border-zinc-400 text-zinc-100"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400"
              }`}
            >
              <Layers className="h-3 w-3" />
              Merge
            </button>
          )}
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
            {displayCount} line{displayCount !== 1 ? "s" : ""} match
          </span>
        )}
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-relaxed"
      >
        {mergeMode ? (
          filteredMerged.length === 0 ? (
            <span className="text-zinc-500">
              {searchTerm
                ? "No matching lines."
                : streaming
                  ? "Waiting for logs…"
                  : "No logs."}
            </span>
          ) : (
            filteredMerged.map((m, i) => {
              const prefix = `[${m.containerName}] `
              if (matchRegex) {
                const fullLine = prefix + m.line
                return (
                  <div
                    key={i}
                    className="whitespace-pre-wrap break-all text-zinc-200"
                  >
                    {highlightLine(
                      fullLine,
                      new RegExp(matchRegex.source, matchRegex.flags),
                    )}
                  </div>
                )
              }
              return (
                <div key={i} className="whitespace-pre-wrap break-all">
                  <span className="text-zinc-500">{prefix}</span>
                  <span className="text-zinc-200">{m.line}</span>
                </div>
              )
            })
          )
        ) : (
          <>
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
              <div
                key={i}
                className="whitespace-pre-wrap break-all text-zinc-200"
              >
                {matchRegex
                  ? highlightLine(
                      line,
                      new RegExp(matchRegex.source, matchRegex.flags),
                    )
                  : line}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
