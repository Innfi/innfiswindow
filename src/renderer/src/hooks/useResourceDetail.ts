import { useCallback, useEffect, useRef, useState } from "react"

import { normalizeIpcError } from "../../lib/ipc-error"
import { useAppStore } from "../../store/app.store"

export type ResourceDetailFetcher<T> = (
  ctx: string | undefined,
  namespace: string,
  name: string,
) => Promise<T>

interface SelectedRow {
  name: string
  namespace?: string | null
}

/**
 * Fetches the full object behind a selected list row, and keeps it fresh on the
 * same interval the list refreshes on. List handlers only return summaries, so
 * this is what the detail panel renders from.
 *
 * `item` is null when nothing is selected (or the selection belongs to another
 * view); `fetcher` is undefined for resources whose list shape is already the
 * whole object, and then this hook does nothing.
 */
export function useResourceDetail<T>(
  fetcher: ResourceDetailFetcher<T> | undefined,
  item: SelectedRow | null,
  context: string | null,
  options?: { paused?: boolean },
): { detail: T | null; loading: boolean; error: string | null } {
  const [detail, setDetail] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshInterval = useAppStore((s) => s.refreshInterval)
  const paused = options?.paused ?? false

  // Depend on the identity, not the object: the list re-syncs `selectedItem`
  // with a freshly deserialized row on every poll, which would otherwise
  // re-trigger the fetch each tick.
  const name = item?.name ?? ""
  const namespace = item?.namespace ?? ""

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const contextRef = useRef(context)
  contextRef.current = context

  // Names the request in flight so a slow response for a row the user has
  // already moved off can't overwrite the current one.
  const inFlight = useRef("")

  const load = useCallback(
    (silent: boolean) => {
      const fetch = fetcherRef.current
      if (!fetch || !name) return
      const key = `${contextRef.current ?? ""}/${namespace}/${name}`
      inFlight.current = key
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      fetch(contextRef.current ?? undefined, namespace, name)
        .then((result) => {
          if (inFlight.current !== key) return
          // Compare by content: every poll hands back a newly deserialized
          // object, and writing it unconditionally re-renders the detail panel
          // — resetting its events, metrics and charts — even when nothing
          // about the resource changed.
          setDetail((prev) =>
            JSON.stringify(prev) === JSON.stringify(result) ? prev : result,
          )
          setError(null)
          setLoading(false)
        })
        .catch((err) => {
          if (inFlight.current !== key) return
          setError(normalizeIpcError(err))
          setLoading(false)
        })
    },
    [name, namespace],
  )

  useEffect(() => {
    // Drop the previous row's detail rather than showing it under the new row's
    // name while the fetch is in flight.
    setDetail(null)
    load(false)
  }, [load, context])

  useEffect(() => {
    if (refreshInterval === "off" || paused) return
    const ms = (refreshInterval as number) * 1000
    const id = setInterval(() => load(true), ms)
    return () => clearInterval(id)
  }, [refreshInterval, paused, load, context])

  return { detail, loading, error }
}
