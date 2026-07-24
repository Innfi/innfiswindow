import { CoreV1Api, KubeConfig } from "@kubernetes/client-node"

import {
  ContextInfo,
  NamespaceInfo,
  NodeAddress,
  NodeInfo,
  NodeSystemInfo,
  NodeTaint,
} from "./types"

export async function listNamespaces(api: CoreV1Api): Promise<NamespaceInfo[]> {
  const res = await api.listNamespace()
  return res.items.map((ns) => ({
    name: ns.metadata?.name ?? "",
    status: ns.status?.phase ?? "",
    creationTimestamp: ns.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: ns.metadata?.labels ?? {},
    annotations: ns.metadata?.annotations ?? {},
  }))
}

export async function listNodes(api: CoreV1Api): Promise<NodeInfo[]> {
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
    const addresses: NodeAddress[] = (node.status?.addresses ?? []).map(
      (a) => ({
        type: a.type,
        address: a.address,
      }),
    )
    const taints: NodeTaint[] = (node.spec?.taints ?? []).map((t) => ({
      key: t.key ?? "",
      effect: t.effect ?? "",
      value: t.value ?? "",
    }))
    const ni = node.status?.nodeInfo
    const systemInfo: NodeSystemInfo = {
      osImage: ni?.osImage ?? "",
      architecture: ni?.architecture ?? "",
      operatingSystem: ni?.operatingSystem ?? "",
      containerRuntimeVersion: ni?.containerRuntimeVersion ?? "",
      kubeletVersion: ni?.kubeletVersion ?? "",
      kubeProxyVersion: ni?.kubeProxyVersion ?? "",
    }
    return {
      name: node.metadata?.name ?? "",
      status,
      roles: roles.length > 0 ? roles.join(",") : "<none>",
      creationTimestamp: node.metadata?.creationTimestamp?.toISOString() ?? "",
      version: node.status?.nodeInfo?.kubeletVersion ?? "",
      labels,
      annotations: node.metadata?.annotations ?? {},
      capacity: node.status?.capacity ?? {},
      allocatable: node.status?.allocatable ?? {},
      conditions: (node.status?.conditions ?? []).map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason ?? "",
        message: c.message ?? "",
      })),
      addresses,
      taints,
      systemInfo,
    }
  })
}

export function listContexts(kc: KubeConfig): ContextInfo[] {
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

export interface ConnectionStatus {
  connected: boolean
  /** Why the probe failed; omitted when connected. */
  reason?: "network" | "auth" | "unknown"
  error?: string
}

function classifyConnectionError(err: unknown): ConnectionStatus {
  const code =
    (err as { code?: unknown }).code ??
    (err as { statusCode?: unknown }).statusCode
  const message = String((err as { message?: unknown }).message ?? err)

  // The server responded with an HTTP status, so the connection is alive and
  // (for anything but 401) the credentials were accepted. 403 = authenticated
  // but not authorized to list namespaces — still a healthy connection.
  if (typeof code === "number") {
    if (code === 401)
      return { connected: false, reason: "auth", error: message }
    if (code >= 200 && code < 500) return { connected: true }
    return { connected: false, reason: "unknown", error: message }
  }

  if (
    /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|ECONNRESET|fetch failed|network|socket hang up/i.test(
      message,
    )
  ) {
    return { connected: false, reason: "network", error: message }
  }
  // Exec credential plugin failures (e.g. `aws eks get-token` when the SSO
  // session has expired) surface here — treat as an auth problem.
  if (/exec|credential|token|unable to|denied|expired/i.test(message)) {
    return { connected: false, reason: "auth", error: message }
  }
  return { connected: false, reason: "unknown", error: message }
}

/** Lightweight liveness/auth probe used by the renderer's periodic check.
 *  Runs the exec credential plugin as a side effect, so a passing probe after
 *  a failure means credentials were successfully refreshed. */
export async function checkConnection(
  api: CoreV1Api,
): Promise<ConnectionStatus> {
  try {
    await api.listNamespace({ limit: 1 })
    return { connected: true }
  } catch (err) {
    return classifyConnectionError(err)
  }
}
