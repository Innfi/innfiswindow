// Validation for the label keys/values and taints a write can carry, shared by
// the main process (which refuses a bad patch before it reaches the API server)
// and the renderer (which greys out Save and says why). Kubernetes' own rules,
// from k8s.io/apimachinery/pkg/util/validation.

/** The three effects a taint may carry, in the order kubectl prints them. */
export const TAINT_EFFECTS = [
  "NoSchedule",
  "PreferNoSchedule",
  "NoExecute",
] as const

export type TaintEffect = (typeof TAINT_EFFECTS)[number]

const QUALIFIED_NAME = /^[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/
const DNS_SUBDOMAIN =
  /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/
const LABEL_VALUE = /^[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/

/** Prefixes the cluster reserves for itself. Writing one is not refused here —
 *  an admin legitimately edits `node-role.kubernetes.io/*` — but the NodeRestriction
 *  admission plugin rejects some of them, so call sites warn first. */
export const RESERVED_LABEL_PREFIXES = ["kubernetes.io/", "k8s.io/"]

export function isReservedKey(key: string): boolean {
  return RESERVED_LABEL_PREFIXES.some(
    (p) => key.startsWith(p) || key.includes(`.${p}`),
  )
}

/** Returns a message describing what is wrong with the key, or null if it is
 *  valid. Keys are `name` or `prefix/name`. */
export function validateLabelKey(key: string): string | null {
  if (key === "") return "Key is required."
  const slash = key.indexOf("/")
  let name = key
  if (slash !== -1) {
    const prefix = key.slice(0, slash)
    name = key.slice(slash + 1)
    if (key.indexOf("/", slash + 1) !== -1)
      return "Key may contain at most one '/'."
    if (prefix === "") return "Prefix before '/' is empty."
    if (prefix.length > 253) return "Prefix must be 253 characters or fewer."
    if (!DNS_SUBDOMAIN.test(prefix))
      return `Prefix "${prefix}" must be a DNS subdomain (lowercase alphanumerics, '-' and '.').`
  }
  if (name === "") return "Name after '/' is empty."
  if (name.length > 63) return "Name must be 63 characters or fewer."
  if (!QUALIFIED_NAME.test(name))
    return `Name "${name}" must be alphanumeric, '-', '_' or '.', and start and end alphanumeric.`
  return null
}

/** Label values (and taint values) may be empty; anything else is a 63-char
 *  alphanumeric run. */
export function validateLabelValue(value: string): string | null {
  if (value === "") return null
  if (value.length > 63) return "Value must be 63 characters or fewer."
  if (!LABEL_VALUE.test(value))
    return "Value must be alphanumeric, '-', '_' or '.', and start and end alphanumeric."
  return null
}

export function isTaintEffect(effect: string): effect is TaintEffect {
  return (TAINT_EFFECTS as readonly string[]).includes(effect)
}

/** Validates one taint. Its key follows the label-key rules, its value the
 *  label-value rules, and its effect must be one of the three the scheduler
 *  understands. */
export function validateTaint(taint: {
  key: string
  value: string
  effect: string
}): string | null {
  const key = validateLabelKey(taint.key)
  if (key) return key
  const value = validateLabelValue(taint.value)
  if (value) return value
  if (!isTaintEffect(taint.effect))
    return `Effect must be one of ${TAINT_EFFECTS.join(", ")}.`
  return null
}
