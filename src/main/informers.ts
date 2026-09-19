import { WebContents } from "electron"
import {
  ADD,
  CoreV1Event,
  DELETE,
  ERROR,
  Informer,
  KubernetesListObject,
  KubernetesObject,
  makeInformer,
  ObjectCache,
  UPDATE,
  V1CronJob,
  V1DaemonSet,
  V1Deployment,
  V1Job,
  V1Node,
  V1Pod,
  V1ReplicaSet,
  V1Service,
  V1StatefulSet,
} from "@kubernetes/client-node"

import {
  WATCH_RESOURCES,
  WatchClosedMessage,
  WatchEventMessage,
  WatchEventType,
  WatchResource,
  WatchStartArgs,
} from "../shared/watch"
import { mapCronJob, mapJob } from "./handlers/batch"
import { mapNode } from "./handlers/cluster"
import { mapEvent } from "./handlers/events"
import { mapService } from "./handlers/networking"
import {
  mapDaemonSetSummary,
  mapDeploymentSummary,
  mapPodSummary,
  mapReplicaSetSummary,
  mapStatefulSetSummary,
  replicaSetOwnerEntry,
} from "./handlers/workload"
import {
  ApiClients,
  GetContextClients,
  GetKubeConfig,
} from "./ipc/context-clients"

export const WATCH_EVENT_CHANNEL = "k8s:watch:event"
export const WATCH_CLOSED_CHANNEL = "k8s:watch:closed"

export interface InformerDeps {
  getKubeConfig: GetKubeConfig
  getContextClients: GetContextClients
}

type AnyInformer = Informer<KubernetesObject> & ObjectCache<KubernetesObject>

interface Entry {
  key: string
  informer: AnyInformer
  /** Turns one watched object into the summary the list view renders — the
   *  same shape the matching `list*` handler returns. */
  map: (obj: KubernetesObject) => unknown
  /** Stops anything the entry started besides its own informer (the pods entry
   *  runs a second one over ReplicaSets). */
  stopExtra: () => void
  subs: Map<string, WebContents>
  /** Stopping an informer aborts its watch request, which the informer reports
   *  back as an error. This tells a deliberate teardown apart from a stream
   *  that died on its own. */
  disposed: boolean
}

/**
 * A watched resource that is nothing more than one informer: the collection to
 * watch, the list call the informer builds its cache from (the same collection,
 * so the same filtering), and the handler's own mapper, so a watched row is
 * exactly what the `list*` handler would have returned. Pods aren't here — they
 * also run the ReplicaSet owners watch.
 */
interface WatchSource {
  /** One collection for the whole cluster; `startWatch` drops any namespace. */
  clusterScoped?: boolean
  path: (namespace: string | undefined) => string
  list: (
    clients: ApiClients,
    namespace: string | undefined,
    labelSelector: string | undefined,
  ) => Promise<KubernetesListObject<KubernetesObject>>
  map: (obj: KubernetesObject) => unknown
}

