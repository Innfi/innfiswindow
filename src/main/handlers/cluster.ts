import { CoreV1Api, KubeConfig } from "@kubernetes/client-node"

export async function listNamespaces(api: CoreV1Api) {
  const res = await api.listNamespace()
  return res.items.map((ns) => ({
    name: ns.metadata?.name ?? "",
    status: ns.status?.phase ?? "",
    creationTimestamp: ns.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: ns.metadata?.labels ?? {},
    annotations: ns.metadata?.annotations ?? {},
  }))
}

export async function listNodes(api: CoreV1Api) {
  const res = await api.listNode()
  return res.items.map((node) => {
    const labels = node.metadata?.labels ?? {}
    const roles = Object.keys(labels)
      .filter((k) => k.startsWith("node-role.kubernetes.io/"))
      .map((k) => k.replace("node-role.kubernetes.io/", ""))
    const readyCondition = node.status?.conditions?.find(
      (c) => c.type === "Ready",
    )
    const status = readyCondition?.status === "True" ? "Ready" : "NotReady"
    return {
      name: node.metadata?.name ?? "",
      status,
      roles: roles.length > 0 ? roles.join(",") : "<none>",
      creationTimestamp: node.metadata?.creationTimestamp?.toISOString() ?? "",
      version: node.status?.nodeInfo?.kubeletVersion ?? "",
      labels,
      capacity: node.status?.capacity ?? {},
      allocatable: node.status?.allocatable ?? {},
      conditions: (node.status?.conditions ?? []).map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason ?? "",
        message: c.message ?? "",
      })),
    }
  })
}

export function listContexts(kc: KubeConfig) {
  const clusters = kc.getClusters()
  const users = kc.getUsers()
  return kc.getContexts().map((ctx) => {
    const cluster = clusters.find((c) => c.name === ctx.cluster)
    const user = users.find((u) => u.name === ctx.user)
    const server = cluster?.server ?? ""
    const execCommand = user?.exec?.command ?? ""
    let clusterType: "EKS" | "AKS" | "Local" = "Local"
    if (server.includes("eks.amazonaws.com") || execCommand === "aws")
      clusterType = "EKS"
    else if (server.includes("azmk8s.io") || execCommand === "az")
      clusterType = "AKS"
    return { name: ctx.name, cluster: ctx.cluster, user: ctx.user, clusterType }
  })
}

export function getCurrentContext(kc: KubeConfig) {
  return kc.getCurrentContext()
}

export function getClusterType(kc: KubeConfig) {
  const cluster = kc.getCurrentCluster()
  const user = kc.getCurrentUser()
  const server = cluster?.server ?? ""
  const execCommand = user?.exec?.command ?? ""
  if (server.includes("eks.amazonaws.com") || execCommand === "aws")
    return "EKS"
  if (server.includes("azmk8s.io") || execCommand === "az") return "AKS"
  return "Local"
}
