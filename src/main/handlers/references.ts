import {
  AppsV1Api,
  AutoscalingV2Api,
  BatchV1Api,
  CoreV1Api,
  DiscoveryV1Api,
  KubeConfig,
  KubernetesObjectApi,
  NetworkingV1Api,
  V1Ingress,
  V1ObjectMeta,
  V1OwnerReference,
  V1PodSpec,
} from "@kubernetes/client-node"

import { RelatedResource, ResourceRelations } from "./types"

/**
 * The clients the relation walk may reach for. A superset of any one lookup —
 * which of them are touched depends on the target's kind. `ApiClients` from
 * `src/main/ipc/context-clients.ts` satisfies this structurally, so a caller
 * hands its whole set over.
 */
export interface RelationClients {
  coreV1: CoreV1Api
  appsV1: AppsV1Api
  autoscalingV2: AutoscalingV2Api
  batchV1: BatchV1Api
  discoveryV1: DiscoveryV1Api
  networkingV1: NetworkingV1Api
}

/** The object to walk out from. `apiVersion` comes from the caller — the
 *  renderer's GVK table for a built-in kind, the CRD for a custom one — so
 *  nothing here needs a kind→group table of its own. */
export interface RelationTarget {
  apiVersion: string
  kind: string
  name: string
  /** Omitted or `""` for a cluster-scoped kind. */
  namespace?: string
}

/** How many entries a group may carry. A reverse lookup over pods can match
 *  thousands; the panel is a navigation aid, not a list view. */
const MAX_PER_GROUP = 50

/** How far the ownerReference walk climbs before giving up. Real chains are
 *  two links (Pod → ReplicaSet → Deployment); anything deeper is a loop or an
 *  operator doing something unusual, and neither is worth more requests. */
const MAX_OWNER_DEPTH = 8

/** Page size for the cluster-wide lists a reverse lookup has to do without a
 *  server-side selector (pods by priority class, PVCs by storage class). The
 *  cap above trims the answer anyway; this stops the request itself from
 *  pulling every object in a large cluster over the wire. */
const LIST_PAGE_LIMIT = 500

type K8sObject = {
  apiVersion?: string
  kind?: string
  metadata?: V1ObjectMeta
  spec?: Record<string, unknown>
  status?: Record<string, unknown>
}

/** Collects what went wrong and whether anything was cut off, so a partial
 *  answer is reported as partial instead of as an empty one. */
interface Accumulator {
  errors: string[]
  truncated: boolean
}

function message(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

/** Runs one lookup, recording a failure rather than failing the whole panel:
 *  a kind the cluster doesn't serve, or a list this identity may not read,
 *  should cost that one group and nothing else. */
async function attempt<T>(
  acc: Accumulator,
  label: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    acc.errors.push(`${label}: ${message(err)}`)
    return null
  }
}

/** Notes truncation on the accumulator when a list came back at the page
 *  limit with more behind it. */
function noteContinued(
  acc: Accumulator,
  list: { metadata?: { _continue?: string } } | null,
): void {
  if (list?.metadata?._continue) acc.truncated = true
}

