import { CustomObjectsApi } from "@kubernetes/client-node"

export async function getNodeMetrics(
  api: CustomObjectsApi,
): Promise<
  | { nodeName: string; cpuUsage: string; memoryUsage: string }[]
  | { unavailable: true }
> {
  try {
    const res = (await api.listClusterCustomObject({
      group: "metrics.k8s.io",
      version: "v1beta1",
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
    const httpErr = e as {
      response?: { statusCode?: number }
      statusCode?: number
    }
    const code = httpErr.response?.statusCode ?? httpErr.statusCode
    if (code === 404 || code === 403) {
      return { unavailable: true }
    }
    throw e
  }
}
