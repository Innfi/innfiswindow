import { load as yamlLoad } from "js-yaml"
import { AppsV1Api, V1DaemonSet } from "@kubernetes/client-node"

import { toIso } from "../time"
import {
  DaemonSetInfo,
  DaemonSetSummary,
  MutationResult,
  ResourceRef,
} from "../types"
import {
  formatVolume,
  mapDetailedContainer,
  MERGE_PATCH,
  restartPatchBody,
} from "./shared"

/** Shared by `listDaemonSets` and the daemonsets informer. */
export function mapDaemonSetSummary(ds: V1DaemonSet): DaemonSetSummary {
  return {
    name: ds.metadata?.name ?? "",
    namespace: ds.metadata?.namespace ?? "",
    desiredNumberScheduled: ds.status?.desiredNumberScheduled ?? 0,
    currentNumberScheduled: ds.status?.currentNumberScheduled ?? 0,
    numberReady: ds.status?.numberReady ?? 0,
    updatedNumberScheduled: ds.status?.updatedNumberScheduled ?? 0,
    numberAvailable: ds.status?.numberAvailable ?? 0,
    creationTimestamp: toIso(ds.metadata?.creationTimestamp),
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
  labelSelector?: string,
): Promise<DaemonSetSummary[]> {
  const res = namespace
    ? await api.listNamespacedDaemonSet({ namespace, labelSelector })
    : await api.listDaemonSetForAllNamespaces({ labelSelector })
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

export async function restartDaemonSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.patchNamespacedDaemonSet(
    { name, namespace, body: restartPatchBody() },
    MERGE_PATCH,
  )
  return { success: true, name, namespace }
}
