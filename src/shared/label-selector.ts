import { validateLabelKey, validateLabelValue } from "./labels"

/**
 * The `-l` filter: a label selector typed in the app bar, validated here and
 * pushed down to the API server as the `labelSelector` query parameter (the
 * list summaries carry no labels, so there is nothing to match against in the
 * renderer). The grammar is the one `kubectl` accepts:
 *
 *   app=nginx, app==nginx, app!=nginx      equality
 *   tier in (web, cache)                   set membership
 *   tier notin (batch)
 *   app                                    the key exists
 *   !app                                   the key does not exist
 *
 * Requirements are comma-separated and ANDed together.
 */
export type LabelOperator = "=" | "!=" | "in" | "notin" | "exists" | "!exists"

export interface LabelRequirement {
  key: string
  operator: LabelOperator
  /** Empty for the existence operators. */
  values: string[]
}

export interface LabelSelectorResult {
  /** Canonical form to send to the API server; `""` for an empty or invalid
   *  input. */
  selector: string
  requirements: LabelRequirement[]
  /** What is wrong with the input, or null when it parses. */
  error: string | null
}

const EMPTY: LabelSelectorResult = {
  selector: "",
  requirements: [],
  error: null,
}

/** Splits on commas that are not inside a `(...)` value set. */
function splitRequirements(input: string): string[] | null {
  const parts: string[] = []
  let depth = 0
  let current = ""
  for (const ch of input) {
    if (ch === "(") depth++
    else if (ch === ")") {
      depth--
      if (depth < 0) return null
    }
    if (ch === "," && depth === 0) {
      parts.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  if (depth !== 0) return null
  parts.push(current)
  return parts
}

function parseValueSet(raw: string): {
  values: string[]
  error: string | null
} {
  const values = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "")
  if (values.length === 0) {
    return { values, error: "A set needs at least one value." }
  }
  for (const value of values) {
    const problem = validateLabelValue(value)
    if (problem) return { values, error: problem }
  }
  return { values, error: null }
}

function parseRequirement(raw: string): LabelRequirement | string {
  const text = raw.trim()
  if (text === "") return "Empty requirement — remove the stray comma."

  const setMatch = /^(\S+)\s+(in|notin)\s*\(([^)]*)\)$/.exec(text)
  if (setMatch) {
    const [, key, operator, body] = setMatch
    const keyProblem = validateLabelKey(key)
    if (keyProblem) return keyProblem
    const { values, error } = parseValueSet(body)
    if (error) return error
    return { key, operator: operator as "in" | "notin", values }
  }

  // Equality before existence: an operator anywhere in the text rules out a
  // bare key, and `!=` has to be tried before `!key`.
  for (const operator of ["!=", "==", "="] as const) {
    const at = text.indexOf(operator)
    if (at === -1) continue
    // `key==value` also contains `=` at the same place; the loop order means
    // the longer operator is matched first.
    const key = text.slice(0, at).trim()
    const value = text.slice(at + operator.length).trim()
    const keyProblem = validateLabelKey(key)
    if (keyProblem) return keyProblem
    const valueProblem = validateLabelValue(value)
    if (valueProblem) return valueProblem
    return {
      key,
      operator: operator === "!=" ? "!=" : "=",
      values: value === "" ? [] : [value],
    }
  }

  if (text.startsWith("!")) {
    const key = text.slice(1).trim()
    const keyProblem = validateLabelKey(key)
    if (keyProblem) return keyProblem
    return { key, operator: "!exists", values: [] }
  }

  if (/\s/.test(text)) {
    return `"${text}" is not a requirement — expected key=value, key in (a,b), key or !key.`
  }
  const keyProblem = validateLabelKey(text)
  if (keyProblem) return keyProblem
  return { key: text, operator: "exists", values: [] }
}

export function formatRequirement(req: LabelRequirement): string {
  switch (req.operator) {
    case "=":
      return `${req.key}=${req.values[0] ?? ""}`
    case "!=":
      return `${req.key}!=${req.values[0] ?? ""}`
    case "in":
      return `${req.key} in (${req.values.join(",")})`
    case "notin":
      return `${req.key} notin (${req.values.join(",")})`
    case "exists":
      return req.key
    case "!exists":
      return `!${req.key}`
  }
}

/**
 * Parses the typed selector. The canonical `selector` is what goes on the
 * wire, so whitespace differences don't count as a new filter and re-list every
 * view.
 */
/** Whether `selector` pins `key` to exactly `value` — what a label rendered as
 *  active in a detail panel means. */
export function hasLabelEquality(
  selector: string,
  key: string,
  value: string,
): boolean {
  const { requirements } = parseLabelSelector(selector)
  return requirements.some(
    (r) => r.key === key && r.operator === "=" && r.values[0] === value,
  )
}

/**
 * Adds `key=value` to `selector`, or takes it out again when it is already
 * there — clicking a label in a detail panel, and clicking it a second time.
 * Any other requirement on the same key is replaced rather than ANDed with:
 * two equalities on one key match nothing, and a click is meant to narrow the
 * list, not empty it. Returns the canonical form, so it can go straight to the
 * store.
 */
export function toggleLabelEquality(
  selector: string,
  key: string,
  value: string,
): string {
  const { requirements } = parseLabelSelector(selector)
  const already = requirements.some(
    (r) => r.key === key && r.operator === "=" && r.values[0] === value,
  )
  const rest = requirements.filter((r) => r.key !== key)
  const next = already
    ? rest
    : [...rest, { key, operator: "=" as const, values: [value] }]
  return next.map(formatRequirement).join(",")
}

export function parseLabelSelector(input: string): LabelSelectorResult {
  if (input.trim() === "") return EMPTY
  const parts = splitRequirements(input)
  if (parts === null) {
    return { selector: "", requirements: [], error: "Unbalanced parentheses." }
  }
  const requirements: LabelRequirement[] = []
  for (const part of parts) {
    const parsed = parseRequirement(part)
    if (typeof parsed === "string") {
      return { selector: "", requirements: [], error: parsed }
    }
    requirements.push(parsed)
  }
  return {
    selector: requirements.map(formatRequirement).join(","),
    requirements,
    error: null,
  }
}