const SOURCES: Record<Exclude<WatchResource, "pods">, WatchSource> = {
  events: {
    path: (ns) => (ns ? `/api/v1/namespaces/${ns}/events` : "/api/v1/events"),
    list: (c, ns, labelSelector) =>
      ns
        ? c.coreV1.listNamespacedEvent({ namespace: ns, labelSelector })
        : c.coreV1.listEventForAllNamespaces({ labelSelector }),
    map: (obj) => mapEvent(obj as CoreV1Event),
  },
  deployments: {
    path: (ns) =>
      ns
        ? `/apis/apps/v1/namespaces/${ns}/deployments`
        : "/apis/apps/v1/deployments",
    list: (c, ns, labelSelector) =>
      ns
        ? c.appsV1.listNamespacedDeployment({ namespace: ns, labelSelector })
        : c.appsV1.listDeploymentForAllNamespaces({ labelSelector }),
    map: (obj) => mapDeploymentSummary(obj as V1Deployment),
  },
  // Its own informer, filtered by the view's selector — not the unfiltered
  // owners informer the pods entry runs, which only resolves owner names.
  replicasets: {
    path: (ns) =>
      ns
        ? `/apis/apps/v1/namespaces/${ns}/replicasets`
        : "/apis/apps/v1/replicasets",
    list: (c, ns, labelSelector) =>
      ns
        ? c.appsV1.listNamespacedReplicaSet({ namespace: ns, labelSelector })
        : c.appsV1.listReplicaSetForAllNamespaces({ labelSelector }),
    map: (obj) => mapReplicaSetSummary(obj as V1ReplicaSet),
  },
  statefulsets: {
    path: (ns) =>
      ns
        ? `/apis/apps/v1/namespaces/${ns}/statefulsets`
        : "/apis/apps/v1/statefulsets",
    list: (c, ns, labelSelector) =>
      ns
        ? c.appsV1.listNamespacedStatefulSet({ namespace: ns, labelSelector })
        : c.appsV1.listStatefulSetForAllNamespaces({ labelSelector }),
    map: (obj) => mapStatefulSetSummary(obj as V1StatefulSet),
  },
  daemonsets: {
    path: (ns) =>
      ns
        ? `/apis/apps/v1/namespaces/${ns}/daemonsets`
        : "/apis/apps/v1/daemonsets",
    list: (c, ns, labelSelector) =>
      ns
        ? c.appsV1.listNamespacedDaemonSet({ namespace: ns, labelSelector })
        : c.appsV1.listDaemonSetForAllNamespaces({ labelSelector }),
    map: (obj) => mapDaemonSetSummary(obj as V1DaemonSet),
  },
  jobs: {
    path: (ns) =>
      ns ? `/apis/batch/v1/namespaces/${ns}/jobs` : "/apis/batch/v1/jobs",
    list: (c, ns, labelSelector) =>
      ns
        ? c.batchV1.listNamespacedJob({ namespace: ns, labelSelector })
        : c.batchV1.listJobForAllNamespaces({ labelSelector }),
    map: (obj) => mapJob(obj as V1Job),
  },
  cronjobs: {
    path: (ns) =>
      ns
        ? `/apis/batch/v1/namespaces/${ns}/cronjobs`
        : "/apis/batch/v1/cronjobs",
    list: (c, ns, labelSelector) =>
      ns
        ? c.batchV1.listNamespacedCronJob({ namespace: ns, labelSelector })
        : c.batchV1.listCronJobForAllNamespaces({ labelSelector }),
    map: (obj) => mapCronJob(obj as V1CronJob),
  },
  services: {
    path: (ns) =>
      ns ? `/api/v1/namespaces/${ns}/services` : "/api/v1/services",
    list: (c, ns, labelSelector) =>
      ns
        ? c.coreV1.listNamespacedService({ namespace: ns, labelSelector })
        : c.coreV1.listServiceForAllNamespaces({ labelSelector }),
    map: (obj) => mapService(obj as V1Service),
  },
  nodes: {
    clusterScoped: true,
    path: () => "/api/v1/nodes",
    list: (c, _ns, labelSelector) => c.coreV1.listNode({ labelSelector }),
    map: (obj) => mapNode(obj as V1Node),
  },
}

function isClusterScoped(resource: WatchResource): boolean {
  return resource !== "pods" && SOURCES[resource].clusterScoped === true
}

/** One informer per context + resource + namespace, shared by every subscriber
 *  that asked for the same thing. */
const entries = new Map<string, Entry>()
/** Entries still starting, so two subscribers racing for the same key (a quick
 *  namespace flip, a remount) wait on one informer rather than each starting
 *  their own and the loser's teardown evicting the winner from `entries`. */
const pending = new Map<string, Promise<Entry>>()
const entryOfSub = new Map<string, Entry>()
/** Senders already wired for teardown, so a renderer that subscribes a dozen
 *  times doesn't accumulate a dozen navigation listeners. */
const hookedSenders = new WeakSet<WebContents>()

let subCounter = 0

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return "watch failed"
}

/**
 * Subscribes `sender` to a watch of `args`, starting the informer if this is
 * the first subscriber. Rejects when the watch can't be established at all
 * (no `watch` verb, unreachable API server), which is the caller's signal to
 * fall back to polling.
 */
