import type {
  DaemonSetSummary,
  DeploymentSummary,
  EventInfo,
  JobInfo,
  NodeInfo,
  PodSummary,
  PVCInfo,
  StatefulSetSummary,
} from "./k8s"

/**
 * The Overview's triage: which of the objects on screen are actually broken
 * and want a human now, as opposed to the counts beside them. Everything here
 * is derived from lists the Overview already reads, so it costs no extra call,
 * and it is a pure function so the rules can be argued with in a test rather
 * than against a cluster.
 *
 * The bar for an alert is "someone has to do something": a pod that cannot
 * pull its image, a node that stopped reporting, a workload with nothing
 * running. Things that are merely in progress — a rollout part-way through, a
 * pod that started thirty seconds ago — are not alerts, or every cluster would
 * show a wall of them and the wall would be ignored.
 */

export type AlertSeverity = "critical" | "warning"

export interface ClusterAlert {
  /** Stable across refreshes: the same problem keeps the same key, so the
   *  list does not re-order or re-animate under the reader. */
  id: string
  severity: AlertSeverity
  /** What is wrong, in the cluster's own words where it has them
   *  ("CrashLoopBackOff"), so it can be searched for as-is. */
  title: string
  /** The object to act on. `kind` drives the click-through, so it is the
   *  Kubernetes kind, not a label. */
  kind: string
  name: string
  /** `""` for a cluster-scoped object. */
  namespace: string
  /** Why it is listed, and what the reader needs to know to act. */
  detail: string
  /** When the problem is dated from — the object's creation, or the event's
   *  last occurrence. Orders alerts of equal severity. */
  since: string
}

/** A pod status (the kubectl-style one `mapPodSummary` derives) that means the
 *  pod is not going to recover on its own. */
const BROKEN_POD_STATUS = new Set([
  "CrashLoopBackOff",
  "ImagePullBackOff",
  "ErrImagePull",
  "InvalidImageName",
  "CreateContainerConfigError",
  "CreateContainerError",
  "OOMKilled",
  "Error",
  "Evicted",
  "Unknown",
])

/** A pod is normally Pending only while it is being scheduled and pulled; past
 *  this it is usually unschedulable, and that needs someone. */
const PENDING_GRACE_MS = 10 * 60 * 1000

/** Restarts past this on a *running* pod: it is up now, but something is
 *  killing it repeatedly. */
const RESTART_THRESHOLD = 5

/** Event window. Older than this and it is history, not a call to action. */
const EVENT_WINDOW_MS = 60 * 60 * 1000

/**
 * Warning reasons worth surfacing on their own — the ones that name a problem
 * no object status shows. Reasons that only restate a pod status
 * (`BackOff`, `Failed`) are left out: the pod's own alert already says it, and
 * saying it twice makes the list look worse than the cluster is.
 */
const ACTIONABLE_EVENT_REASONS = new Set([
  "FailedScheduling",
  "FailedMount",
  "FailedAttachVolume",
  "FailedCreatePodSandBox",
  "FailedCreate",
  "ProvisioningFailed",
  "VolumeFailedDelete",
  "NodeNotReady",
  "NodeHasInsufficientMemory",
  "NodeHasDiskPressure",
  "FreeDiskSpaceFailed",
  "SystemOOM",
  "Unhealthy",
])

export interface TriageInput {
  pods: PodSummary[]
  nodes: NodeInfo[]
  deployments: DeploymentSummary[]
  statefulSets: StatefulSetSummary[]
  daemonSets: DaemonSetSummary[]
  jobs: JobInfo[]
  pvcs: PVCInfo[]
  events: EventInfo[]
}

const ageMs = (timestamp: string, now: number): number =>
  timestamp ? now - new Date(timestamp).getTime() : 0

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

const objectKey = (ev: EventInfo): string =>
  `${ev.involvedObjectKind}/${ev.namespace}/${ev.involvedObjectName}`

/** The newest event of `reason` about `object`, for the "why" behind a status
 *  that only says "Pending". */
function latestEvent(
  events: EventInfo[],
  kind: string,
  namespace: string,
  name: string,
  reason: string,
): EventInfo | undefined {
  return events
    .filter(
      (ev) =>
        ev.involvedObjectKind === kind &&
        ev.involvedObjectName === name &&
        ev.namespace === namespace &&
        ev.reason === reason,
    )
    .sort((a, b) =>
      (b.lastTimestamp || b.creationTimestamp).localeCompare(
        a.lastTimestamp || a.creationTimestamp,
      ),
    )[0]
}

