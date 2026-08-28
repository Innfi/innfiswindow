/**
 * The slice of JSONPath a CRD's `additionalPrinterColumns` actually uses.
 *
 * Printer columns are the only reason this exists: without them a custom
 * resource table can show nothing but name and age, and the interesting field
 * — a Certificate's READY, an Application's SYNC STATUS — lives behind a path
 * like `.status.conditions[?(@.type=="Ready")].status`.
 *
 * Supported: dotted keys, `[n]` (negative indices count from the end),
 * `['key']`, `[*]`, and the equality filter `[?(@.a.b=="v")]`. Anything else
 * — script expressions, slices, recursive descent, regex filters — parses to
 * `null`, and the column renders as "—" rather than a wrong value.
 */

type Segment =
  | { kind: "key"; name: string }
  | { kind: "index"; index: number }
  | { kind: "wildcard" }
  | { kind: "filter"; path: string[]; value: string }

const FILTER = /^\?\(\s*@\.([A-Za-z0-9_.\-/]+)\s*==\s*(.+?)\s*\)$/

function unquote(raw: string): string {
  const first = raw[0]
  if ((first === '"' || first === "'") && raw.endsWith(first)) {
    return raw.slice(1, -1)
  }
  return raw
}

function parseBracket(inner: string): Segment | null {
  const body = inner.trim()
  if (body === "*") return { kind: "wildcard" }

  const filter = FILTER.exec(body)
  if (filter) {
    return {
      kind: "filter",
      path: filter[1].split("."),
      value: unquote(filter[2].trim()),
    }
  }

  const quoted = body[0]
  if ((quoted === '"' || quoted === "'") && body.endsWith(quoted)) {
    const name = body.slice(1, -1)
    return name === "" ? null : { kind: "key", name }
  }

  if (/^-?\d+$/.test(body)) return { kind: "index", index: Number(body) }
  return null
}

/** `null` for a path this evaluator does not implement. */
export function parseJsonPath(path: string): Segment[] | null {
  let s = path.trim()
  // kubectl accepts the `{...}` template form as well as a bare path.
  if (s.startsWith("{") && s.endsWith("}")) s = s.slice(1, -1).trim()
  if (s.startsWith("$")) s = s.slice(1)
  if (s === "" || s === ".") return []

  const segments: Segment[] = []
  let i = 0
  while (i < s.length) {
    if (s[i] === ".") {
      // `..` is recursive descent, which this evaluator does not implement.
      if (s[i + 1] === ".") return null
      i++
      continue
    }
    if (s[i] === "[") {
      const end = s.indexOf("]", i)
      if (end === -1) return null
      const segment = parseBracket(s.slice(i + 1, end))
      if (!segment) return null
      segments.push(segment)
      i = end + 1
      continue
    }
    let j = i
    while (j < s.length && s[j] !== "." && s[j] !== "[") j++
    const name = s.slice(i, j)
    if (name === "") return null
    segments.push(name === "*" ? { kind: "wildcard" } : { kind: "key", name })
    i = j
  }
  return segments
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readPath(value: unknown, path: string[]): unknown {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

function step(values: unknown[], segment: Segment): unknown[] {
  const out: unknown[] = []
  for (const value of values) {
    switch (segment.kind) {
      case "key":
        if (isRecord(value)) {
          const next = value[segment.name]
          if (next !== undefined) out.push(next)
        }
        break
      case "index":
        if (Array.isArray(value)) {
          const at =
            segment.index < 0 ? value.length + segment.index : segment.index
          if (at >= 0 && at < value.length) out.push(value[at])
        }
        break
      case "wildcard":
        if (Array.isArray(value)) out.push(...value)
        else if (isRecord(value)) out.push(...Object.values(value))
        break
      case "filter":
        if (Array.isArray(value)) {
          for (const element of value) {
            const found = readPath(element, segment.path)
            // Compared as strings so `[?(@.replicas==3)]` matches a numeric
            // field, which is how the unquoted form reads in practice.
            if (found !== undefined && String(found) === segment.value) {
              out.push(element)
            }
          }
        }
        break
    }
  }
  return out
}

/** A single cell's worth of text, or `null` when the path resolved to nothing.
 *  Objects and arrays are JSON-encoded rather than dropped: a column pointed
 *  at one is rare, and showing it beats showing a blank. */
function scalar(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (value instanceof Date) return value.toISOString()
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

/** The value a printer column shows, or `null` when the path does not resolve
 *  or uses syntax this evaluator does not support. Several matches join with
 *  a comma, the way `kubectl get -o jsonpath` prints a list. */
export function evaluateJsonPath(root: unknown, path: string): string | null {
  const segments = parseJsonPath(path)
  if (segments === null) return null

  let values: unknown[] = [root]
  for (const segment of segments) {
    values = step(values, segment)
    if (values.length === 0) return null
  }

  const parts = values
    .map(scalar)
    .filter((part): part is string => part !== null)
  return parts.length === 0 ? null : parts.join(",")
}
