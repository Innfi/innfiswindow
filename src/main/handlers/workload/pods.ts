import {
  AppsV1Api,
  CoreV1Api,
  V1Container,
  V1Pod,
  V1ReplicaSet,
} from "@kubernetes/client-node"

import { toIso } from "../time"
import {
  EvictPodOptions,
  MutationResult,
  PodContainerInfo,
  PodInfo,
  PodSummary,
} from "../types"
import { formatVolume, mapDetailedContainer, statusMessage } from "./shared"

function mapPodContainer(
  c: V1Container,
  containerStatuses: { name: string; restartCount?: number }[],
): PodContainerInfo {
  const detailed = mapDetailedContainer(c)
  return {
    ...detailed,
    restartCount:
      containerStatuses.find((cs) => cs.name === c.name)?.restartCount ?? 0,
  }
}

// Derive the status column `kubectl get pods` shows, rather than the bare
// `pod.status.phase`. Phase alone reports "Running" for a container stuck in
// CrashLoopBackOff/ImagePullBackOff and "Running" for a completed job pod, so
// it hides exactly the unhealthy states the list view wants to flag. Mirrors
// kubectl's printPod logic (init containers → container waiting/terminated
// reasons → Completed/deletion overrides).
function computePodStatus(pod: V1Pod): string {
  let reason = pod.status?.phase ?? ""
  if (pod.status?.reason) reason = pod.status.reason

  const initStatuses = pod.status?.initContainerStatuses ?? []
  const initSpecCount = pod.spec?.initContainers?.length ?? 0
  let initializing = false
  for (let i = 0; i < initStatuses.length; i++) {
    const state = initStatuses[i].state
    const term = state?.terminated
    const wait = state?.waiting
    if (term && term.exitCode === 0) {
      continue
    } else if (term) {
      if (!term.reason) {
        reason = term.signal
          ? `Init:Signal:${term.signal}`
          : `Init:ExitCode:${term.exitCode}`
      } else {
        reason = `Init:${term.reason}`
      }
      initializing = true
    } else if (wait && wait.reason && wait.reason !== "PodInitializing") {
      reason = `Init:${wait.reason}`
      initializing = true
    } else {
      reason = `Init:${i}/${initSpecCount}`
      initializing = true
    }
    break
  }

  if (!initializing) {
    let hasRunning = false
    const statuses = pod.status?.containerStatuses ?? []
    for (let i = statuses.length - 1; i >= 0; i--) {
      const cs = statuses[i]
      const term = cs.state?.terminated
      const wait = cs.state?.waiting
      if (wait && wait.reason) {
        reason = wait.reason
      } else if (term && term.reason) {
        reason = term.reason
      } else if (term && !term.reason) {
        reason = term.signal
          ? `Signal:${term.signal}`
          : `ExitCode:${term.exitCode}`
      } else if (cs.ready && cs.state?.running) {
        hasRunning = true
      }
    }
    if (reason === "Completed" && hasRunning) {
      const podReady = (pod.status?.conditions ?? []).some(
        (c) => c.type === "Ready" && c.status === "True",
      )
      reason = podReady ? "Running" : "NotReady"
    }
  }

  if (pod.metadata?.deletionTimestamp) {
    reason = pod.status?.reason === "NodeLost" ? "Unknown" : "Terminating"
  }

  return reason
}

/** `namespace/replicaSetName` → the workload that owns the ReplicaSet, normally
 *  a Deployment. Resolving a pod's Deployment by stripping the pod-template
 *  hash off the RS name is wrong for any Deployment whose own name ends in
 *  `-<alnum>`, so ask the ReplicaSet who owns it instead. Returns null when the
 *  caller can't list ReplicaSets (a pods-only RBAC role), leaving the caller on
 *  the name-stripping fallback rather than failing the whole pod list. */
async function buildReplicaSetOwnerMap(
  appsV1: AppsV1Api,
  namespace?: string,
): Promise<Map<string, { kind: string; name: string }> | null> {
  try {
    const res = namespace
      ? await appsV1.listNamespacedReplicaSet({ namespace })
      : await appsV1.listReplicaSetForAllNamespaces()
    const owners = new Map<string, { kind: string; name: string }>()
    for (const rs of res.items) {
      const entry = replicaSetOwnerEntry(rs)
      if (entry?.owner) owners.set(entry.key, entry.owner)
    }
    return owners
  } catch {
    return null
  }
}