export async function startWatch(
  deps: InformerDeps,
  args: WatchStartArgs,
  sender: WebContents,
): Promise<{ subId: string; items: unknown[] }> {
  // A namespace passed for a cluster-scoped resource must neither reach the
  // path nor split the cache into copies of the same collection.
  const target: WatchStartArgs = isClusterScoped(args.resource)
    ? { ...args, namespace: undefined }
    : args
  const key = `${target.contextName ?? ""}|${target.resource}|${target.namespace ?? ""}|${target.labelSelector ?? ""}`

  let entry = entries.get(key)
  if (!entry) {
    let creating = pending.get(key)
    if (!creating) {
      creating = createEntry(deps, target, key)
        .then((created) => {
          entries.set(key, created)
          return created
        })
        .finally(() => pending.delete(key))
      pending.set(key, creating)
    }
    entry = await creating
    // Everyone who subscribed while it was starting has since left.
    if (entry.disposed) return startWatch(deps, args, sender)
  }

  const subId = `watch-${++subCounter}`
  entry.subs.set(subId, sender)
  entryOfSub.set(subId, entry)

  if (!hookedSenders.has(sender)) {
    hookedSenders.add(sender)
    // A reload replaces the renderer without it getting to call `stopWatch`,
    // so its subscriptions would otherwise leak for the life of the app.
    sender.on("did-navigate", () => stopWatchesForSender(sender))
    sender.on("destroyed", () => stopWatchesForSender(sender))
  }

  // Taking the snapshot and forwarding later events happen in the same tick,
  // so nothing can slip between them.
  return { subId, items: entry.informer.list().map(entry.map) }
}

export function stopWatch(subId: string): void {
  const entry = entryOfSub.get(subId)
  if (!entry) return
  entryOfSub.delete(subId)
  entry.subs.delete(subId)
  if (entry.subs.size === 0) disposeEntry(entry)
}

export function stopWatchesForSender(sender: WebContents): void {
  for (const entry of [...entries.values()]) {
    for (const [subId, wc] of [...entry.subs]) {
      if (wc === sender) stopWatch(subId)
    }
  }
}

/** Called on quit: informers hold open HTTP streams that keep the process
 *  alive. */
export function stopAllWatches(): void {
  for (const entry of [...entries.values()]) disposeEntry(entry)
}

function disposeEntry(entry: Entry): void {
  if (entry.disposed) return
  entry.disposed = true
  if (entries.get(entry.key) === entry) entries.delete(entry.key)
  for (const subId of entry.subs.keys()) entryOfSub.delete(subId)
  entry.subs.clear()
  entry.stopExtra()
  entry.informer.stop().catch(() => {})
}

function send(entry: Entry, type: WatchEventType, obj: KubernetesObject): void {
  const item = entry.map(obj)
  for (const [subId, wc] of [...entry.subs]) {
    if (wc.isDestroyed()) {
      stopWatch(subId)
      continue
    }
    const message: WatchEventMessage = { subId, type, item }
    wc.send(WATCH_EVENT_CHANNEL, message)
  }
}

/** A watch that dies after it was established tells its subscribers so they can
 *  drop back to polling, then goes away — nothing re-establishes it until a
 *  view resubscribes. */
function closeEntry(entry: Entry, err: unknown): void {
  if (entry.disposed) return
  const error = describeError(err)
  console.error(`[watch] ${entry.key} closed:`, error)
  for (const [subId, wc] of [...entry.subs]) {
    if (wc.isDestroyed()) continue
    const message: WatchClosedMessage = { subId, error }
    wc.send(WATCH_CLOSED_CHANNEL, message)
  }
  disposeEntry(entry)
}

