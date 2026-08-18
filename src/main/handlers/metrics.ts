import { CustomObjectsApi } from "@kubernetes/client-node"

import { parseCpuToNanocores, parseMemoryToBytes } from "../../shared/quantity"
import { MetricsUnavailable, NodeMetric, PodMetric } from "./types"

const METRICS_GROUP = "metrics.k8s.io"
const METRICS_VERSION = "v1beta1"

/** metrics-server is optional: a cluster without it answers 404, and a role
 *  without access to `metrics.k8s.io` answers 403. Neither is an error the
 *  view should surface — both mean "no metrics here". */
function asUnavailable(e: unknown): MetricsUnavailable {
  const httpErr = e as {
    response?: { statusCode?: number }
    statusCode?: number
    code?: number
  }
  const code =
    httpErr.response?.statusCode ?? httpErr.statusCode ?? httpErr.code
  if (code === 404 || code === 403) return { unavailable: true }
  throw e
}

interface RawPodMetrics {
  metadata: { name: string; namespace: string; creationTimestamp?: string }
  timestamp?: string
  window?: string
  containers: Array<{ name: string; usage: { cpu: string; memory: string } }>
}

function mapPodMetric(raw: RawPodMetrics): PodMetric {
  const containers = (raw.containers ?? []).map((c) => ({
    name: c.name,
    cpuNanocores: parseCpuToNanocores(c.usage?.cpu ?? "0"),
    memoryBytes: parseMemoryToBytes(c.usage?.memory ?? "0"),
  }))
  return {
    podName: raw.metadata?.name ?? "",
    namespace: raw.metadata?.namespace ?? "",
    window: raw.window ?? "",
    timestamp: raw.timestamp ?? raw.metadata?.creationTimestamp ?? "",
    cpuNanocores: containers.reduce((sum, c) => sum + c.cpuNanocores, 0),
    memoryBytes: containers.reduce((sum, c) => sum + c.memoryBytes, 0),
    containers,
  }
}

export async function getNodeMetrics(
  api: CustomObjectsApi,
): Promise<NodeMetric[] | MetricsUnavailable> {
  try {
    const res = (await api.listClusterCustomObject({
      group: METRICS_GROUP,
      version: METRICS_VERSION,
      plural: "nodes",
    })) as {
      items: Array<{
        metadata: { name: string }
        usage: { cpu: string; memory: string }
      }>
    }
    return res.items.map((item) => ({
      nodeName: item.metadata.name,
      cpuUsage: item.usage.cpu,
      memoryUsage: item.usage.memory,
    }))
  } catch (e: unknown) {
    return asUnavailable(e)
  }
}

/** Current usage for every pod, or for one namespace when given. Readings are
 *  a point sample over metrics-server's window — there is no history here. */
export async function getPodMetrics(
  api: CustomObjectsApi,
  namespace?: string,
): Promise<PodMetric[] | MetricsUnavailable> {
  try {
    const res = (await (namespace
      ? api.listNamespacedCustomObject({
          group: METRICS_GROUP,
          version: METRICS_VERSION,
          namespace,
          plural: "pods",
        })
      : api.listClusterCustomObject({
          group: METRICS_GROUP,
          version: METRICS_VERSION,
          plural: "pods",
        }))) as { items: RawPodMetrics[] }
    return (res.items ?? []).map(mapPodMetric)
  } catch (e: unknown) {
    return asUnavailable(e)
  }
}

/** One pod's usage. A pod the metrics pipeline hasn't sampled yet (just
 *  scheduled, or scraped less often than it is polled) 404s like a missing
 *  metrics-server does, so both arrive as `unavailable`. */
export async function getPodMetric(
  api: CustomObjectsApi,
  namespace: string,
  name: string,
): Promise<PodMetric | MetricsUnavailable> {
  try {
    const res = (await api.getNamespacedCustomObject({
      group: METRICS_GROUP,
      version: METRICS_VERSION,
      namespace,
      plural: "pods",
      name,
    })) as RawPodMetrics
    return mapPodMetric(res)
  } catch (e: unknown) {
    return asUnavailable(e)
  }
}
