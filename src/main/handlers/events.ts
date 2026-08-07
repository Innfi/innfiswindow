import { CoreV1Api, CoreV1Event } from "@kubernetes/client-node"

import { EventInfo } from "./types"

// `eventTime` is typed V1MicroTime (extends Date) but the client's
// ObjectSerializer has no typeMap entry for it, so it arrives as a raw string.
function mapEvent(ev: CoreV1Event): EventInfo {
  return {
    name: ev.metadata?.name ?? "",
    namespace: ev.metadata?.namespace ?? "",
    type: ev.type ?? "Normal",
    reason: ev.reason ?? "",
    involvedObjectKind: ev.involvedObject?.kind ?? "",
    involvedObjectName: ev.involvedObject?.name ?? "",
    message: ev.message ?? "",
    count: ev.count ?? 1,
    firstTimestamp: ev.firstTimestamp?.toISOString() ?? "",
    lastTimestamp:
      ev.lastTimestamp?.toISOString() ??
      (ev.eventTime
        ? new Date(ev.eventTime as unknown as string).toISOString()
        : ""),
    creationTimestamp: ev.metadata?.creationTimestamp?.toISOString() ?? "",
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

export async function listEvents(api: CoreV1Api): Promise<EventInfo[]> {
  const res = await api.listEventForAllNamespaces()
  return res.items.map(mapEvent)
}