export function triageCluster(
  input: TriageInput,
  now: number = Date.now(),
): ClusterAlert[] {
  const alerts: ClusterAlert[] = []
  /** Objects that already have an alert, so an event about them does not add a
   *  second row saying the same thing. */
  const covered = new Set<string>()
  const cover = (kind: string, namespace: string, name: string): void => {
    covered.add(`${kind}/${namespace}/${name}`)
  }

  for (const node of input.nodes) {
    if (node.status !== "Ready") {
      alerts.push({
        id: `node-status/${node.name}`,
        severity: "critical",
        title: `Node ${node.status || "NotReady"}`,
        kind: "Node",
        name: node.name,
        namespace: "",
        detail:
          "The kubelet is not reporting Ready. Pods on it keep running but are not restarted elsewhere until the node is deleted or recovers.",
        since: node.creationTimestamp,
      })
      cover("Node", "", node.name)
      continue
    }
    const pressure = node.conditions
      .filter(
        (c) =>
          c.status === "True" &&
          ["MemoryPressure", "DiskPressure", "PIDPressure"].includes(c.type),
      )
      .map((c) => c.type)
    if (pressure.length > 0) {
      alerts.push({
        id: `node-pressure/${node.name}`,
        severity: "critical",
        title: pressure.join(", "),
        kind: "Node",
        name: node.name,
        namespace: "",
        detail:
          "The kubelet is evicting pods to recover resources, and will not accept new ones.",
        since: node.creationTimestamp,
      })
      cover("Node", "", node.name)
    } else if (node.unschedulable) {
      alerts.push({
        id: `node-cordoned/${node.name}`,
        severity: "warning",
        title: "Cordoned",
        kind: "Node",
        name: node.name,
        namespace: "",
        detail:
          "Nothing new schedules here. Uncordon it when whatever it was cordoned for is done.",
        since: node.creationTimestamp,
      })
      cover("Node", "", node.name)
    }
  }

  for (const pod of input.pods) {
    const base = {
      kind: "Pod",
      name: pod.name,
      namespace: pod.namespace,
      since: pod.creationTimestamp,
    }
    if (BROKEN_POD_STATUS.has(pod.status)) {
      alerts.push({
        ...base,
        id: `pod-status/${pod.namespace}/${pod.name}`,
        severity: "critical",
        title: pod.status,
        detail:
          pod.restarts > 0
            ? `${pod.restarts} restart${pod.restarts === 1 ? "" : "s"}. Check the container's logs.`
            : "Check the pod's events and logs.",
      })
      cover("Pod", pod.namespace, pod.name)
      continue
    }
    if (
      pod.status === "Pending" &&
      ageMs(pod.creationTimestamp, now) > PENDING_GRACE_MS
    ) {
      const why = latestEvent(
        input.events,
        "Pod",
        pod.namespace,
        pod.name,
        "FailedScheduling",
      )
      alerts.push({
        ...base,
        id: `pod-pending/${pod.namespace}/${pod.name}`,
        severity: "critical",
        title: "Pending",
        detail:
          why?.message ??
          `Unscheduled for ${formatDuration(ageMs(pod.creationTimestamp, now))} — no node has taken it.`,
      })
      cover("Pod", pod.namespace, pod.name)
      continue
    }
    if (pod.status === "Running" && pod.restarts > RESTART_THRESHOLD) {
      alerts.push({
        ...base,
        id: `pod-restarts/${pod.namespace}/${pod.name}`,
        severity: "warning",
        title: "Restarting repeatedly",
        detail: `${pod.restarts} restarts. Running now, but something keeps killing it.`,
      })
      cover("Pod", pod.namespace, pod.name)
    }
  }

  for (const dep of input.deployments) {
    if (dep.replicas === 0) continue
    if (dep.availableReplicas === 0) {
      alerts.push({
        id: `deployment-down/${dep.namespace}/${dep.name}`,
        severity: "critical",
        title: "No available replicas",
        kind: "Deployment",
        name: dep.name,
        namespace: dep.namespace,
        detail: `0 of ${dep.replicas} available — nothing is serving this Deployment.`,
        since: dep.creationTimestamp,
      })
      cover("Deployment", dep.namespace, dep.name)
    } else if (dep.availableReplicas < dep.replicas) {
      alerts.push({
        id: `deployment-degraded/${dep.namespace}/${dep.name}`,
        severity: "warning",
        title: "Degraded",
        kind: "Deployment",
        name: dep.name,
        namespace: dep.namespace,
        detail: `${dep.availableReplicas} of ${dep.replicas} replicas available${dep.paused ? ", and the rollout is paused" : ""}.`,
        since: dep.creationTimestamp,
      })
      cover("Deployment", dep.namespace, dep.name)
    }
  }

  for (const ss of input.statefulSets) {
    if (ss.replicas === 0) continue
    if (ss.readyReplicas === 0) {
      alerts.push({
        id: `statefulset-down/${ss.namespace}/${ss.name}`,
        severity: "critical",
        title: "No ready replicas",
        kind: "StatefulSet",
        name: ss.name,
        namespace: ss.namespace,
        detail: `0 of ${ss.replicas} ready — nothing is serving this StatefulSet.`,
        since: ss.creationTimestamp,
      })
      cover("StatefulSet", ss.namespace, ss.name)
    } else if (ss.readyReplicas < ss.replicas) {
      alerts.push({
        id: `statefulset-degraded/${ss.namespace}/${ss.name}`,
        severity: "warning",
        title: "Degraded",
        kind: "StatefulSet",
        name: ss.name,
        namespace: ss.namespace,
        detail: `${ss.readyReplicas} of ${ss.replicas} replicas ready.`,
        since: ss.creationTimestamp,
      })
      cover("StatefulSet", ss.namespace, ss.name)
    }
  }

  for (const ds of input.daemonSets) {
    if (ds.desiredNumberScheduled === 0) continue
    if (ds.numberReady === 0) {
      alerts.push({
        id: `daemonset-down/${ds.namespace}/${ds.name}`,
        severity: "critical",
        title: "No ready pods",
        kind: "DaemonSet",
        name: ds.name,
        namespace: ds.namespace,
        detail: `0 of ${ds.desiredNumberScheduled} nodes are running this DaemonSet.`,
        since: ds.creationTimestamp,
      })
      cover("DaemonSet", ds.namespace, ds.name)
    } else if (ds.numberReady < ds.desiredNumberScheduled) {
      alerts.push({
        id: `daemonset-degraded/${ds.namespace}/${ds.name}`,
        severity: "warning",
        title: "Not on every node",
        kind: "DaemonSet",
        name: ds.name,
        namespace: ds.namespace,
        detail: `Ready on ${ds.numberReady} of ${ds.desiredNumberScheduled} nodes.`,
        since: ds.creationTimestamp,
      })
      cover("DaemonSet", ds.namespace, ds.name)
    }
  }

  for (const job of input.jobs) {
    const failed = job.conditions.find(
      (c) => c.type === "Failed" && c.status === "True",
    )
    if (!failed) continue
    alerts.push({
      id: `job-failed/${job.namespace}/${job.name}`,
      severity: "critical",
      title: "Job failed",
      kind: "Job",
      name: job.name,
      namespace: job.namespace,
      detail:
        failed.message ||
        failed.reason ||
        `${job.failed} pod${job.failed === 1 ? "" : "s"} failed; the backoff limit is spent.`,
      since: job.startTime || job.creationTimestamp,
    })
    cover("Job", job.namespace, job.name)
  }

  for (const pvc of input.pvcs) {
    if (pvc.status === "Lost") {
      alerts.push({
        id: `pvc-lost/${pvc.namespace}/${pvc.name}`,
        severity: "critical",
        title: "Volume lost",
        kind: "PersistentVolumeClaim",
        name: pvc.name,
        namespace: pvc.namespace,
        detail:
          "The bound volume is gone. Anything mounting this claim is reading nothing.",
        since: pvc.creationTimestamp,
      })
      cover("PersistentVolumeClaim", pvc.namespace, pvc.name)
    } else if (pvc.status === "Pending") {
      const why = latestEvent(
        input.events,
        "PersistentVolumeClaim",
        pvc.namespace,
        pvc.name,
        "ProvisioningFailed",
      )
      alerts.push({
        id: `pvc-pending/${pvc.namespace}/${pvc.name}`,
        severity: "warning",
        title: "Unbound claim",
        kind: "PersistentVolumeClaim",
        name: pvc.name,
        namespace: pvc.namespace,
        detail:
          why?.message ??
          `No volume bound yet${pvc.storageClass ? ` from ${pvc.storageClass}` : ""}. A pod mounting it will not start.`,
        since: pvc.creationTimestamp,
      })
      cover("PersistentVolumeClaim", pvc.namespace, pvc.name)
    }
  }

  // Warning events last, and only about objects nothing above has flagged —
  // this is where a problem on a kind with no rule of its own shows up.
  const seenEvent = new Set<string>()
  for (const ev of input.events) {
    if (ev.type !== "Warning") continue
    if (!ACTIONABLE_EVENT_REASONS.has(ev.reason)) continue
    const when = ev.lastTimestamp || ev.creationTimestamp
    if (ageMs(when, now) > EVENT_WINDOW_MS) continue
    if (covered.has(objectKey(ev))) continue
    const key = `${objectKey(ev)}/${ev.reason}`
    if (seenEvent.has(key)) continue
    seenEvent.add(key)
    alerts.push({
      id: `event/${key}`,
      severity: "warning",
      title: ev.reason,
      kind: ev.involvedObjectKind,
      name: ev.involvedObjectName,
      namespace: ev.namespace,
      detail:
        ev.count > 1 ? `${ev.message} (×${ev.count})` : ev.message || ev.reason,
      since: when,
    })
  }

  // Critical first, then the freshest problem: an alert that appeared a minute
  // ago is the one being asked about.
  const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1 }
  return alerts.sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] || b.since.localeCompare(a.since),
  )
}

export function countBySeverity(alerts: ClusterAlert[]): {
  critical: number
  warning: number
} {
  return {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
  }
}
