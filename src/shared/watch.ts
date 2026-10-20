// Protocol for the main-process informers in `src/main/informers.ts`. Kept out
// of `k8s.ts` because it describes the transport, not a cluster object.

/** Resources served by a watch instead of full-list polling. */
export const WATCH_RESOURCES = [
  "pods",
  "events",
  "deployments",
  "replicasets",
  "statefulsets",
  "daemonsets",
  "jobs",
  "cronjobs",
  "services",
  "nodes",
  "ingresses",
  "configmaps",
  "secrets",
  "persistentvolumeclaims",
  "horizontalpodautoscalers",
] as const

export type WatchResource = (typeof WATCH_RESOURCES)[number]

export interface WatchStartArgs {
  resource: WatchResource
  contextName?: string
  /** Ignored for a cluster-scoped resource (`nodes`). */
  namespace?: string
  /** The app bar's label selector, applied by the API server to both the
   *  informer's initial list and its watch, so a watched view filters the same
   *  way a polled one does. */
  labelSelector?: string
}

/**
 * The informer's synced cache at subscribe time. Rows are the same summaries
 * `list*` returns, so a view renders identically whether it is watching or
 * polling.
 */
export interface WatchSnapshot<T> {
  subId: string
  items: T[]
}

export type WatchEventType = "add" | "update" | "delete"

export interface WatchEventMessage<T = unknown> {
  subId: string
  type: WatchEventType
  item: T
}

/**
 * Sent when a watch drops after it was established — the API server closed the
 * stream and the re-list failed, or the credentials stopped working. The
 * subscriber is expected to fall back to polling.
 */
export interface WatchClosedMessage {
  subId: string
  error: string
}

// ---------------------------------------------------------------------------
// Falling back and coming back
// ---------------------------------------------------------------------------

/** First wait before re-trying a watch that failed or dropped. */
export const WATCH_RETRY_BASE_MS = 30_000

/** Longest wait between attempts: past this the view polls, and the watch is
 *  still tried now and then. */
export const WATCH_RETRY_MAX_MS = 10 * 60_000

/** A watch that stayed up this long counts as healthy, so a later drop starts
 *  the backoff over instead of continuing it. */
export const WATCH_HEALTHY_MS = 5 * 60_000

/** How long to poll before the `attempt`-th consecutive retry (0-based):
 *  doubling from the base, capped. */
export function watchRetryDelay(attempt: number): number {
  return Math.min(
    WATCH_RETRY_BASE_MS * 2 ** Math.max(0, attempt),
    WATCH_RETRY_MAX_MS,
  )
}

/**
 * Whether a failed watch start is the cluster saying no rather than the network
 * failing: a role without the `watch` verb gets the same 403 on every attempt,
 * so the view polls that target for good instead of retrying it.
 */
export function isPermanentWatchError(message: string): boolean {
  return /\b403\b|forbidden/i.test(message)
}
