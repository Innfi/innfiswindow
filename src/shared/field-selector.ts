/**
 * The `--field-selector` filter: like the label selector, it is answered by the
 * API server rather than here, but unlike labels it is not open-ended. A kind
 * can only be filtered on the fields its registry declares selectable, and
 * anything else comes back as
 * `field label not supported: <key>` — a 400 on every poll tick. So the
 * supported keys are listed per kind below, the input validates against the
 * kind being viewed, and a kind with nothing worth filtering on is not offered
 * the box at all.
 *
 * The grammar is the one `kubectl` accepts, and it is smaller than the label
 * one: equality and inequality only, comma-separated and ANDed.
 *
 *   status.phase=Running        equality (`==` is accepted for it too)
 *   spec.nodeName!=node-1       inequality
 *   spec.nodeName=              the empty value, e.g. an unscheduled pod
 */

export type FieldOperator = "=" | "!="

export interface FieldRequirement {
  key: string
  operator: FieldOperator
  /** May be empty: `spec.nodeName=` is a selector in its own right. */
  value: string
}

export interface FieldSelectorResult {
  /** Canonical form to send to the API server; `""` for an empty or invalid
   *  input. */
  selector: string
  requirements: FieldRequirement[]
  /** What is wrong with the input, or null when it parses. */
  error: string | null
}

const EMPTY: FieldSelectorResult = {
  selector: "",
  requirements: [],
  error: null,
}

/**
 * What each kind's registry indexes, as the app bar offers it. Every kind also
 * indexes `metadata.name`, and every namespaced one `metadata.namespace`, so
 * those are listed here too — they are what makes a selector like
 * `metadata.namespace!=kube-system` possible, which no other filter in the app
 * can express.
 *
 * Keyed by the view's resource type rather than the Kubernetes kind, since the
 * app bar asks about the view it is sitting above. Kinds that index nothing
 * beyond their own name are deliberately absent: the name filter already
 * covers that, and an input offering only `metadata.name` would be a worse way
 * to type it.
 */
export const FIELD_SELECTOR_FIELDS: Record<string, readonly string[]> = {
  Pods: [
    "metadata.name",
    "metadata.namespace",
    "spec.nodeName",
    "spec.restartPolicy",
    "spec.schedulerName",
    "spec.serviceAccountName",
    "status.phase",
    "status.podIP",
    "status.nominatedNodeName",
  ],
  Events: [
    "metadata.name",
    "metadata.namespace",
    "involvedObject.kind",
    "involvedObject.namespace",
    "involvedObject.name",
    "involvedObject.uid",
    "involvedObject.apiVersion",
    "involvedObject.resourceVersion",
    "involvedObject.fieldPath",
    "reason",
    "reportingComponent",
    "source",
    "type",
  ],
  Nodes: ["metadata.name", "spec.unschedulable"],
  Secrets: ["metadata.name", "metadata.namespace", "type"],
  Namespaces: ["metadata.name", "status.phase"],
}

/** The fields the given view can be filtered on; empty when it offers none,
 *  which is also how the app bar decides whether to show the box. */
export function fieldSelectorFields(
  resourceType: string | null,
): readonly string[] {
  if (resourceType === null) return []
  return FIELD_SELECTOR_FIELDS[resourceType] ?? []
}

export function formatFieldRequirement(req: FieldRequirement): string {
  return `${req.key}${req.operator}${req.value}`
}

function parseRequirement(
  part: string,
  allowed: readonly string[],
): FieldRequirement | string {
  const text = part.trim()
  if (text === "") return "Empty requirement — remove the stray comma."

  const notEqual = text.indexOf("!=")
  // `==` is the same operator as `=`, so the longer spelling is normalised away
  // rather than kept as written.
  const equal =
    text.indexOf("==") !== -1 ? text.indexOf("==") : text.indexOf("=")
  let key: string
  let operator: FieldOperator
  let value: string
  if (notEqual !== -1 && (equal === -1 || notEqual <= equal)) {
    key = text.slice(0, notEqual)
    operator = "!="
    value = text.slice(notEqual + 2)
  } else if (equal !== -1) {
    key = text.slice(0, equal)
    operator = "="
    value = text.slice(equal + (text.startsWith("==", equal) ? 2 : 1))
  } else {
    return `"${text}" is not a field requirement — write key=value or key!=value.`
  }

  key = key.trim()
  value = value.trim()
  if (key === "")
    return "A field requirement needs a field before the operator."
  if (!allowed.includes(key)) {
    return `This kind cannot be filtered on ${key}. It indexes: ${allowed.join(", ")}.`
  }
  return { key, operator, value }
}

/**
 * Parses and validates a field selector against the fields `allowed` for the
 * kind being viewed. Only a selector that parses should reach the store: a
 * half-typed one would otherwise be sent to the API server on every poll.
 * The canonical form is what goes over the wire, so whitespace alone never
 * counts as a new filter.
 */
export function parseFieldSelector(
  input: string,
  allowed: readonly string[],
): FieldSelectorResult {
  if (input.trim() === "") return EMPTY
  if (allowed.length === 0) {
    return {
      selector: "",
      requirements: [],
      error: "This kind cannot be filtered by field.",
    }
  }
  const requirements: FieldRequirement[] = []
  const seen = new Set<string>()
  for (const part of input.split(",")) {
    const parsed = parseRequirement(part, allowed)
    if (typeof parsed === "string") {
      return { selector: "", requirements: [], error: parsed }
    }
    // Two equalities on one field match nothing, which is never what was meant.
    const signature = `${parsed.key}${parsed.operator}`
    if (parsed.operator === "=" && seen.has(signature)) {
      return {
        selector: "",
        requirements: [],
        error: `${parsed.key} is pinned to two values at once, which matches nothing.`,
      }
    }
    seen.add(signature)
    requirements.push(parsed)
  }
  return {
    selector: requirements.map(formatFieldRequirement).join(","),
    requirements,
    error: null,
  }
}
