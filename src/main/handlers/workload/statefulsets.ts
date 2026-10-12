import { load as yamlLoad } from "js-yaml"
import { AppsV1Api, V1StatefulSet } from "@kubernetes/client-node"

import { toIso } from "../time"
import {
  MutationResult,
  ResourceRef,
  StatefulSetInfo,
  StatefulSetSummary,
} from "../types"
import {
  formatVolume,
  mapDetailedContainer,
  MERGE_PATCH,
  restartPatchBody,
  scaleBody,
} from "./shared"

/** Shared by `listStatefulSets` and the statefulsets informer. */
export function mapStatefulSetSummary(ss: V1StatefulSet): StatefulSetSummary {
  return {
    name: ss.metadata?.name ?? "",
    namespace: ss.metadata?.namespace ?? "",
    replicas: ss.spec?.replicas ?? 0,
    readyReplicas: ss.status?.readyReplicas ?? 0,
    creationTimestamp: toIso(ss.metadata?.creationTimestamp),
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
  labelSelector?: string,
): Promise<StatefulSetSummary[]> {
  const res = namespace
    ? await api.listNamespacedStatefulSet({ namespace, labelSelector })
    : await api.listStatefulSetForAllNamespaces({ labelSelector })
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

export async function restartStatefulSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.patchNamespacedStatefulSet(
    { name, namespace, body: restartPatchBody() },
    MERGE_PATCH,
  )
  return { success: true, name, namespace }
}

export async function scaleStatefulSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
  replicas: number,
): Promise<MutationResult> {
  await api.patchNamespacedStatefulSetScale(
    { name, namespace, body: scaleBody(replicas) },
    MERGE_PATCH,
  )
  return { success: true, name, namespace }
}
