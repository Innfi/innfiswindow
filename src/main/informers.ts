import { WebContents } from "electron"
import {
  ADD,
  CoreV1Event,
  DELETE,
  ERROR,
  Informer,
  KubernetesObject,
  makeInformer,
  ObjectCache,
  UPDATE,
  V1Pod,
  V1ReplicaSet,
} from "@kubernetes/client-node"

import {
  WatchClosedMessage,
  WatchEventMessage,
  WatchEventType,
  WatchResource,
  WatchStartArgs,
} from "../shared/watch"
import { mapEvent } from "./handlers/events"
import { mapPodSummary, replicaSetOwnerEntry } from "./handlers/workload"
import { GetContextClients, GetKubeConfig } from "./ipc/context-clients"

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

/** One informer per context + resource + namespace, shared by every subscriber
 *  that asked for the same thing. */
const entries = new Map<string, Entry>()
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
  const key = `${args.contextName ?? ""}|${args.resource}|${args.namespace ?? ""}`
  let entry = entries.get(key)
  if (!entry) {
    entry = await createEntry(deps, args, key)
    entries.set(key, entry)
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
  entries.delete(entry.key)
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

  let informer: AnyInformer
  let map: (obj: KubernetesObject) => unknown
  let stopExtra: () => void = () => {}

  if (args.resource === "pods") {
    informer = makeInformer<V1Pod>(
      kc,
      ns ? `/api/v1/namespaces/${ns}/pods` : "/api/v1/pods",
      () =>
        ns
          ? clients.coreV1.listNamespacedPod({ namespace: ns })
          : clients.coreV1.listPodForAllNamespaces(),
    ) as AnyInformer
    const owners = await startReplicaSetOwners(deps, args)
    stopExtra = owners.stop
    map = (obj) => mapPodSummary(obj as V1Pod, owners.get())
  } else {
    informer = makeInformer<CoreV1Event>(
      kc,
      ns ? `/api/v1/namespaces/${ns}/events` : "/api/v1/events",
      () =>
        ns
          ? clients.coreV1.listNamespacedEvent({ namespace: ns })
          : clients.coreV1.listEventForAllNamespaces(),
    ) as AnyInformer
    map = (obj) => mapEvent(obj as CoreV1Event)
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
  return value === "pods" || value === "events"
}
