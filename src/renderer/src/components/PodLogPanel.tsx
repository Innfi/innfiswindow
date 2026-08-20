import { Layers, RefreshCw, Square } from "lucide-react"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useAppStore } from "@store/app.store"
import { useVirtualizer } from "@tanstack/react-virtual"

import { Button } from "../../components/ui/Button"
import { normalizeIpcError } from "../../lib/ipc-error"

/** Read-option choices, kept short: these are the ones worth a click. */
const TAIL_CHOICES: { label: string; value: number | null }[] = [
  { label: "50", value: 50 },
  { label: "200", value: 200 },
  { label: "1000", value: 1000 },
  { label: "All", value: null },
]

const SINCE_CHOICES: { label: string; value: number | null }[] = [
  { label: "Any age", value: null },
  { label: "5m", value: 300 },
  { label: "15m", value: 900 },
  { label: "1h", value: 3600 },
  { label: "6h", value: 21600 },
  { label: "24h", value: 86400 },
]

const MAX_LOG_LINES = 5000
const SENTINEL_TEXT = `--- [older lines removed, showing last ${MAX_LOG_LINES}] ---`
const ESTIMATED_LINE_HEIGHT = 18

interface K8sPodContainer {
  name: string
  image: string
  restartCount: number
}

interface MergedLine {
  containerName: string
  line: string
}

/** Appends a batch, trimming to MAX_LOG_LINES and re-stamping the sentinel. */
function appendCapped<T>(prev: T[], incoming: T[], sentinel: T): T[] {
  if (incoming.length === 0) return prev
  const next = prev.concat(incoming)
  if (next.length > MAX_LOG_LINES) {
    const trimmed = next.slice(-MAX_LOG_LINES)
    trimmed[0] = sentinel
    return trimmed
  }
  return next
}

/** The API server answers `previous` on a container that never restarted with
 *  a bare 400, which reads as a mystery unless the reason is spelled out. */
function describeLogError(err: unknown, previous: boolean): string {
  const message = normalizeIpcError(err)
  return previous
    ? `${message} — a container with no earlier instance has no previous log.`
    : message
}

function OptionChip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`text-xs px-1.5 py-0.5 rounded border whitespace-nowrap ${
        active
          ? "bg-zinc-600 border-zinc-400 text-zinc-100"
          : "bg-zinc-800 border-zinc-700 text-zinc-400"
      }`}
    >
      {children}
    </button>
  )
}

