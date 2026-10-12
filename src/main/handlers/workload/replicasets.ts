import { AppsV1Api, V1ReplicaSet } from "@kubernetes/client-node"

import { toIso } from "../time"
import { MutationResult, ReplicaSetInfo, ReplicaSetSummary } from "../types"
import {
  formatVolume,
  mapDetailedContainer,
  MERGE_PATCH,
  scaleBody,
} from "./shared"

/** Shared by `listReplicaSets` and the replicasets informer, so a watched
 *  ReplicaSets view renders the same rows a polled one does. */
export function mapReplicaSetSummary(rs: V1ReplicaSet): ReplicaSetSummary {
  return {
    name: rs.metadata?.name ?? "",
    namespace: rs.metadata?.namespace ?? "",
    desiredReplicas: rs.spec?.replicas ?? 0,
    currentReplicas: rs.status?.replicas ?? 0,
    readyReplicas: rs.status?.readyReplicas ?? 0,
    creationTimestamp: toIso(rs.metadata?.creationTimestamp),
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
  labelSelector?: string,
): Promise<ReplicaSetSummary[]> {
  const res = namespace
    ? await api.listNamespacedReplicaSet({ namespace, labelSelector })
    : await api.listReplicaSetForAllNamespaces({ labelSelector })
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

export async function scaleReplicaSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
  replicas: number,
): Promise<MutationResult> {
  await api.patchNamespacedReplicaSetScale(
    { name, namespace, body: scaleBody(replicas) },
    MERGE_PATCH,
  )
  return { success: true, name, namespace }
}
