import { useCallback, useEffect, useRef, useState } from "react"

import { useAppStore } from "../../store/app.store"
import { K8sPodMetric } from "../types/k8s"

/**
 * Current pod usage from metrics-server, keyed `namespace/name`, refreshed on
 * the same interval the lists poll on. Context and namespace come from the
 * store rather than props because the only consumer is a list view that hands
 * its own filtering to `ResourceListView`.
 *
 * Clusters without metrics-server (or a role that can't read
 * `metrics.k8s.io`) report `unavailable`, and the caller drops the columns
 * instead of showing empty ones.
 */
export function usePodMetrics(): {
  metrics: Map<string, K8sPodMetric>
  unavailable: boolean
} {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const refreshInterval = useAppStore((s) => s.refreshInterval)

  const [metrics, setMetrics] = useState<Map<string, K8sPodMetric>>(new Map())
  const [unavailable, setUnavailable] = useState(false)

  const contextRef = useRef(selectedContext)
  contextRef.current = selectedContext
  const namespaceRef = useRef(selectedNamespace)
  namespaceRef.current = selectedNamespace

  const fetchMetrics = useCallback(async () => {
    try {
      const result = await window.api.k8s.getPodMetrics({
        contextName: contextRef.current ?? undefined,
        namespace: namespaceRef.current ?? undefined,
      })
      if ("unavailable" in result) {
        setUnavailable(true)
        setMetrics(new Map())
        return
      }
      setUnavailable(false)
      setMetrics(new Map(result.map((m) => [`${m.namespace}/${m.podName}`, m])))
    } catch {
      // Metrics are decoration on top of the list — a failure here must not
      // take the pod table down with it.
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
  }, [selectedContext, selectedNamespace, fetchMetrics])

  useEffect(() => {
    if (refreshInterval === "off" || unavailable) return
    const id = setInterval(fetchMetrics, (refreshInterval as number) * 1000)
    return () => clearInterval(id)
  }, [refreshInterval, unavailable, fetchMetrics])

  return { metrics, unavailable }
}
