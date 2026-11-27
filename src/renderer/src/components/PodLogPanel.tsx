import { Download, Layers, RefreshCw, Square } from "lucide-react"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import { useAppStore } from "@store/app.store"
import { useVirtualizer } from "@tanstack/react-virtual"

import { Button } from "../../components/ui/Button"
import { normalizeIpcError } from "../../lib/ipc-error"
import { type LogLevel, parseLogLine } from "../../lib/log-format"
import { formatBytes } from "../../lib/utils"

/** Read-option choices, kept short: these are the ones worth a click. */
const TAIL_CHOICES: { label: string; value: number | null }[] = [
  { label: "50", value: 50 },
  { label: "200", value: 200 },
  { label: "1000", value: 1000 },
  { label: "All", value: null },
]

/** The Since choice that swaps the relative cutoffs for an absolute time. Not
 *  a real `sinceSeconds` value: it only ever lives in the select. */
const SINCE_AT_TIME = -1

const SINCE_CHOICES: { label: string; value: number | null }[] = [
  { label: "Any age", value: null },
  { label: "5m", value: 300 },
  { label: "15m", value: 900 },
  { label: "1h", value: 3600 },
  { label: "6h", value: 21600 },
  { label: "24h", value: 86400 },
  { label: "At time…", value: SINCE_AT_TIME },
]

const pad = (n: number): string => String(n).padStart(2, "0")

/** A date as a `datetime-local` input value, in local time to the second. */
function toLocalInputValue(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

/** A `datetime-local` value — local time with no zone — as UTC ISO, or null
 *  while the input is empty or half-typed. */
function localInputToIso(value: string | null): string | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

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

interface LogPiece {
  text: string
  className: string
}

const TIMESTAMP_CLASS = "text-zinc-500"
const CONTAINER_CLASS = "text-violet-400"
const MESSAGE_CLASS = "text-zinc-200"
const LEVEL_CLASS: Record<LogLevel, string> = {
  fatal: "text-red-500 font-bold",
  error: "text-red-400 font-semibold",
  warn: "text-amber-400 font-semibold",
  info: "text-emerald-400",
  debug: "text-sky-400",
  trace: "text-zinc-400",
}

/** Renders colored pieces, wrapping filter matches in <mark>. Matches are
 *  found on the whole line, so one may span pieces (e.g. timestamp + level). */
function renderPieces(pieces: LogPiece[], re: RegExp | null): ReactNode {
  const ranges: [number, number][] = []
  if (re) {
    const full = pieces.map((p) => p.text).join("")
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(full)) !== null) {
      if (m[0].length === 0) break
      ranges.push([m.index, m.index + m[0].length])
    }
  }
  const out: JSX.Element[] = []
  let offset = 0
  let r = 0
  for (const piece of pieces) {
    const end = offset + piece.text.length
    let pos = offset
    while (pos < end) {
      while (r < ranges.length && ranges[r][1] <= pos) r++
      const range = ranges[r]
      if (range && range[0] <= pos) {
        const stop = Math.min(range[1], end)
        out.push(
          <mark key={pos} className="bg-yellow-400 text-zinc-900">
            {piece.text.slice(pos - offset, stop - offset)}
          </mark>,
        )
        pos = stop
      } else {
        const stop = range ? Math.min(range[0], end) : end
        out.push(
          <span key={pos} className={piece.className}>
            {piece.text.slice(pos - offset, stop - offset)}
          </span>,
        )
        pos = stop
      }
    }
    offset = end
  }
  return out
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
  /** The context the tab was opened against, so a read survives a context
   *  switch rather than following the kubeconfig's current one. */
  contextName?: string
  restored?: boolean
}