/** One ReplicaSet's contribution to the owner map above, in the key format
 *  `mapPodSummary` looks up. `owner` is null for a standalone ReplicaSet, which
 *  still has a key so a watch can evict it. Exported for the pods informer,
 *  which keeps its map current from a ReplicaSet watch instead of rebuilding it
 *  per list. */
export function replicaSetOwnerEntry(
  rs: V1ReplicaSet,
): { key: string; owner: { kind: string; name: string } | null } | null {
  const name = rs.metadata?.name ?? ""
  if (!name) return null
  const key = `${rs.metadata?.namespace ?? ""}/${name}`
  const owner = (rs.metadata?.ownerReferences ?? [])[0]
  return { key, owner: owner ? { kind: owner.kind, name: owner.name } : null }
}

/** `rsOwners` maps `namespace/replicaSetName` to whatever owns that ReplicaSet;
 *  null when the caller couldn't build one, which drops back to stripping the
 *  pod-template hash off the RS name.
 *
 *  Exported for the pods informer, which maps one pod at a time off the watch
 *  stream rather than a whole list. */
export function mapPodSummary(
  pod: V1Pod,
  rsOwners: Map<string, { kind: string; name: string }> | null,
): PodSummary {
  const owners = pod.metadata?.ownerReferences ?? []
  const firstOwner = owners[0]
  let deploymentName = ""
  let ownerKind = ""
  let ownerName = ""
  if (firstOwner) {
    if (firstOwner.kind === "ReplicaSet") {
      const podNamespace = pod.metadata?.namespace ?? ""
      const rsOwner = rsOwners?.get(`${podNamespace}/${firstOwner.name}`)
      ownerKind = rsOwner?.kind ?? "Deployment"
      ownerName = rsOwner?.name ?? firstOwner.name.replace(/-[a-z0-9]+$/, "")
      deploymentName = ownerKind === "Deployment" ? ownerName : ""
    } else {
      ownerKind = firstOwner.kind
      ownerName = firstOwner.name
    }
  }
  const restarts = (pod.status?.containerStatuses ?? []).reduce(
    (sum, cs) => sum + (cs.restartCount ?? 0),
    0,
  )
  return {
    name: pod.metadata?.name ?? "",
    namespace: pod.metadata?.namespace ?? "",
    deployment: deploymentName,
    ownerKind,
    ownerName,
    app: pod.metadata?.labels?.["app"] ?? "",
    status: computePodStatus(pod),
    restarts,
    creationTimestamp: toIso(pod.metadata?.creationTimestamp),
    nodeName: pod.spec?.nodeName ?? "",
  }
}

function mapPodInfo(
  pod: V1Pod,
  rsOwners: Map<string, { kind: string; name: string }> | null,
): PodInfo {
  const containerStatuses = pod.status?.containerStatuses ?? []
  const initContainerStatuses = pod.status?.initContainerStatuses ?? []
  return {
    ...mapPodSummary(pod, rsOwners),
    labels: pod.metadata?.labels ?? {},
    annotations: pod.metadata?.annotations ?? {},
    serviceAccountName: pod.spec?.serviceAccountName ?? "",
    qosClass: pod.status?.qosClass ?? "",
    initContainers: (pod.spec?.initContainers ?? []).map((c) =>
      mapPodContainer(c, initContainerStatuses),
    ),
    containers: (pod.spec?.containers ?? []).map((c) =>
      mapPodContainer(c, containerStatuses),
    ),
    // EphemeralContainerCommon is a field-for-field copy of Container that the
    // API server keeps as a separate type only to reject the fields ephemeral
    // containers may not set, so the same mapping reads both.
    ephemeralContainers: (pod.spec?.ephemeralContainers ?? []).map((c) =>
      mapPodContainer(
        c as V1Container,
        pod.status?.ephemeralContainerStatuses ?? [],
      ),
    ),
    volumes: (pod.spec?.volumes ?? []).map(formatVolume),
    conditions: (pod.status?.conditions ?? []).map((c) => ({
      type: c.type,
      status: c.status,
      reason: c.reason ?? "",
      message: c.message ?? "",
    })),
  }
}

