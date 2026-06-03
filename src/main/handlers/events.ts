import { CoreV1Api } from "@kubernetes/client-node"

import { EventInfo } from "./types"

export async function listEvents(api: CoreV1Api): Promise<EventInfo[]> {
  const res = await api.listEventForAllNamespaces()
  return res.items.map((ev) => ({
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
        : "") ??
      "",
    creationTimestamp: ev.metadata?.creationTimestamp?.toISOString() ?? "",
  }))
}
