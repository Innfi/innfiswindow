import {
  CoreV1Api,
  KubeConfig,
  PatchStrategy,
  setHeaderOptions,
  V1Pod,
} from "@kubernetes/client-node"

import {
  validateLabelKey,
  validateLabelValue,
  validateTaint,
} from "../../shared/labels"
import {
  ContextInfo,
  DrainOptions,
  DrainResult,
  MutationResult,
  NamespaceInfo,
  NodeAddress,
  NodeInfo,
  NodeLabelUpdate,
  NodeSystemInfo,
  NodeTaint,
} from "./types"

/** A JSON merge patch, not the strategic merge the client defaults to: it is
 *  the one that deletes a label when its value is null and replaces
 *  `spec.taints` wholesale instead of trying to merge the two lists. */
const JSON_MERGE_PATCH = setHeaderOptions(
  "Content-Type",
  PatchStrategy.MergePatch,
)

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
      unschedulable: node.spec?.unschedulable ?? false,
    }
  })
}

/** Cordon (unschedulable=true) or uncordon (false) a node via a merge patch,
 *  mirroring `kubectl cordon` / `kubectl uncordon`. */
export async function setNodeSchedulable(
  api: CoreV1Api,
  name: string,
  schedulable: boolean,
): Promise<MutationResult> {
  await api.patchNode({ name, body: { spec: { unschedulable: !schedulable } } })
  return { success: true, name }
}

/** Write and drop node labels the way `kubectl label node` does: one merge
 *  patch carrying the new values plus a null for every key being removed.
 *  Keys are validated here so a typo comes back as a message about that key
 *  rather than as a 422 about the whole patch. */
export async function updateNodeLabels(
  api: CoreV1Api,
  name: string,
  update: NodeLabelUpdate,
): Promise<MutationResult> {
  const set = update.set ?? {}
  const remove = update.remove ?? []

  for (const [key, value] of Object.entries(set)) {
    const keyProblem = validateLabelKey(key)
    if (keyProblem) throw new Error(`Label "${key}": ${keyProblem}`)
    const valueProblem = validateLabelValue(value)
    if (valueProblem) throw new Error(`Label "${key}": ${valueProblem}`)
  }
  for (const key of remove) {
    const keyProblem = validateLabelKey(key)
    if (keyProblem) throw new Error(`Label "${key}": ${keyProblem}`)
    if (key in set)
      throw new Error(`Label "${key}" is both set and removed — pick one.`)
  }
  if (Object.keys(set).length === 0 && remove.length === 0) {
    throw new Error("No label changes to apply.")
  }

  const labels: Record<string, string | null> = { ...set }
  for (const key of remove) labels[key] = null

  await api.patchNode(
    { name, body: { metadata: { labels } } },
    JSON_MERGE_PATCH,
  )
  return { success: true, name }
}

/** Replace `spec.taints` wholesale, which is what `kubectl taint` ends up
 *  doing: taints have no merge key, so add and remove are both expressed as
 *  the full list the node should end with. An empty list clears them. */
export async function updateNodeTaints(
  api: CoreV1Api,
  name: string,
  taints: NodeTaint[],
): Promise<MutationResult> {
  const seen = new Set<string>()
  for (const taint of taints) {
    const problem = validateTaint({
      key: taint.key,
      value: taint.value ?? "",
      effect: taint.effect,
    })
    if (problem) throw new Error(`Taint "${taint.key}": ${problem}`)
    // The API server rejects two taints sharing a key and an effect; catching
    // it here names the pair instead of returning a field-index error.
    const id = `${taint.key}:${taint.effect}`
    if (seen.has(id))
      throw new Error(
        `Taint "${taint.key}" appears twice with effect ${taint.effect}.`,
      )
    seen.add(id)
  }

  const body = taints.map((t) => ({
    key: t.key,
    effect: t.effect,
    // An empty value is absent, not "": the two are the same to the scheduler
    // and kubectl prints the absent form.
    ...(t.value ? { value: t.value } : {}),
  }))

  await api.patchNode(
    { name, body: { spec: { taints: body } } },
    JSON_MERGE_PATCH,
  )
  return { success: true, name }
}

const DRAIN_POLL_INTERVAL_MS = 2000
const DEFAULT_DRAIN_TIMEOUT_SECONDS = 300

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Poll the node's pod list until every evicted pod has actually gone. Matches
 *  on UID rather than name: a StatefulSet replacement reuses its pod name, and
 *  treating that as "still terminating" would hang the drain for the full
 *  timeout. Returns the refs still present at the deadline — empty means the
 *  node really is drained. */
