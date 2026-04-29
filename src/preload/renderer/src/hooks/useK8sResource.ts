import { useCallback, useEffect, useRef, useState } from "react"

export function useK8sResource<T>(
  fetcher: (ctx?: string) => Promise<T[]>,
  context: string | null,
): { data: T[]; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const contextRef = useRef(context)
  contextRef.current = context

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetcherRef
      .current(contextRef.current ?? undefined)
      .then((result) => {
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [context]) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, reload: load }
}