export function PodLogPanel({
  tabKey,
  namespace,
  podName,
  containers,
  contextName,
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
  // The absolute cutoff as the `datetime-local` input holds it; null while a
  // relative choice is in use.
  const [sinceTime, setSinceTime] = useState<string | null>(null)
  const [savingLog, setSavingLog] = useState(false)
  const [previous, setPrevious] = useState(false)
  const [timestamps, setTimestamps] = useState(false)
  const [colorize, setColorize] = useState(true)
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
  const sinceTimeIso = useMemo(() => localInputToIso(sinceTime), [sinceTime])
  const logOptions = useMemo(
    () => ({
      tailLines,
      sinceSeconds: sinceTime !== null ? null : sinceSeconds,
      sinceTime: sinceTimeIso,
      previous,
      timestamps,
    }),
    [tailLines, sinceSeconds, sinceTime, sinceTimeIso, previous, timestamps],
  )

  function handleSinceChange(value: number | null): void {
    if (value === SINCE_AT_TIME) {
      // Starts an hour back, the middle of the relative choices, rather than
      // at "now", which would show nothing until the input is edited.
      setSinceTime(toLocalInputValue(new Date(Date.now() - 3_600_000)))
      return
    }
    setSinceTime(null)
    setSinceSeconds(value)
  }

  // Saves with a fresh read at the current Tail/Since/Previous/Timestamps
  // settings — the whole of it, not the capped buffer on screen, and without
  // the filter, which is a view over the log rather than part of it.
  async function handleSaveLog(): Promise<void> {
    setSavingLog(true)
    try {
      const { path, bytes } = await window.api.savePodLog({
        contextName,
        namespace,
        podName,
        containers: mergeMode
          ? containers.map((c) => c.name)
          : [selectedContainer],
        options: logOptions,
      })
      if (path) toast.success(`Saved ${formatBytes(bytes ?? 0)} to ${path}`)
    } catch (err) {
      toast.error(`Failed to save log: ${describeLogError(err, previous)}`)
    } finally {
      setSavingLog(false)
    }
  }

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
      .startPodLog(
        namespace,
        podName,
        containerName,
        tabKey,
        logOptions,
        contextName,
      )
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
        .startPodLog(namespace, podName, c.name, sid, logOptions, contextName)
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
    contextName,
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
  }, [mergeMode, namespace, podName, contextName, sessionEnded, logOptions])

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

  /** Colored pieces for one line: the merge-mode container prefix, then the
   *  parsed timestamp / level / message — or the plain line with colors off. */
  function linePieces(line: string, containerName?: string): LogPiece[] {
    const pieces: LogPiece[] = []
    if (containerName !== undefined) {
      pieces.push({ text: `[${containerName}] `, className: CONTAINER_CLASS })
    }
    if (!colorize) {
      pieces.push({ text: line, className: MESSAGE_CLASS })
      return pieces
    }
    for (const seg of parseLogLine(line)) {
      pieces.push({
        text: seg.text,
        className:
          seg.kind === "timestamp"
            ? TIMESTAMP_CLASS
            : seg.kind === "level"
              ? LEVEL_CLASS[seg.level]
              : MESSAGE_CLASS,
      })
    }
    return pieces
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
      return (
        <div className="whitespace-pre-wrap break-all">
          {renderPieces(linePieces(m.line, m.containerName), matchRegex)}
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
      <div className="whitespace-pre-wrap break-all">
        {renderPieces(linePieces(line), matchRegex)}
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
          <Button
            size="icon"
            variant="ghost"
            title="Save log to a file — read afresh with the current Tail, Since, Previous and Timestamps settings; the filter is not applied"
            onClick={handleSaveLog}
            disabled={savingLog || (!mergeMode && !selectedContainer)}
            className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
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
          value={sinceTime !== null ? SINCE_AT_TIME : sinceSeconds}
          choices={SINCE_CHOICES}
          onChange={handleSinceChange}
        />
        {sinceTime !== null && (
          <input
            type="datetime-local"
            step={1}
            value={sinceTime}
            onChange={(e) => setSinceTime(e.target.value)}
            title="Only lines printed at or after this time (your local time zone)"
            className={`text-xs bg-zinc-800 text-zinc-200 border rounded px-1 py-0.5 focus:outline-none [color-scheme:dark] ${sinceTimeIso ? "border-zinc-700" : "border-red-500"}`}
          />
        )}
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
        <OptionChip
          active={colorize}
          onClick={() => setColorize((v) => !v)}
          title="Color timestamps and log levels — detected heuristically; turn off if a format is misread"
        >
          Colors
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
        className="log-scroll flex-1 overflow-y-auto p-2 font-mono text-xs leading-relaxed"
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