async function createEntry(
  deps: InformerDeps,
  args: WatchStartArgs,
  key: string,
): Promise<Entry> {
  const kc = deps.getKubeConfig(args.contextName)
  const clients = deps.getContextClients(args.contextName)
  const ns = args.namespace
  // Passed to `makeInformer` as well as to the list call: the first filters the
  // watch request, the second the initial list the cache is built from.
  const labelSelector = args.labelSelector

  let informer: AnyInformer
  let map: (obj: KubernetesObject) => unknown
  let stopExtra: () => void = () => {}

  if (args.resource === "pods") {
    informer = makeInformer<V1Pod>(
      kc,
      ns ? `/api/v1/namespaces/${ns}/pods` : "/api/v1/pods",
      () =>
        ns
          ? clients.coreV1.listNamespacedPod({ namespace: ns, labelSelector })
          : clients.coreV1.listPodForAllNamespaces({ labelSelector }),
      labelSelector,
    ) as AnyInformer
    const owners = await startReplicaSetOwners(deps, args)
    stopExtra = owners.stop
    map = (obj) => mapPodSummary(obj as V1Pod, owners.get())
  } else {
    const source = SOURCES[args.resource]
    informer = makeInformer<KubernetesObject>(
      kc,
      source.path(ns),
      () => source.list(clients, ns, labelSelector),
      labelSelector,
    )
    map = source.map
  }

  const entry: Entry = {
    key,
    informer,
    map,
    stopExtra,
    subs: new Map(),
    disposed: false,
  }

  // `start()` resolves whether or not the initial list worked — the informer
  // reports both list and watch failures through its error callback — so a
  // failure before it returns is what distinguishes "never started" from
  // "died later".
  let startError: unknown = null
  let started = false
  informer.on(ERROR, (err) => {
    if (!started) {
      startError = err ?? new Error("watch failed")
      return
    }
    closeEntry(entry, err)
  })

  await informer.start()
  if (startError !== null) {
    stopExtra()
    await informer.stop().catch(() => {})
    throw new Error(describeError(startError))
  }
  started = true

  // Registered only now: the initial list fires ADD for every object it synced,
  // which would duplicate the snapshot the subscriber already has.
  informer.on(ADD, (obj) => send(entry, "add", obj))
  informer.on(UPDATE, (obj) => send(entry, "update", obj))
  informer.on(DELETE, (obj) => send(entry, "delete", obj))

  return entry
}

/**
 * Keeps `mapPodSummary`'s ReplicaSet owner map current off a second watch,
 * rather than re-listing every ReplicaSet the way `listPods` has to. Returns
 * null from `get()` when that watch isn't usable, which drops pod mapping back
 * to the same name-stripping fallback the list path uses.
 */
async function startReplicaSetOwners(
  deps: InformerDeps,
  args: WatchStartArgs,
): Promise<{
  get: () => Map<string, { kind: string; name: string }> | null
  stop: () => void
}> {
  const kc = deps.getKubeConfig(args.contextName)
  const clients = deps.getContextClients(args.contextName)
  const ns = args.namespace
  const owners = new Map<string, { kind: string; name: string }>()
  let startError: unknown = null
  let started = false
  let usable = false

  // Deliberately unfiltered by `args.labelSelector`: that selector is about
  // pods, and a ReplicaSet rarely carries the labels its pods do — filtering
  // here would drop the owners the pods being watched need resolved.
  const informer = makeInformer<V1ReplicaSet>(
    kc,
    ns
      ? `/apis/apps/v1/namespaces/${ns}/replicasets`
      : "/apis/apps/v1/replicasets",
    () =>
      ns
        ? clients.appsV1.listNamespacedReplicaSet({ namespace: ns })
        : clients.appsV1.listReplicaSetForAllNamespaces(),
  )

  const upsert = (rs: V1ReplicaSet): void => {
    const entry = replicaSetOwnerEntry(rs)
    if (!entry) return
    if (entry.owner) owners.set(entry.key, entry.owner)
    else owners.delete(entry.key)
  }

  // Registered before `start()`, unlike the pod informer's: here the ADD burst
  // from the initial list is exactly what fills the map.
  informer.on(ADD, upsert)
  informer.on(UPDATE, upsert)
  informer.on(DELETE, (rs) => {
    const entry = replicaSetOwnerEntry(rs)
    if (entry) owners.delete(entry.key)
  })
  informer.on(ERROR, (err) => {
    if (!started) {
      startError = err ?? new Error("replicaset watch failed")
      return
    }
    // Stale owners are worse than none: a pod whose ReplicaSet was recreated
    // would keep reporting the old workload.
    usable = false
  })

  await informer.start()
  if (startError !== null) {
    await informer.stop().catch(() => {})
    return { get: () => null, stop: () => {} }
  }
  started = true
  usable = true

  return {
    get: () => (usable ? owners : null),
    stop: () => {
      informer.stop().catch(() => {})
    },
  }
}

/** Resources this module can watch, for validating an IPC argument. */
export function isWatchResource(value: unknown): value is WatchResource {
  return (
    typeof value === "string" &&
    (WATCH_RESOURCES as readonly string[]).includes(value)
  )
}
