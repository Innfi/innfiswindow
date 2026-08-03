import { load as yamlLoad } from "js-yaml"
import {
  AppsV1Api,
  CoreV1Api,
  V1Container,
  V1DaemonSet,
  V1Deployment,
  V1EnvVar,
  V1Pod,
  V1Probe,
  V1ReplicaSet,
  V1StatefulSet,
  V1Volume,
} from "@kubernetes/client-node"

import { toIso } from "./time"
import {
  DaemonSetInfo,
  DaemonSetSummary,
  DeploymentInfo,
  DeploymentRevision,
  DeploymentSummary,
  DetailedContainerInfo,
  EnvVar,
  MutationResult,
  PodContainerInfo,
  PodInfo,
  PodSummary,
  ProbeInfo,
  ReplicaSetInfo,
  ReplicaSetSummary,
  ResourceRef,
  StatefulSetInfo,
  StatefulSetSummary,
  VolumeInfo,
} from "./types"

function formatProbe(probe: V1Probe | null | undefined): ProbeInfo | null {
  if (!probe) return null
  let type = "unknown"
  let description = ""
  if (probe.httpGet) {
    type = "http-get"
    const port = String(probe.httpGet.port ?? "")
    const path = probe.httpGet.path ?? "/"
    const host = probe.httpGet.host ?? ""
    description = `http-get http://${host}:${port}${path}`
  } else if (probe.exec) {
    type = "exec"
    description = `exec [${(probe.exec.command ?? []).join(" ")}]`
  } else if (probe.tcpSocket) {
    type = "tcp-socket"
    description = `tcp-socket :${String(probe.tcpSocket.port ?? "")}`
  }
  return {
    type,
    description,
    initialDelaySeconds: probe.initialDelaySeconds ?? 0,
    periodSeconds: probe.periodSeconds ?? 10,
    timeoutSeconds: probe.timeoutSeconds ?? 1,
    failureThreshold: probe.failureThreshold ?? 3,
    successThreshold: probe.successThreshold ?? 1,
  }
}

function formatEnvVar(env: V1EnvVar): EnvVar {
  if (env.value !== undefined) {
    return { name: env.name, value: env.value }
  }
  if (env.valueFrom) {
    const vf = env.valueFrom
    if (vf.secretKeyRef) {
      return {
        name: env.name,
        value: "",
        valueFrom: `secret:${vf.secretKeyRef.name ?? ""}/${vf.secretKeyRef.key ?? ""}`,
      }
    }
    if (vf.configMapKeyRef) {
      return {
        name: env.name,
        value: "",
        valueFrom: `configmap:${vf.configMapKeyRef.name ?? ""}/${vf.configMapKeyRef.key ?? ""}`,
      }
    }
    if (vf.fieldRef) {
      return {
        name: env.name,
        value: "",
        valueFrom: `field:${vf.fieldRef.fieldPath ?? ""}`,
      }
    }
    if (vf.resourceFieldRef) {
      return {
        name: env.name,
        value: "",
        valueFrom: `resource:${vf.resourceFieldRef.resource ?? ""}`,
      }
    }
  }
  return { name: env.name, value: "" }
}

function formatVolume(vol: V1Volume): VolumeInfo {
  if (vol.persistentVolumeClaim) {
    return {
      name: vol.name,
      type: "PersistentVolumeClaim",
      detail: vol.persistentVolumeClaim.claimName ?? "",
    }
  }
  if (vol.configMap) {
    return {
      name: vol.name,
      type: "ConfigMap",
      detail: vol.configMap.name ?? "",
    }
  }
  if (vol.secret) {
    return {
      name: vol.name,
      type: "Secret",
      detail: vol.secret.secretName ?? "",
    }
  }
  if (vol.emptyDir !== undefined) {
    return { name: vol.name, type: "EmptyDir", detail: "" }
  }
  if (vol.hostPath) {
    return { name: vol.name, type: "HostPath", detail: vol.hostPath.path ?? "" }
  }
  if (vol.projected) {
    return { name: vol.name, type: "Projected", detail: "" }
  }
  return { name: vol.name, type: "Unknown", detail: "" }
}