export async function listPods(
  api: CoreV1Api,
  namespace?: string,
  appsV1?: AppsV1Api,
  labelSelector?: string,
  fieldSelector?: string,
): Promise<PodSummary[]> {
  const res = namespace
    ? await api.listNamespacedPod({ namespace, labelSelector, fieldSelector })
    : await api.listPodForAllNamespaces({ labelSelector, fieldSelector })

  // Only pay for the extra list call when some pod is actually RS-owned.
  const anyReplicaSetOwned = res.items.some((p) =>
    (p.metadata?.ownerReferences ?? []).some((o) => o.kind === "ReplicaSet"),
  )
  const rsOwners =
    appsV1 && anyReplicaSetOwned
      ? await buildReplicaSetOwnerMap(appsV1, namespace)
      : null

  return res.items.map((pod) => mapPodSummary(pod, rsOwners))
}

export async function getPod(
  api: CoreV1Api,
  namespace: string,
  name: string,
  appsV1?: AppsV1Api,
): Promise<PodInfo> {
  const pod = await api.readNamespacedPod({ name, namespace })
  // One pod needs at most one ReplicaSet resolved, so read that one rather
  // than listing every ReplicaSet the way the list handler has to.
  const owner = (pod.metadata?.ownerReferences ?? [])[0]
  let rsOwners: Map<string, { kind: string; name: string }> | null = null
  if (appsV1 && owner?.kind === "ReplicaSet") {
    try {
      const rs = await appsV1.readNamespacedReplicaSet({
        name: owner.name,
        namespace,
      })
      const rsOwner = (rs.metadata?.ownerReferences ?? [])[0]
      if (rsOwner) {
        rsOwners = new Map([
          [
            `${namespace}/${owner.name}`,
            { kind: rsOwner.kind, name: rsOwner.name },
          ],
        ])
      }
    } catch {
      // Same fallback as the list path: leave rsOwners null and strip the hash.
    }
  }
  return mapPodInfo(pod, rsOwners)
}

/** Evict a pod through the `policy/v1` Eviction subresource — what
 *  `kubectl drain` issues per pod, and the only delete path that consults
 *  PodDisruptionBudgets. A budget that would be violated comes back as HTTP
 *  429 with a `DisruptionBudget` reason; that is a "try again later", not a
 *  failure of the request, so it gets a message saying so rather than the raw
 *  "Too Many Requests" the client reports. */
export async function evictPod(
  api: CoreV1Api,
  namespace: string,
  name: string,
  options: EvictPodOptions = {},
): Promise<MutationResult> {
  const { gracePeriodSeconds, dryRun = false } = options
  const deleteOptions = {
    ...(gracePeriodSeconds !== undefined && { gracePeriodSeconds }),
    ...(dryRun && { dryRun: ["All"] }),
  }

  try {
    await api.createNamespacedPodEviction({
      name,
      namespace,
      body: {
        apiVersion: "policy/v1",
        kind: "Eviction",
        metadata: { name, namespace },
        ...(Object.keys(deleteOptions).length > 0 && { deleteOptions }),
      },
    })
  } catch (e: unknown) {
    throw new Error(describeEvictionError(e, namespace, name))
  }
  return { success: true, name, namespace }
}

/** Turn an eviction rejection into something that names the actual blocker.
 *  The API server puts the useful part in the Status body, which the generated
 *  client leaves as an unparsed string on the error. */
function describeEvictionError(
  err: unknown,
  namespace: string,
  name: string,
): string {
  const e = err as {
    code?: number
    statusCode?: number
    response?: { statusCode?: number }
    body?: unknown
    message?: string
  }
  const code = e?.response?.statusCode ?? e?.statusCode ?? e?.code
  const detail = statusMessage(e?.body) ?? e?.message ?? String(err)

  if (code === 429) {
    return `Cannot evict ${namespace}/${name} right now: a PodDisruptionBudget would be violated (${detail}). Retry once another replica is ready, or delete the pod to bypass the budget.`
  }
  if (code === 500 && /disruption/i.test(detail)) {
    return `Cannot evict ${namespace}/${name}: the disruption controller could not evaluate the PodDisruptionBudget (${detail}).`
  }
  return detail
}
