import { useCallback, useEffect, useRef, useState } from "react"

import { WatchResource } from "../../../shared/watch"
import { normalizeIpcError } from "../../lib/ipc-error"
import { useAppStore } from "../../store/app.store"

/** Watch-backed rows are addressed the way the store addresses a selected
 *  item, which every resource served by a watch supports. */
interface Addressable {
  name?: string
  namespace?: string
}

const rowKey = (item: unknown): string => {
  const row = item as Addressable
  return `${row?.namespace ?? ""}/${row?.name ?? ""}`
}

export function useK8sResource<T>(
  fetcher: (ctx?: string, ns?: string) => Promise<T[]>,
  context: string | null,
  options?: {
    paused?: boolean
    namespace?: string | null
    /**
     * Serve this list from a main-process informer instead of re-listing it on
     * every poll tick. The snapshot and the incremental updates are the same
     * shapes `fetcher` returns, and any failure — a role without the `watch`
     * verb, a dropped stream — falls back to polling `fetcher`.
     */
    watch?: WatchResource
  },
): {
  data: T[]
  loading: boolean
  error: string | null
  reload: () => void
  lastRefreshedAt: number | null
} {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null)

  const refreshInterval = useAppStore((s) => s.refreshInterval)
  const paused = options?.paused ?? false
  // null means "all namespaces" — the fetcher then omits the namespace and the
  // handler falls back to a cluster-wide list.
  const namespace = options?.namespace ?? null
  const watch = options?.watch

  // Sticky for the life of the mount: retrying a watch the cluster has already
  // refused would stall every later dependency change behind a doomed request.
  const [watchFailed, setWatchFailed] = useState(false)

  // A watch is a background refresh, so "off" turns it off too. Pausing tears
  // the subscription down instead of buffering, so resuming re-lists rather
  // than leaving the view on a cache that stopped being updated.
  const watching =
    watch !== undefined && !watchFailed && refreshInterval !== "off"

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const contextRef = useRef(context)
  contextRef.current = context

  const namespaceRef = useRef(namespace)
  namespaceRef.current = namespace

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    fetcherRef
      .current(
        contextRef.current ?? undefined,
        namespaceRef.current ?? undefined,
      )
      .then((result) => {
        setData(result)
        setLastRefreshedAt(Date.now())
        setLoading(false)
      })
      .catch((err) => {
        setError(normalizeIpcError(err))
        setLoading(false)
      })
  }, [])

  const reload = useCallback(() => load(false), [load])

  useEffect(() => {
    // While watching, the informer's snapshot is the initial load.
    if (watching) return
    load(false)
  }, [context, namespace, watching, load])

  useEffect(() => {
    if (refreshInterval === "off" || paused || watching) return
    const ms = (refreshInterval as number) * 1000
    const id = setInterval(() => load(true), ms)
    return () => clearInterval(id)
  }, [refreshInterval, paused, load, context, namespace, watching])

  useEffect(() => {
    if (!watching || watch === undefined || paused) return

    let cancelled = false
    let offEvent: (() => void) | null = null
    let offClosed: (() => void) | null = null
    let activeSubId: string | null = null

    setLoading(true)
    window.api
      .startWatch({
        resource: watch,
        contextName: context ?? undefined,
        namespace: namespace ?? undefined,
      })
      .then(({ subId, items }) => {
        if (cancelled) {
          window.api.stopWatch({ subId }).catch(() => {})
          return
        }
        activeSubId = subId
        setData(items as T[])
        setError(null)
        setLoading(false)
        setLastRefreshedAt(Date.now())

        offEvent = window.api.onWatchEvent((message) => {
          if (message.subId !== subId) return
          setData((prev) => {
            const key = rowKey(message.item)
            const at = prev.findIndex((row) => rowKey(row) === key)
            if (message.type === "delete") {
              return at === -1 ? prev : prev.filter((_, i) => i !== at)
            }
            // Replace in place. Dropping and re-appending would make a row jump
            // to the bottom of the table every time it changed.
            if (at === -1) return [...prev, message.item as T]
            const next = [...prev]
            next[at] = message.item as T
            return next
          })
          setLastRefreshedAt(Date.now())
        })

        offClosed = window.api.onWatchClosed((message) => {
          if (message.subId !== subId) return
          // Rows on screen stay put until the polling fallback replaces them.
          setWatchFailed(true)
        })
      })
      .catch(() => {
        if (!cancelled) setWatchFailed(true)
      })

    return () => {
      cancelled = true
      offEvent?.()
      offClosed?.()
      if (activeSubId) {
        window.api.stopWatch({ subId: activeSubId }).catch(() => {})
      }
    }
  }, [watching, watch, paused, context, namespace])

  return { data, loading, error, reload, lastRefreshedAt }
}