function mapDetailedContainer(c: V1Container): DetailedContainerInfo {
  return {
    name: c.name,
    image: c.image ?? "",
    ports: (c.ports ?? []).map((p) => ({
      name: p.name ?? "",
      containerPort: p.containerPort,
      protocol: p.protocol ?? "TCP",
    })),
    env: (c.env ?? []).map(formatEnvVar),
    resources: {
      requests: Object.fromEntries(
        Object.entries(c.resources?.requests ?? {}).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
      limits: Object.fromEntries(
        Object.entries(c.resources?.limits ?? {}).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
    },
    volumeMounts: (c.volumeMounts ?? []).map((vm) => ({
      name: vm.name,
      mountPath: vm.mountPath,
      readOnly: vm.readOnly ?? false,
    })),
    livenessProbe: formatProbe(c.livenessProbe),
    readinessProbe: formatProbe(c.readinessProbe),
    startupProbe: formatProbe(c.startupProbe),
  }
}

function mapDeploymentSummary(d: V1Deployment): DeploymentSummary {
  return {
    name: d.metadata?.name ?? "",
    namespace: d.metadata?.namespace ?? "",
    replicas: d.spec?.replicas ?? 0,
    readyReplicas: d.status?.readyReplicas ?? 0,
    updatedReplicas: d.status?.updatedReplicas ?? 0,
    availableReplicas: d.status?.availableReplicas ?? 0,
    creationTimestamp: d.metadata?.creationTimestamp?.toISOString() ?? "",
  }
}

function mapDeploymentInfo(d: V1Deployment): DeploymentInfo {
  const ru = d.spec?.strategy?.rollingUpdate
  return {
    ...mapDeploymentSummary(d),
    strategy: d.spec?.strategy?.type ?? "",
    rollingUpdate: ru
      ? {
          maxUnavailable: String(ru.maxUnavailable ?? "25%"),
          maxSurge: String(ru.maxSurge ?? "25%"),
        }
      : null,
    minReadySeconds: d.spec?.minReadySeconds ?? 0,
    labels: d.metadata?.labels ?? {},
    annotations: d.metadata?.annotations ?? {},
    selector: d.spec?.selector?.matchLabels ?? {},
    podTemplateLabels: d.spec?.template?.metadata?.labels ?? {},
    podTemplateAnnotations: d.spec?.template?.metadata?.annotations ?? {},
    serviceAccountName: d.spec?.template?.spec?.serviceAccountName ?? "",
    containers: (d.spec?.template?.spec?.containers ?? []).map(
      mapDetailedContainer,
    ),
    initContainers: (d.spec?.template?.spec?.initContainers ?? []).map(
      mapDetailedContainer,
    ),
    volumes: (d.spec?.template?.spec?.volumes ?? []).map(formatVolume),
    conditions: (d.status?.conditions ?? []).map((c) => ({
      type: c.type,
      status: c.status,
      reason: c.reason ?? "",
      message: c.message ?? "",
    })),
  }
}

export async function listDeployments(
  api: AppsV1Api,
  namespace?: string,
): Promise<DeploymentSummary[]> {
  const res = namespace
    ? await api.listNamespacedDeployment({ namespace })
    : await api.listDeploymentForAllNamespaces()
  return res.items.map(mapDeploymentSummary)
}

export async function getDeployment(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<DeploymentInfo> {
  return mapDeploymentInfo(
    await api.readNamespacedDeployment({ name, namespace }),
  )
}

function mapReplicaSetSummary(rs: V1ReplicaSet): ReplicaSetSummary {
  return {
    name: rs.metadata?.name ?? "",
    namespace: rs.metadata?.namespace ?? "",
    desiredReplicas: rs.spec?.replicas ?? 0,
    currentReplicas: rs.status?.replicas ?? 0,
    readyReplicas: rs.status?.readyReplicas ?? 0,
    creationTimestamp: rs.metadata?.creationTimestamp?.toISOString() ?? "",
  }
}

function mapReplicaSetInfo(rs: V1ReplicaSet): ReplicaSetInfo {
  return {
    ...mapReplicaSetSummary(rs),
    labels: rs.metadata?.labels ?? {},
    annotations: rs.metadata?.annotations ?? {},
    selector: rs.spec?.selector?.matchLabels ?? {},
    podTemplateLabels: rs.spec?.template?.metadata?.labels ?? {},
    podTemplateAnnotations: rs.spec?.template?.metadata?.annotations ?? {},
    serviceAccountName: rs.spec?.template?.spec?.serviceAccountName ?? "",
    containers: (rs.spec?.template?.spec?.containers ?? []).map(
      mapDetailedContainer,
    ),
    initContainers: (rs.spec?.template?.spec?.initContainers ?? []).map(
      mapDetailedContainer,
    ),
    volumes: (rs.spec?.template?.spec?.volumes ?? []).map(formatVolume),
    ownerReferences: (rs.metadata?.ownerReferences ?? []).map((o) => ({
      kind: o.kind,
      name: o.name,
    })),
  }
}

export async function listReplicaSets(
  api: AppsV1Api,
  namespace?: string,
): Promise<ReplicaSetSummary[]> {
  const res = namespace
    ? await api.listNamespacedReplicaSet({ namespace })
    : await api.listReplicaSetForAllNamespaces()
  return res.items.map(mapReplicaSetSummary)
}

export async function getReplicaSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<ReplicaSetInfo> {
  return mapReplicaSetInfo(
    await api.readNamespacedReplicaSet({ name, namespace }),
  )
}

function mapStatefulSetSummary(ss: V1StatefulSet): StatefulSetSummary {
  return {
    name: ss.metadata?.name ?? "",
    namespace: ss.metadata?.namespace ?? "",
    replicas: ss.spec?.replicas ?? 0,
    readyReplicas: ss.status?.readyReplicas ?? 0,
    creationTimestamp: ss.metadata?.creationTimestamp?.toISOString() ?? "",
    serviceName: ss.spec?.serviceName ?? "",
  }
}

function mapStatefulSetInfo(ss: V1StatefulSet): StatefulSetInfo {
  return {
    ...mapStatefulSetSummary(ss),
    labels: ss.metadata?.labels ?? {},
    annotations: ss.metadata?.annotations ?? {},
    updateStrategy: ss.spec?.updateStrategy?.type ?? "",
    selector: ss.spec?.selector?.matchLabels ?? {},
    podTemplateLabels: ss.spec?.template?.metadata?.labels ?? {},
    podTemplateAnnotations: ss.spec?.template?.metadata?.annotations ?? {},
    serviceAccountName: ss.spec?.template?.spec?.serviceAccountName ?? "",
    containers: (ss.spec?.template?.spec?.containers ?? []).map(
      mapDetailedContainer,
    ),
    initContainers: (ss.spec?.template?.spec?.initContainers ?? []).map(
      mapDetailedContainer,
    ),
    volumes: (ss.spec?.template?.spec?.volumes ?? []).map(formatVolume),
    volumeClaimTemplates: (ss.spec?.volumeClaimTemplates ?? []).map((vct) => ({
      name: vct.metadata?.name ?? "",
      storage: vct.spec?.resources?.requests?.["storage"] ?? "",
    })),
  }
}

export async function listStatefulSets(
  api: AppsV1Api,
  namespace?: string,
): Promise<StatefulSetSummary[]> {
  const res = namespace
    ? await api.listNamespacedStatefulSet({ namespace })
    : await api.listStatefulSetForAllNamespaces()
  return res.items.map(mapStatefulSetSummary)
}

export async function getStatefulSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<StatefulSetInfo> {
  return mapStatefulSetInfo(
    await api.readNamespacedStatefulSet({ name, namespace }),
  )
}

function mapDaemonSetSummary(ds: V1DaemonSet): DaemonSetSummary {
  return {
    name: ds.metadata?.name ?? "",
    namespace: ds.metadata?.namespace ?? "",
    desiredNumberScheduled: ds.status?.desiredNumberScheduled ?? 0,
    currentNumberScheduled: ds.status?.currentNumberScheduled ?? 0,
    numberReady: ds.status?.numberReady ?? 0,
    updatedNumberScheduled: ds.status?.updatedNumberScheduled ?? 0,
    numberAvailable: ds.status?.numberAvailable ?? 0,
    creationTimestamp: ds.metadata?.creationTimestamp?.toISOString() ?? "",
  }
}

function mapDaemonSetInfo(ds: V1DaemonSet): DaemonSetInfo {
  return {
    ...mapDaemonSetSummary(ds),
    labels: ds.metadata?.labels ?? {},
    annotations: ds.metadata?.annotations ?? {},
    updateStrategy: ds.spec?.updateStrategy?.type ?? "",
    selector: ds.spec?.selector?.matchLabels ?? {},
    nodeSelector: ds.spec?.template?.spec?.nodeSelector ?? {},
    podTemplateLabels: ds.spec?.template?.metadata?.labels ?? {},
    podTemplateAnnotations: ds.spec?.template?.metadata?.annotations ?? {},
    serviceAccountName: ds.spec?.template?.spec?.serviceAccountName ?? "",
    containers: (ds.spec?.template?.spec?.containers ?? []).map(
      mapDetailedContainer,
    ),
    initContainers: (ds.spec?.template?.spec?.initContainers ?? []).map(
      mapDetailedContainer,
    ),
    volumes: (ds.spec?.template?.spec?.volumes ?? []).map(formatVolume),
    tolerations: (ds.spec?.template?.spec?.tolerations ?? []).map((t) => ({
      key: t.key ?? "",
      operator: t.operator ?? "",
      value: t.value ?? "",
      effect: t.effect ?? "",
    })),
  }
}

export async function listDaemonSets(
  api: AppsV1Api,
  namespace?: string,
): Promise<DaemonSetSummary[]> {
  const res = namespace
    ? await api.listNamespacedDaemonSet({ namespace })
    : await api.listDaemonSetForAllNamespaces()
  return res.items.map(mapDaemonSetSummary)
}

export async function getDaemonSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<DaemonSetInfo> {
  return mapDaemonSetInfo(
    await api.readNamespacedDaemonSet({ name, namespace }),
  )
}

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
): Promise<PodSummary[]> {
  const res = namespace
    ? await api.listNamespacedPod({ namespace })
    : await api.listPodForAllNamespaces()

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

export async function createDeployment(
  api: AppsV1Api,
  namespace: string,
  name: string,
  image: string,
  replicas: number,
): Promise<ResourceRef> {
  const body = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name, namespace },
    spec: {
      replicas,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: { containers: [{ name, image }] },
      },
    },
  }
  const res = await api.createNamespacedDeployment({ namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function updateDeployment(
  api: AppsV1Api,
  namespace: string,
  name: string,
  image: string,
  replicas: number,
): Promise<ResourceRef> {
  const body = {
    spec: {
      replicas,
      template: {
        spec: {
          containers: [{ name, image }],
        },
      },
    },
  }
  const res = await api.patchNamespacedDeployment({
    name,
    namespace,
    body,
  })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function replaceDeploymentFromYaml(
  api: AppsV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
): Promise<ResourceRef> {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedDeployment({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function createStatefulSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
  image: string,
  replicas: number,
  serviceName: string,
): Promise<ResourceRef> {
  const body = {
    apiVersion: "apps/v1",
    kind: "StatefulSet",
    metadata: { name, namespace },
    spec: {
      replicas,
      serviceName,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: { containers: [{ name, image }] },
      },
    },
  }
  const res = await api.createNamespacedStatefulSet({ namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function updateStatefulSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
  image: string,
  replicas: number,
): Promise<ResourceRef> {
  const body = {
    spec: {
      replicas,
      template: {
        spec: {
          containers: [{ name, image }],
        },
      },
    },
  }
  const res = await api.patchNamespacedStatefulSet({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function replaceStatefulSetFromYaml(
  api: AppsV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
): Promise<ResourceRef> {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedStatefulSet({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function createDaemonSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
  image: string,
): Promise<ResourceRef> {
  const body = {
    apiVersion: "apps/v1",
    kind: "DaemonSet",
    metadata: { name, namespace },
    spec: {
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: { containers: [{ name, image }] },
      },
    },
  }
  const res = await api.createNamespacedDaemonSet({ namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function updateDaemonSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
  image: string,
): Promise<ResourceRef> {
  const body = {
    spec: {
      template: {
        spec: {
          containers: [{ name, image }],
        },
      },
    },
  }
  const res = await api.patchNamespacedDaemonSet({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function replaceDaemonSetFromYaml(
  api: AppsV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
): Promise<ResourceRef> {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedDaemonSet({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function listDeploymentHistory(
  api: AppsV1Api,
  namespace: string,
  deploymentName: string,
  selector: Record<string, string>,
): Promise<DeploymentRevision[]> {
  const labelSelector = Object.entries(selector)
    .map(([k, v]) => `${k}=${v}`)
    .join(",")
  const res = await api.listNamespacedReplicaSet({ namespace, labelSelector })
  const owned = res.items.filter((rs) =>
    (rs.metadata?.ownerReferences ?? []).some(
      (ref) => ref.kind === "Deployment" && ref.name === deploymentName,
    ),
  )
  const revisions = owned
    .map((rs) => {
      const revision = parseInt(
        rs.metadata?.annotations?.["deployment.kubernetes.io/revision"] ?? "0",
        10,
      )
      const changeCause =
        rs.metadata?.annotations?.["kubernetes.io/change-cause"] ?? ""
      const images = (rs.spec?.template?.spec?.containers ?? []).map(
        (c) => c.image ?? "",
      )
      return {
        revision,
        changeCause,
        images,
        creationTimestamp: rs.metadata?.creationTimestamp?.toISOString() ?? "",
      }
    })
    .filter((r) => r.revision > 0)
    .sort((a, b) => b.revision - a.revision)
  return revisions
}

export async function rollbackDeployment(
  api: AppsV1Api,
  namespace: string,
  deploymentName: string,
  revision: number,
): Promise<MutationResult> {
  const res = await api.listNamespacedReplicaSet({ namespace })
  const targetRS = res.items.find((rs) => {
    const isOwned = (rs.metadata?.ownerReferences ?? []).some(
      (ref) => ref.kind === "Deployment" && ref.name === deploymentName,
    )
    const rsRevision = parseInt(
      rs.metadata?.annotations?.["deployment.kubernetes.io/revision"] ?? "0",
      10,
    )
    return isOwned && rsRevision === revision
  })
  if (!targetRS) {
    throw new Error(
      `Revision ${revision} not found for deployment ${deploymentName}`,
    )
  }
  const podTemplateSpec = targetRS.spec?.template
  if (!podTemplateSpec) {
    throw new Error(`No pod template found in revision ${revision}`)
  }
  const body = {
    spec: {
      template: podTemplateSpec,
    },
  }
  await api.patchNamespacedDeployment({ name: deploymentName, namespace, body })
  return { success: true }
}

/** Strategic-merge patch bumping the pod-template restart annotation, which
 *  triggers a rolling restart exactly like `kubectl rollout restart`. */
function restartPatchBody(): object {
  return {
    spec: {
      template: {
        metadata: {
          annotations: {
            "kubectl.kubernetes.io/restartedAt": new Date().toISOString(),
          },
        },
      },
    },
  }
}

export async function restartDeployment(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.patchNamespacedDeployment({
    name,
    namespace,
    body: restartPatchBody(),
  })
  return { success: true, name, namespace }
}

export async function restartStatefulSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.patchNamespacedStatefulSet({
    name,
    namespace,
    body: restartPatchBody(),
  })
  return { success: true, name, namespace }
}

export async function restartDaemonSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.patchNamespacedDaemonSet({
    name,
    namespace,
    body: restartPatchBody(),
  })
  return { success: true, name, namespace }
}