async function waitForEvictedPods(
  api: CoreV1Api,
  nodeName: string,
  evicted: Array<{ ref: string; uid: string }>,
  timeoutSeconds: number,
): Promise<string[]> {
  const deadline = Date.now() + timeoutSeconds * 1000
  const outstanding = new Map(evicted.map((p) => [p.uid, p.ref]))

  for (;;) {
    const res = await api.listPodForAllNamespaces({
      fieldSelector: `spec.nodeName=${nodeName}`,
    })
    const liveUids = new Set(res.items.map((p) => p.metadata?.uid ?? ""))
    for (const uid of [...outstanding.keys()]) {
      if (!liveUids.has(uid)) outstanding.delete(uid)
    }
    if (outstanding.size === 0) return []

    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) return [...outstanding.values()]
    await sleep(Math.min(DRAIN_POLL_INTERVAL_MS, remainingMs))
  }
}

/** Drain a node like `kubectl drain`: cordon it, then evict every eligible pod
 *  through the Eviction API so PodDisruptionBudgets are honoured, then wait for
 *  those pods to terminate.
 *
 *  Pods the drain can't safely move — unmanaged pods, DaemonSet pods, pods
 *  holding emptyDir data — are classified *before* anything is evicted, and any
 *  of them aborts the whole drain unless the matching `DrainOptions` flag says
 *  otherwise. kubectl does the same: a node left half-drained is worse than one
 *  not drained at all. Static/mirror pods are always skipped instead, since the
 *  kubelet recreates them from local manifests no matter what we do. */
export async function drainNode(
  api: CoreV1Api,
  name: string,
  options: DrainOptions = {},
): Promise<DrainResult> {
  const {
    force = false,
    gracePeriodSeconds,
    ignoreDaemonSets = true,
    deleteEmptyDirData = false,
    timeoutSeconds = DEFAULT_DRAIN_TIMEOUT_SECONDS,
  } = options

  const result: DrainResult = {
    success: false,
    cordoned: false,
    evicted: 0,
    skipped: [],
    failed: [],
    pending: [],
    timedOut: false,
  }

  await api.patchNode({ name, body: { spec: { unschedulable: true } } })
  result.cordoned = true

  const pods = await api.listPodForAllNamespaces({
    fieldSelector: `spec.nodeName=${name}`,
  })

  const evictable: V1Pod[] = []
  const blockers: string[] = []

  for (const pod of pods.items) {
    const ref = `${pod.metadata?.namespace ?? ""}/${pod.metadata?.name ?? ""}`

    const phase = pod.status?.phase
    if (phase === "Succeeded" || phase === "Failed") continue

    if (
      pod.metadata?.annotations?.["kubernetes.io/config.mirror"] !== undefined
    ) {
      result.skipped.push(ref)
      continue
    }

    const owners = pod.metadata?.ownerReferences ?? []
    if (owners.some((o) => o.kind === "DaemonSet")) {
      if (ignoreDaemonSets) result.skipped.push(ref)
      else blockers.push(`${ref} is managed by a DaemonSet`)
      continue
    }

    if (owners.length === 0 && !force) {
      blockers.push(`${ref} is not managed by a controller`)
      continue
    }

    if (
      !deleteEmptyDirData &&
      (pod.spec?.volumes ?? []).some((v) => v.emptyDir !== undefined)
    ) {
      blockers.push(`${ref} has emptyDir data that would be lost`)
      continue
    }

    evictable.push(pod)
  }

  if (blockers.length > 0) {
    result.error = `Refusing to drain ${name}: ${blockers.join("; ")}`
    return result
  }

  const evicted: Array<{ ref: string; uid: string }> = []

  for (const pod of evictable) {
    const podName = pod.metadata?.name ?? ""
    const namespace = pod.metadata?.namespace ?? ""
    const ref = `${namespace}/${podName}`

    try {
      await api.createNamespacedPodEviction({
        name: podName,
        namespace,
        body: {
          apiVersion: "policy/v1",
          kind: "Eviction",
          metadata: { name: podName, namespace },
          ...(gracePeriodSeconds !== undefined && {
            deleteOptions: { gracePeriodSeconds },
          }),
        },
      })
      result.evicted += 1
      evicted.push({ ref, uid: pod.metadata?.uid ?? "" })
    } catch (e: unknown) {
      result.failed.push({ pod: ref, error: (e as Error).message })
    }
  }

  if (timeoutSeconds > 0 && evicted.length > 0) {
    result.pending = await waitForEvictedPods(
      api,
      name,
      evicted,
      timeoutSeconds,
    )
    result.timedOut = result.pending.length > 0
  }

  result.success = result.failed.length === 0 && !result.timedOut
  return result
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