function OptionSelect({
  label,
  value,
  choices,
  onChange,
}: {
  label: string
  value: number | null
  choices: { label: string; value: number | null }[]
  onChange: (value: number | null) => void
}): JSX.Element {
  return (
    <label className="flex items-center gap-1 text-xs text-zinc-500">
      {label}
      <select
        value={value === null ? "all" : String(value)}
        onChange={(e) =>
          onChange(e.target.value === "all" ? null : Number(e.target.value))
        }
        className="text-xs bg-zinc-800 text-zinc-200 border border-zinc-700 rounded px-1 py-0.5 focus:outline-none"
      >
        {choices.map((c) => (
          <option key={c.label} value={c.value === null ? "all" : c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  )
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
  const [tailLines, setTailLines] = useState<number | null>(200)
  const [sinceSeconds, setSinceSeconds] = useState<number | null>(null)
  const [previous, setPrevious] = useState(false)
  const [timestamps, setTimestamps] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  // sessionId → containerName for active merge streams
  const mergeSessionMapRef = useRef<Map<string, string>>(new Map())
  const mergeSessionIdsRef = useRef<string[]>([])
  const prevContainerRef = useRef(containers[0]?.name ?? "")
  // Sessions the main process has reported as finished, so merge mode knows
  // when the last of its streams is done rather than only the first.
  const endedSessionsRef = useRef<Set<string>>(new Set())
  const searchActive = searchTerm.length > 0

  // One object so the stream effects can depend on the whole read spec: any
  // change to it has to restart the request, there is no way to amend one.
  const logOptions = useMemo(
    () => ({ tailLines, sinceSeconds, previous, timestamps }),
    [tailLines, sinceSeconds, previous, timestamps],
  )

  // Log lines arrive one IPC event at a time. Buffer them and flush once per
  // frame so a chatty pod costs ~60 renders/sec instead of one render per line.
  const pendingRef = useRef<{ single: string[]; merged: MergedLine[] }>({
    single: [],
    merged: [],
  })
  const flushHandleRef = useRef<number | null>(null)

  const cancelFlush = useCallback((): void => {
    if (flushHandleRef.current !== null) {
      cancelAnimationFrame(flushHandleRef.current)
      flushHandleRef.current = null
    }
    pendingRef.current = { single: [], merged: [] }
  }, [])

  const scheduleFlush = useCallback((): void => {
    if (flushHandleRef.current !== null) return
    flushHandleRef.current = requestAnimationFrame(() => {
      flushHandleRef.current = null
      const { single, merged } = pendingRef.current
      pendingRef.current = { single: [], merged: [] }
      if (single.length > 0) {
        setLines((prev) => appendCapped(prev, single, SENTINEL_TEXT))
      }
      if (merged.length > 0) {
        setMergedLines((prev) =>
          appendCapped(prev, merged, {
            containerName: "",
            line: SENTINEL_TEXT,
          }),
        )
      }
    })
  }, [])

  function startSingleStream(containerName: string): void {
    cancelFlush()
    setLines([])
    setStreamError(null)
    setStreaming(true)
    stickToBottomRef.current = true
    endedSessionsRef.current = new Set()
    window.api
      .startPodLog(namespace, podName, containerName, tabKey, logOptions)
      .catch((err) => {
        setStreamError(describeLogError(err, previous))
        setStreaming(false)
      })
  }

  function stopSingleStream(): void {
    window.api.stopPodLogSession(tabKey).catch(console.error)
    setStreaming(false)
  }

  function startMergeStreams(): void {
    cancelFlush()
    setMergedLines([])
    setStreamError(null)
    stickToBottomRef.current = true
    endedSessionsRef.current = new Set()
    const ts = Date.now()
    const sessionMap = new Map<string, string>()
    const sessionIds: string[] = []
    for (const c of containers) {
      const sid = `pod-log-${podName}-${c.name}-${ts}`
      sessionIds.push(sid)
      sessionMap.set(sid, c.name)
      window.api
        .startPodLog(namespace, podName, c.name, sid, logOptions)
        .catch((err) => setStreamError(describeLogError(err, previous)))
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
      cancelFlush()
      setMergedLines([])
      setSelectedContainer(prevContainerRef.current)
    }
  }

  // Subscribe to log data events
  useEffect(() => {
    const unsub = window.api.onPodLogData((data) => {
      if (data.tabKey === tabKey) {
        pendingRef.current.single.push(data.line)
        scheduleFlush()
      } else {
        const cname = mergeSessionMapRef.current.get(data.tabKey)
        if (cname !== undefined) {
          pendingRef.current.merged.push({
            containerName: cname,
            line: data.line,
          })
          scheduleFlush()
        }
      }
    })
    return unsub
  }, [tabKey, scheduleFlush])

  // A stream that ends on its own (a non-following read, or a server that hung
  // up) leaves the panel showing a Stop button for a request that is gone.
  useEffect(() => {
    return window.api.onPodLogEnd(({ tabKey: endedKey }) => {
      if (endedKey === tabKey) {
        setStreaming(false)
        return
      }
      if (!mergeSessionMapRef.current.has(endedKey)) return
      endedSessionsRef.current.add(endedKey)
      const all = mergeSessionIdsRef.current
      if (
        all.length > 0 &&
        all.every((id) => endedSessionsRef.current.has(id))
      ) {
        setStreaming(false)
      }
    })
  }, [tabKey])

  // Reset when pod changes
  useEffect(() => {
    const first = containers[0]?.name ?? ""
    setSelectedContainer(first)
    prevContainerRef.current = first
    setMergeMode(false)
    cancelFlush()
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
  }, [
    namespace,
    podName,
    selectedContainer,
    mergeMode,
    sessionEnded,
    logOptions,
  ])

  // Merge mode stream lifecycle
  useEffect(() => {
    if (sessionEnded) return
    if (!mergeMode) return
    startMergeStreams()
    return () => {
      stopMergeStreams()
    }
  }, [mergeMode, namespace, podName, sessionEnded, logOptions])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelFlush()
      window.api.stopPodLogSession(tabKey).catch(console.error)
      for (const sid of mergeSessionIdsRef.current) {
        window.api.stopPodLogSession(sid).catch(console.error)
      }
    }
  }, [])

  function handleScroll(): void {
    const el = scrollRef.current
    if (!el || el.clientHeight === 0) return
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 10
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

  const rowVirtualizer = useVirtualizer({
    count: displayCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_LINE_HEIGHT,
    overscan: 20,
  })

  const scrollToBottom = useCallback((): void => {
    if (displayCount === 0) return
    rowVirtualizer.scrollToIndex(displayCount - 1, { align: "end" })
  }, [displayCount, rowVirtualizer])

  // Auto-scroll to bottom
  useEffect(() => {
    if (stickToBottomRef.current && !searchActive) scrollToBottom()
  }, [lines, mergedLines, searchActive, scrollToBottom])

  // Inactive drawer tabs stay mounted under `display: none`, where scroll
  // writes are dropped. Re-pin once the panel has a real box again.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (el.clientHeight === 0) return
      if (stickToBottomRef.current && !searchActive) scrollToBottom()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [searchActive, scrollToBottom])

  function renderLine(index: number): JSX.Element {
    if (mergeMode) {
      const m = filteredMerged[index]
      if (m.containerName === "" && m.line === SENTINEL_TEXT) {
        return (
          <div className="whitespace-pre-wrap break-all text-zinc-500 italic">
            {m.line}
          </div>
        )
      }
      const prefix = `[${m.containerName}] `
      if (matchRegex) {
        return (
          <div className="whitespace-pre-wrap break-all text-zinc-200">
            {highlightLine(prefix + m.line, matchRegex)}
          </div>
        )
      }
      return (
        <div className="whitespace-pre-wrap break-all">
          <span className="text-zinc-500">{prefix}</span>
          <span className="text-zinc-200">{m.line}</span>
        </div>
      )
    }
    const line = filteredLines[index]
    if (line === SENTINEL_TEXT) {
      return (
        <div className="whitespace-pre-wrap break-all text-zinc-500 italic">
          {line}
        </div>
      )
    }
    return (
      <div className="whitespace-pre-wrap break-all text-zinc-200">
        {matchRegex ? highlightLine(line, matchRegex) : line}
      </div>
    )
  }

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
          {previous && (
            <span className="text-xs text-amber-400 italic">
              previous instance
            </span>
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

      {/* Search bar and read options */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-1.5 border-b border-zinc-800 shrink-0">
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
        <OptionSelect
          label="Tail"
          value={tailLines}
          choices={TAIL_CHOICES}
          onChange={setTailLines}
        />
        <OptionSelect
          label="Since"
          value={sinceSeconds}
          choices={SINCE_CHOICES}
          onChange={setSinceSeconds}
        />
        <OptionChip
          active={previous}
          onClick={() => setPrevious((v) => !v)}
          title="Read the log of the container's previous instance — what it printed before it last restarted"
        >
          Previous
        </OptionChip>
        <OptionChip
          active={timestamps}
          onClick={() => setTimestamps((v) => !v)}
          title="Prefix each line with the time the container printed it"
        >
          Timestamps
        </OptionChip>
      </div>

      {streamError && (
        <div className="px-3 py-1.5 border-b border-zinc-800 shrink-0 text-xs text-red-400">
          {streamError}
        </div>
      )}

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-relaxed"
      >
        {displayCount === 0 ? (
          <span className="text-zinc-500">
            {searchTerm
              ? "No matching lines."
              : streaming
                ? "Waiting for logs…"
                : "No logs."}
          </span>
        ) : (
          <div
            className="relative w-full"
            style={{ height: rowVirtualizer.getTotalSize() }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {renderLine(virtualRow.index)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
