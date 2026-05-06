import { useCallback, useEffect, useRef, useState } from "react"

import { useAppStore } from "../../store/app.store"

export function useK8sResource<T>(
  fetcher: (ctx?: string) => Promise<T[]>,
  context: string | null,
  options?: { paused?: boolean },
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

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const contextRef = useRef(context)
  contextRef.current = context

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    fetcherRef
      .current(contextRef.current ?? undefined)
      .then((result) => {
        setData(result)
        setLastRefreshedAt(Date.now())
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }, [])

  const reload = useCallback(() => load(false), [load])

  useEffect(() => {
    load(false)
  }, [context])

  useEffect(() => {
    if (refreshInterval === "off" || paused) return
    const ms = (refreshInterval as number) * 1000
    const id = setInterval(() => load(true), ms)
    return () => clearInterval(id)
  }, [refreshInterval, paused, load, context])

  return { data, loading, error, reload, lastRefreshedAt }
}
