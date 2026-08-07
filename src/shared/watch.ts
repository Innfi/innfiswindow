// Protocol for the main-process informers in `src/main/informers.ts`. Kept out
// of `k8s.ts` because it describes the transport, not a cluster object.

/** Resources served by a watch instead of full-list polling. */
export type WatchResource = "pods" | "events"

export interface WatchStartArgs {
  resource: WatchResource
  contextName?: string
  namespace?: string
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
