import { useCallback, useEffect, useRef, useState } from "react"

import { normalizeIpcError } from "../../lib/ipc-error"
import { useAppStore } from "../../store/app.store"

export function useK8sResource<T>(
  fetcher: (ctx?: string, ns?: string) => Promise<T[]>,
  context: string | null,
  options?: { paused?: boolean; namespace?: string | null },
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
    load(false)
  }, [context, namespace])

  useEffect(() => {
    if (refreshInterval === "off" || paused) return
    const ms = (refreshInterval as number) * 1000
    const id = setInterval(() => load(true), ms)
    return () => clearInterval(id)
  }, [refreshInterval, paused, load, context, namespace])

  return { data, loading, error, reload, lastRefreshedAt }
}
