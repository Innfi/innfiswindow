import { CoreV1Api, CoreV1Event } from "@kubernetes/client-node"

import { toIso } from "./time"
import { EventInfo } from "./types"

/**
 * Exported for the events informer (`src/main/informers.ts`), which maps one
 * object at a time off the watch stream rather than a whole list.
 */
export function mapEvent(ev: CoreV1Event): EventInfo {
  return {
    name: ev.metadata?.name ?? "",
    namespace: ev.metadata?.namespace ?? "",
    type: ev.type ?? "Normal",
    reason: ev.reason ?? "",
    involvedObjectKind: ev.involvedObject?.kind ?? "",
    involvedObjectName: ev.involvedObject?.name ?? "",
    message: ev.message ?? "",
    count: ev.count ?? 1,
    firstTimestamp: toIso(ev.firstTimestamp),
    // Events written through the newer events.k8s.io path carry `eventTime`
    // and leave `lastTimestamp` unset.
    lastTimestamp: toIso(ev.lastTimestamp) || toIso(ev.eventTime),
    creationTimestamp: toIso(ev.metadata?.creationTimestamp),
  }
}

export async function listEventsForResource(
  api: CoreV1Api,
  namespace: string,
  name: string,
  kind: string,
): Promise<EventInfo[]> {
  if (!namespace) {
    const fieldSelector = `involvedObject.name=${name},involvedObject.kind=${kind}`
    const res = await api.listEventForAllNamespaces({ fieldSelector })
    return res.items.map(mapEvent)
  }
  const fieldSelector = `involvedObject.name=${name},involvedObject.namespace=${namespace},involvedObject.kind=${kind}`
  const res = await api.listNamespacedEvent({ namespace, fieldSelector })
  return res.items.map(mapEvent)
}

export async function listEvents(
  api: CoreV1Api,
  namespace?: string,
): Promise<EventInfo[]> {
  const res = namespace
    ? await api.listNamespacedEvent({ namespace })
    : await api.listEventForAllNamespaces()
  return res.items.map(mapEvent)
}