function dedupe(items: RelatedResource[]): RelatedResource[] {
  const seen = new Set<string>()
  const out: RelatedResource[] = []
  for (const item of items) {
    if (!item.name) continue
    const key = `${item.kind}/${item.namespace}/${item.name}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function capped(acc: Accumulator, items: RelatedResource[]): RelatedResource[] {
  if (items.length <= MAX_PER_GROUP) return items
  acc.truncated = true
  return items.slice(0, MAX_PER_GROUP)
}

function ref(
  kind: string,
  name: string | undefined,
  namespace: string,
  detail: string,
): RelatedResource {
  return { kind, name: name ?? "", namespace, detail }
}

function ownedBy(meta: V1ObjectMeta | undefined, uid: string): boolean {
  return (meta?.ownerReferences ?? []).some((owner) => owner.uid === uid)
}

/** `key=value,key=value`, the only selector form these lookups need — every
 *  selector read here is a `matchLabels`-style map. */
function toLabelSelector(selector: Record<string, string>): string {
  return Object.entries(selector)
    .map(([key, value]) => `${key}=${value}`)
    .join(",")
}

/** True when every entry of `selector` is present on `labels`. An empty
 *  selector matches nothing here on purpose: a Service without one is fed by
 *  hand-written Endpoints, not by pods. */
function selectorMatches(
  selector: Record<string, string> | undefined,
  labels: Record<string, string> | undefined,
): boolean {
  const entries = Object.entries(selector ?? {})
  if (entries.length === 0) return false
  const actual = labels ?? {}
  return entries.every(([key, value]) => actual[key] === value)
}

// ---------------------------------------------------------------------------
// Generic reads
// ---------------------------------------------------------------------------

async function readObject(
  kc: KubeConfig,
  apiVersion: string,
  kind: string,
  name: string,
  namespace?: string,
): Promise<K8sObject> {
  const client = KubernetesObjectApi.makeApiClient(kc)
  const res = await client.read({
    apiVersion,
    kind,
    metadata: { name, ...(namespace ? { namespace } : {}) },
  })
  return ((res as { body?: unknown }).body ?? res) as K8sObject
}

/** An ownerReference can only name an object in the child's own namespace or a
 *  cluster-scoped one, and the reference itself doesn't say which — so the
 *  namespaced path is tried first and the cluster-scoped one second. */
async function readOwner(
  kc: KubeConfig,
  owner: V1OwnerReference,
  namespace: string,
): Promise<K8sObject> {
  if (!namespace) {
    return readObject(kc, owner.apiVersion, owner.kind, owner.name)
  }
  try {
    return await readObject(
      kc,
      owner.apiVersion,
      owner.kind,
      owner.name,
      namespace,
    )
  } catch {
    return readObject(kc, owner.apiVersion, owner.kind, owner.name)
  }
}

// ---------------------------------------------------------------------------
// Owners (up) and dependents (down)
// ---------------------------------------------------------------------------

/** `metadata.ownerReferences` followed to the root, nearest owner first. The
 *  controller reference is the one followed: a plain owner reference marks a
 *  lifetime link (garbage collection) rather than the thing managing the
 *  object, and only stands in when there is no controller. */
async function ownerChain(
  kc: KubeConfig,
  acc: Accumulator,
  object: K8sObject,
): Promise<RelatedResource[]> {
  const chain: RelatedResource[] = []
  const seen = new Set<string>()
  let current = object

  for (let depth = 0; depth < MAX_OWNER_DEPTH; depth++) {
    const refs = current.metadata?.ownerReferences ?? []
    if (refs.length === 0) break
    const owner = refs.find((r) => r.controller) ?? refs[0]
    const childNamespace = current.metadata?.namespace ?? ""
    const key = `${owner.kind}/${childNamespace}/${owner.name}`
    if (seen.has(key)) break
    seen.add(key)

    const read = await attempt(acc, `owner ${owner.kind}/${owner.name}`, () =>
      readOwner(kc, owner, childNamespace),
    )
    chain.push(
      ref(
        owner.kind,
        owner.name,
        // A read that failed leaves the namespace unknown; the child's is the
        // right guess, since that is the only namespace an owner can be in.
        read ? (read.metadata?.namespace ?? "") : childNamespace,
        owner.controller ? "controller" : "owner",
      ),
    )
    // Without the object there is nothing to read the next reference off.
    if (!read) break
    current = read
  }
  return chain
}

async function podsOwnedBy(
  clients: RelationClients,
  acc: Accumulator,
  namespace: string,
  uid: string,
  detail: string,
): Promise<RelatedResource[]> {
  const pods = await attempt(acc, "pods", () =>
    clients.coreV1.listNamespacedPod({ namespace, limit: LIST_PAGE_LIMIT }),
  )
  noteContinued(acc, pods)
  return (pods?.items ?? [])
    .filter((pod) => ownedBy(pod.metadata, uid))
    .map((pod) => ref("Pod", pod.metadata?.name, namespace, detail))
}

/** Objects whose own ownerReferences point back at this one. Only the kinds
 *  that actually have controllers below them are looked up — for anything else
 *  the answer is a guaranteed-empty list of requests. */
async function dependentsOf(
  clients: RelationClients,
  acc: Accumulator,
  object: K8sObject,
): Promise<RelatedResource[]> {
  const uid = object.metadata?.uid ?? ""
  const namespace = object.metadata?.namespace ?? ""
  // Every controller below is namespaced, and matching by uid needs the uid.
  if (!uid || !namespace) return []

  switch (object.kind) {
    case "Deployment": {
      const sets = await attempt(acc, "replica sets", () =>
        clients.appsV1.listNamespacedReplicaSet({ namespace }),
      )
      const owned = (sets?.items ?? []).filter((rs) =>
        ownedBy(rs.metadata, uid),
      )
      const out = owned.map((rs) =>
        ref("ReplicaSet", rs.metadata?.name, namespace, "replica set"),
      )
      // The pods are two links down, which is what "show me this Deployment's
      // pods" actually means — a Deployment owns no pod directly.
      const byUid = new Map(
        owned.map((rs) => [rs.metadata?.uid ?? "", rs.metadata?.name ?? ""]),
      )
      if (byUid.size > 0) {
        const pods = await attempt(acc, "pods", () =>
          clients.coreV1.listNamespacedPod({
            namespace,
            limit: LIST_PAGE_LIMIT,
          }),
        )
        noteContinued(acc, pods)
        for (const pod of pods?.items ?? []) {
          const owner = (pod.metadata?.ownerReferences ?? []).find((o) =>
            byUid.has(o.uid),
          )
          if (owner) {
            out.push(
              ref("Pod", pod.metadata?.name, namespace, `pod of ${owner.name}`),
            )
          }
        }
      }
      return out
    }
    case "ReplicaSet":
    case "StatefulSet":
    case "DaemonSet":
    case "Job":
      return podsOwnedBy(clients, acc, namespace, uid, "pod")
    case "CronJob": {
      const jobs = await attempt(acc, "jobs", () =>
        clients.batchV1.listNamespacedJob({ namespace }),
      )
      const owned = (jobs?.items ?? []).filter((job) =>
        ownedBy(job.metadata, uid),
      )
      const out = owned.map((job) =>
        ref("Job", job.metadata?.name, namespace, "job"),
      )
      const byUid = new Map(
        owned.map((job) => [job.metadata?.uid ?? "", job.metadata?.name ?? ""]),
      )
      if (byUid.size > 0) {
        const pods = await attempt(acc, "pods", () =>
          clients.coreV1.listNamespacedPod({
            namespace,
            limit: LIST_PAGE_LIMIT,
          }),
        )
        noteContinued(acc, pods)
        for (const pod of pods?.items ?? []) {
          const owner = (pod.metadata?.ownerReferences ?? []).find((o) =>
            byUid.has(o.uid),
          )
          if (owner) {
            out.push(
              ref("Pod", pod.metadata?.name, namespace, `pod of ${owner.name}`),
            )
          }
        }
      }
      return out
    }
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// References (spec fields, both directions)
// ---------------------------------------------------------------------------

/** Everything a pod spec names by hand — the same set whether it came off a
 *  live Pod or off a workload's `spec.template`. */
function podSpecReferences(
  spec: V1PodSpec | undefined,
  namespace: string,
): RelatedResource[] {
  if (!spec) return []
  const out: RelatedResource[] = []
  const add = (
    kind: string,
    name: string | undefined,
    detail: string,
  ): void => {
    if (name) out.push(ref(kind, name, namespace, detail))
  }

  add("ServiceAccount", spec.serviceAccountName, "service account")
  if (spec.priorityClassName) {
    out.push(ref("PriorityClass", spec.priorityClassName, "", "priority class"))
  }
  for (const secret of spec.imagePullSecrets ?? []) {
    add("Secret", secret.name, "image pull secret")
  }

  for (const volume of spec.volumes ?? []) {
    const where = `volume "${volume.name}"`
    add("ConfigMap", volume.configMap?.name, where)
    add("Secret", volume.secret?.secretName, where)
    add("PersistentVolumeClaim", volume.persistentVolumeClaim?.claimName, where)
    for (const source of volume.projected?.sources ?? []) {
      add("ConfigMap", source.configMap?.name, `projected ${where}`)
      add("Secret", source.secret?.name, `projected ${where}`)
    }
  }

  for (const container of [
    ...(spec.initContainers ?? []),
    ...(spec.containers ?? []),
  ]) {
    for (const from of container.envFrom ?? []) {
      add("ConfigMap", from.configMapRef?.name, `envFrom in ${container.name}`)
      add("Secret", from.secretRef?.name, `envFrom in ${container.name}`)
    }
    for (const env of container.env ?? []) {
      const where = `env ${env.name} in ${container.name}`
      add("ConfigMap", env.valueFrom?.configMapKeyRef?.name, where)
      add("Secret", env.valueFrom?.secretKeyRef?.name, where)
    }
  }
  return out
}

/** True when the Ingress routes anything to `service`. */
function ingressUsesService(ingress: V1Ingress, service: string): boolean {
  if (ingress.spec?.defaultBackend?.service?.name === service) return true
  return (ingress.spec?.rules ?? []).some((rule) =>
    (rule.http?.paths ?? []).some(
      (path) => path.backend.service?.name === service,
    ),
  )
}

type ReferenceResolver = (
  clients: RelationClients,
  acc: Accumulator,
  object: K8sObject,
) => Promise<RelatedResource[]>

/** Kinds an HorizontalPodAutoscaler can scale. A DaemonSet has no replica
 *  count and a Job's is fixed, so neither is worth the list call. */
const SCALABLE_KINDS = new Set(["Deployment", "ReplicaSet", "StatefulSet"])

/** Pod-template references, plus the autoscaler driving the replica count.
 *  Shared by every workload whose spec has a `template` directly on it. */
const workloadReferences: ReferenceResolver = async (clients, acc, object) => {
  const namespace = object.metadata?.namespace ?? ""
  const name = object.metadata?.name ?? ""
  const template = (object.spec as { template?: { spec?: V1PodSpec } })
    ?.template
  const out = podSpecReferences(template?.spec, namespace)

  if (SCALABLE_KINDS.has(object.kind ?? "")) {
    const hpas = await attempt(acc, "autoscalers", () =>
      clients.autoscalingV2.listNamespacedHorizontalPodAutoscaler({
        namespace,
      }),
    )
    for (const hpa of hpas?.items ?? []) {
      const target = hpa.spec?.scaleTargetRef
      if (target && target.kind === object.kind && target.name === name) {
        out.push(
          ref(
            "HorizontalPodAutoscaler",
            hpa.metadata?.name,
            namespace,
            "autoscales this",
          ),
        )
      }
    }
  }
  return out
}

/** Pods in `namespace` this object is named by, judged with the same reader
 *  the forward direction uses — so a ConfigMap mounted as a volume, pulled in
 *  through `envFrom`, and read by one key all count. */
async function podsReferencing(
  clients: RelationClients,
  acc: Accumulator,
  namespace: string,
  kind: string,
  name: string,
): Promise<RelatedResource[]> {
  const pods = await attempt(acc, "pods", () =>
    clients.coreV1.listNamespacedPod({ namespace, limit: LIST_PAGE_LIMIT }),
  )
  noteContinued(acc, pods)
  const out: RelatedResource[] = []
  for (const pod of pods?.items ?? []) {
    const used = podSpecReferences(pod.spec, namespace).find(
      (r) => r.kind === kind && r.name === name,
    )
    if (used) {
      out.push(ref("Pod", pod.metadata?.name, namespace, used.detail))
    }
  }
  return out
}

const REFERENCE_RESOLVERS: Record<string, ReferenceResolver> = {
  Pod: async (clients, acc, object) => {
    const namespace = object.metadata?.namespace ?? ""
    const spec = object.spec as V1PodSpec | undefined
    const out = podSpecReferences(spec, namespace)
    if (spec?.nodeName) {
      out.push(ref("Node", spec.nodeName, "", "scheduled here"))
    }
    const services = await attempt(acc, "services", () =>
      clients.coreV1.listNamespacedService({ namespace }),
    )
    for (const service of services?.items ?? []) {
      if (selectorMatches(service.spec?.selector, object.metadata?.labels)) {
        out.push(
          ref("Service", service.metadata?.name, namespace, "selects this pod"),
        )
      }
    }
    return out
  },

  Deployment: workloadReferences,
  ReplicaSet: workloadReferences,
  StatefulSet: workloadReferences,
  DaemonSet: workloadReferences,
  Job: workloadReferences,

  CronJob: async (_clients, _acc, object) => {
    const namespace = object.metadata?.namespace ?? ""
    const spec = object.spec as
      | { jobTemplate?: { spec?: { template?: { spec?: V1PodSpec } } } }
      | undefined
    return podSpecReferences(spec?.jobTemplate?.spec?.template?.spec, namespace)
  },

  Service: async (clients, acc, object) => {
    const namespace = object.metadata?.namespace ?? ""
    const name = object.metadata?.name ?? ""
    const out: RelatedResource[] = []

    // Endpoints take the Service's own name, so a field selector answers
    // "does one exist" without a 404 to swallow.
    const endpoints = await attempt(acc, "endpoints", () =>
      clients.coreV1.listNamespacedEndpoints({
        namespace,
        fieldSelector: `metadata.name=${name}`,
      }),
    )
    for (const endpoint of endpoints?.items ?? []) {
      out.push(
        ref("Endpoints", endpoint.metadata?.name, namespace, "endpoints"),
      )
    }

    const slices = await attempt(acc, "endpoint slices", () =>
      clients.discoveryV1.listNamespacedEndpointSlice({
        namespace,
        labelSelector: `kubernetes.io/service-name=${name}`,
      }),
    )
    for (const slice of slices?.items ?? []) {
      out.push(
        ref("EndpointSlice", slice.metadata?.name, namespace, "endpoint slice"),
      )
    }

    const selector = (object.spec as { selector?: Record<string, string> })
      ?.selector
    if (selector && Object.keys(selector).length > 0) {
      const pods = await attempt(acc, "pods", () =>
        clients.coreV1.listNamespacedPod({
          namespace,
          labelSelector: toLabelSelector(selector),
          limit: LIST_PAGE_LIMIT,
        }),
      )
      noteContinued(acc, pods)
      for (const pod of pods?.items ?? []) {
        out.push(ref("Pod", pod.metadata?.name, namespace, "selected pod"))
      }
    }

    const ingresses = await attempt(acc, "ingresses", () =>
      clients.networkingV1.listNamespacedIngress({ namespace }),
    )
    for (const ingress of ingresses?.items ?? []) {
      if (ingressUsesService(ingress, name)) {
        out.push(
          ref("Ingress", ingress.metadata?.name, namespace, "routes to this"),
        )
      }
    }
    return out
  },

  Endpoints: async (clients, acc, object) => {
    const namespace = object.metadata?.namespace ?? ""
    const name = object.metadata?.name ?? ""
    const out: RelatedResource[] = []
    // Hand-written Endpoints without a Service of the same name are legal, so
    // this is a lookup rather than an assumption.
    const services = await attempt(acc, "services", () =>
      clients.coreV1.listNamespacedService({
        namespace,
        fieldSelector: `metadata.name=${name}`,
      }),
    )
    for (const service of services?.items ?? []) {
      out.push(ref("Service", service.metadata?.name, namespace, "service"))
    }
    const slices = await attempt(acc, "endpoint slices", () =>
      clients.discoveryV1.listNamespacedEndpointSlice({
        namespace,
        labelSelector: `kubernetes.io/service-name=${name}`,
      }),
    )
    for (const slice of slices?.items ?? []) {
      out.push(
        ref(
          "EndpointSlice",
          slice.metadata?.name,
          namespace,
          "slice for the same service",
        ),
      )
    }
    return out
  },

  EndpointSlice: async (clients, acc, object) => {
    const namespace = object.metadata?.namespace ?? ""
    const service =
      object.metadata?.labels?.["kubernetes.io/service-name"] ?? ""
    if (!service) return []
    const out = [ref("Service", service, namespace, "service")]
    // The old Endpoints object still exists alongside the slices on every
    // supported cluster, under the Service's name.
    const endpoints = await attempt(acc, "endpoints", () =>
      clients.coreV1.listNamespacedEndpoints({
        namespace,
        fieldSelector: `metadata.name=${service}`,
      }),
    )
    for (const endpoint of endpoints?.items ?? []) {
      out.push(
        ref(
          "Endpoints",
          endpoint.metadata?.name,
          namespace,
          "endpoints for the same service",
        ),
      )
    }
    return out
  },

  Ingress: async (_clients, _acc, object) => {
    const namespace = object.metadata?.namespace ?? ""
    const spec = object.spec as V1Ingress["spec"]
    const out: RelatedResource[] = []
    if (spec?.ingressClassName) {
      out.push(ref("IngressClass", spec.ingressClassName, "", "ingress class"))
    }
    const backend = spec?.defaultBackend?.service?.name
    if (backend) out.push(ref("Service", backend, namespace, "default backend"))
    for (const rule of spec?.rules ?? []) {
      for (const path of rule.http?.paths ?? []) {
        const name = path.backend.service?.name
        if (name) {
          out.push(
            ref(
              "Service",
              name,
              namespace,
              `backend for ${rule.host ?? "*"}${path.path ?? ""}`,
            ),
          )
        }
      }
    }
    for (const tls of spec?.tls ?? []) {
      if (tls.secretName) {
        out.push(ref("Secret", tls.secretName, namespace, "TLS certificate"))
      }
    }
    return out
  },

  IngressClass: async (clients, acc, object) => {
    const name = object.metadata?.name ?? ""
    const ingresses = await attempt(acc, "ingresses", () =>
      clients.networkingV1.listIngressForAllNamespaces({
        limit: LIST_PAGE_LIMIT,
      }),
    )
    noteContinued(acc, ingresses)
    return (ingresses?.items ?? [])
      .filter((ingress) => ingress.spec?.ingressClassName === name)
      .map((ingress) =>
        ref(
          "Ingress",
          ingress.metadata?.name,
          ingress.metadata?.namespace ?? "",
          "uses this class",
        ),
      )
  },

  PriorityClass: async (clients, acc, object) => {
    const name = object.metadata?.name ?? ""
    // `spec.priorityClassName` is not a selectable field, so this is a plain
    // list filtered here.
    const pods = await attempt(acc, "pods", () =>
      clients.coreV1.listPodForAllNamespaces({ limit: LIST_PAGE_LIMIT }),
    )
    noteContinued(acc, pods)
    return (pods?.items ?? [])
      .filter((pod) => pod.spec?.priorityClassName === name)
      .map((pod) =>
        ref(
          "Pod",
          pod.metadata?.name,
          pod.metadata?.namespace ?? "",
          "uses this class",
        ),
      )
  },

  StorageClass: async (clients, acc, object) => {
    const name = object.metadata?.name ?? ""
    const out: RelatedResource[] = []
    const claims = await attempt(acc, "persistent volume claims", () =>
      clients.coreV1.listPersistentVolumeClaimForAllNamespaces({
        limit: LIST_PAGE_LIMIT,
      }),
    )
    noteContinued(acc, claims)
    for (const claim of claims?.items ?? []) {
      if (claim.spec?.storageClassName === name) {
        out.push(
          ref(
            "PersistentVolumeClaim",
            claim.metadata?.name,
            claim.metadata?.namespace ?? "",
            "uses this class",
          ),
        )
      }
    }
    const volumes = await attempt(acc, "persistent volumes", () =>
      clients.coreV1.listPersistentVolume({ limit: LIST_PAGE_LIMIT }),
    )
    noteContinued(acc, volumes)
    for (const volume of volumes?.items ?? []) {
      if (volume.spec?.storageClassName === name) {
        out.push(
          ref("PersistentVolume", volume.metadata?.name, "", "uses this class"),
        )
      }
    }
    return out
  },

  PersistentVolumeClaim: async (clients, acc, object) => {
    const namespace = object.metadata?.namespace ?? ""
    const name = object.metadata?.name ?? ""
    const spec = object.spec as
      | { storageClassName?: string; volumeName?: string }
      | undefined
    const out: RelatedResource[] = []
    if (spec?.storageClassName) {
      out.push(ref("StorageClass", spec.storageClassName, "", "storage class"))
    }
    if (spec?.volumeName) {
      out.push(ref("PersistentVolume", spec.volumeName, "", "bound volume"))
    }
    out.push(
      ...(await podsReferencing(
        clients,
        acc,
        namespace,
        "PersistentVolumeClaim",
        name,
      )),
    )
    return out
  },

  PersistentVolume: async (_clients, _acc, object) => {
    const spec = object.spec as
      | {
          storageClassName?: string
          claimRef?: { name?: string; namespace?: string }
        }
      | undefined
    const out: RelatedResource[] = []
    if (spec?.storageClassName) {
      out.push(ref("StorageClass", spec.storageClassName, "", "storage class"))
    }
    if (spec?.claimRef?.name) {
      out.push(
        ref(
          "PersistentVolumeClaim",
          spec.claimRef.name,
          spec.claimRef.namespace ?? "",
          "bound claim",
        ),
      )
    }
    return out
  },

  ConfigMap: (clients, acc, object) =>
    podsReferencing(
      clients,
      acc,
      object.metadata?.namespace ?? "",
      "ConfigMap",
      object.metadata?.name ?? "",
    ),

  Secret: (clients, acc, object) =>
    podsReferencing(
      clients,
      acc,
      object.metadata?.namespace ?? "",
      "Secret",
      object.metadata?.name ?? "",
    ),

  ServiceAccount: (clients, acc, object) =>
    podsReferencing(
      clients,
      acc,
      object.metadata?.namespace ?? "",
      "ServiceAccount",
      object.metadata?.name ?? "",
    ),

  Node: async (clients, acc, object) => {
    const name = object.metadata?.name ?? ""
    // `spec.nodeName` is one of the few pod fields the API server indexes, so
    // this one reverse lookup is answered server-side.
    const pods = await attempt(acc, "pods", () =>
      clients.coreV1.listPodForAllNamespaces({
        fieldSelector: `spec.nodeName=${name}`,
        limit: LIST_PAGE_LIMIT,
      }),
    )
    noteContinued(acc, pods)
    return (pods?.items ?? []).map((pod) =>
      ref(
        "Pod",
        pod.metadata?.name,
        pod.metadata?.namespace ?? "",
        "scheduled here",
      ),
    )
  },

  HorizontalPodAutoscaler: async (_clients, _acc, object) => {
    const namespace = object.metadata?.namespace ?? ""
    const target = (
      object.spec as { scaleTargetRef?: { kind?: string; name?: string } }
    )?.scaleTargetRef
    if (!target?.kind || !target.name) return []
    return [ref(target.kind, target.name, namespace, "scale target")]
  },
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Everything one object connects to: its owner chain, what it owns, and what
 * it names (or is named by) through a spec field. Kinds with no resolver come
 * back with the owner/dependent halves filled in and no references, which is
 * the right answer for most of them.
 */
export async function getResourceRelations(
  kc: KubeConfig,
  clients: RelationClients,
  target: RelationTarget,
): Promise<ResourceRelations> {
  const acc: Accumulator = { errors: [], truncated: false }
  const object = await readObject(
    kc,
    target.apiVersion,
    target.kind,
    target.name,
    target.namespace || undefined,
  )
  // The read comes back without a kind on some paths; the caller's is
  // authoritative either way.
  object.kind = target.kind

  const resolve = REFERENCE_RESOLVERS[target.kind]
  const [owners, dependents, references] = await Promise.all([
    ownerChain(kc, acc, object),
    dependentsOf(clients, acc, object),
    resolve ? resolve(clients, acc, object) : Promise.resolve([]),
  ])

  const self = `${target.kind}/${target.namespace ?? ""}/${target.name}`
  const notSelf = (item: RelatedResource): boolean =>
    `${item.kind}/${item.namespace}/${item.name}` !== self

  return {
    owners: capped(acc, dedupe(owners).filter(notSelf)),
    dependents: capped(acc, dedupe(dependents).filter(notSelf)),
    references: capped(acc, dedupe(references).filter(notSelf)),
    errors: acc.errors,
    truncated: acc.truncated,
  }
}
