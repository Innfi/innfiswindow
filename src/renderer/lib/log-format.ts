/**
 * Splits a container log line into timestamp / level / message segments so
 * the log panel can color them. Purely heuristic: anything it doesn't
 * recognise stays in the message segment, so a miss only costs color.
 */

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace"

export type LogSegment =
  | { kind: "timestamp"; text: string }
  | { kind: "level"; text: string; level: LogLevel }
  | { kind: "message"; text: string }

// The prefix kubectl's `--timestamps` adds: RFC3339 with nanoseconds, a space.
const K8S_TS =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}) /

// An application's own leading timestamp: ISO-ish date-time or a bare time,
// optionally bracketed.
const APP_TS =
  /^\[?(?:\d{4}[-/]\d{2}[-/]\d{2}[T ])?\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?/

// klog (most Kubernetes components): `I1127 10:00:00.123456`.
const KLOG = /^([IWEF])(\d{4} \d{2}:\d{2}:\d{2}\.\d+)/

const KLOG_LEVEL: Record<string, LogLevel> = {
  I: "info",
  W: "warn",
  E: "error",
  F: "fatal",
}

// `level=info`, `"level":"info"`, `severity: WARN`.
const KEYED_LEVEL =
  /\b(?:level|lvl|severity)["']?\s*[:=]\s*["']?([A-Za-z]+)["']?/i

// Any-case level word in brackets: `[warn]`, `[Error]`.
const BRACKET_LEVEL =
  /\[(fatal|panic|crit(?:ical)?|error|err|warn(?:ing)?|info|debug|trace)\]/i

// A bare level word, upper-case only so prose ("info about...") isn't hit.
const BARE_LEVEL =
  /\b(FATAL|PANIC|CRIT(?:ICAL)?|ERROR|ERR|WARN(?:ING)?|INFO|DEBUG|TRACE)\b/

// Only look for a level this far into the message, so a word deep in the
// text ("... no ERROR here") isn't mistaken for one.
const LEVEL_SCAN_LIMIT = 80

export function toLogLevel(word: string): LogLevel | null {
  const w = word.toLowerCase()
  if (w === "fatal" || w === "panic" || w.startsWith("crit")) return "fatal"
  if (w === "error" || w === "err") return "error"
  if (w.startsWith("warn")) return "warn"
  if (w === "info" || w === "notice") return "info"
  if (w === "debug") return "debug"
  if (w === "trace") return "trace"
  return null
}

export function parseLogLine(line: string): LogSegment[] {
  const out: LogSegment[] = []
  let rest = line

  const k8s = K8S_TS.exec(rest)
  if (k8s) {
    out.push({ kind: "timestamp", text: k8s[0] })
    rest = rest.slice(k8s[0].length)
  }

  const klog = KLOG.exec(rest)
  if (klog) {
    out.push({ kind: "level", text: klog[1], level: KLOG_LEVEL[klog[1]] })
    out.push({ kind: "timestamp", text: klog[2] })
    out.push({ kind: "message", text: rest.slice(klog[0].length) })
    return out
  }

  const app = APP_TS.exec(rest)
  if (app && app[0].length > 0) {
    out.push({ kind: "timestamp", text: app[0] })
    rest = rest.slice(app[0].length)
  }

  const head = rest.slice(0, LEVEL_SCAN_LIMIT)
  const match =
    KEYED_LEVEL.exec(head) ?? BRACKET_LEVEL.exec(head) ?? BARE_LEVEL.exec(head)
  const word = match?.[1]
  const level = word ? toLogLevel(word) : null

  if (match && word && level) {
    // Color just the level word, not the `level=` key or brackets around it.
    const start = match.index + match[0].indexOf(word)
    const end = start + word.length
    if (start > 0) out.push({ kind: "message", text: rest.slice(0, start) })
    out.push({ kind: "level", text: rest.slice(start, end), level })
    rest = rest.slice(end)
  }

  if (rest.length > 0) out.push({ kind: "message", text: rest })
  return out
}
