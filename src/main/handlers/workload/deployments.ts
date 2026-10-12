import { load as yamlLoad } from "js-yaml"
import { AppsV1Api, V1Deployment } from "@kubernetes/client-node"

import { toIso } from "../time"
import {
  DeploymentInfo,
  DeploymentRevision,
  DeploymentSummary,
  MutationResult,
  ResourceRef,
} from "../types"
import {
  formatVolume,
  mapDetailedContainer,
  MERGE_PATCH,
  restartPatchBody,
  scaleBody,
} from "./shared"

export function mapDeploymentSummary(d: V1Deployment): DeploymentSummary {
  return {
    name: d.metadata?.name ?? "",
    namespace: d.metadata?.namespace ?? "",
    replicas: d.spec?.replicas ?? 0,
    readyReplicas: d.status?.readyReplicas ?? 0,
    updatedReplicas: d.status?.updatedReplicas ?? 0,
    availableReplicas: d.status?.availableReplicas ?? 0,
    paused: d.spec?.paused ?? false,
    creationTimestamp: toIso(d.metadata?.creationTimestamp),
  }
}

function mapDeploymentInfo(d: V1Deployment): DeploymentInfo {
  const ru = d.spec?.strategy?.rollingUpdate
  return {
    ...mapDeploymentSummary(d),
    strategy: d.spec?.strategy?.type ?? "",
    rollingUpdate: ru
      ? {
          maxUnavailable: String(ru.maxUnavailable ?? "25%"),
          maxSurge: String(ru.maxSurge ?? "25%"),
        }
      : null,
    minReadySeconds: d.spec?.minReadySeconds ?? 0,
    labels: d.metadata?.labels ?? {},
    annotations: d.metadata?.annotations ?? {},
    selector: d.spec?.selector?.matchLabels ?? {},
    podTemplateLabels: d.spec?.template?.metadata?.labels ?? {},
    podTemplateAnnotations: d.spec?.template?.metadata?.annotations ?? {},
    serviceAccountName: d.spec?.template?.spec?.serviceAccountName ?? "",
    containers: (d.spec?.template?.spec?.containers ?? []).map(
      mapDetailedContainer,
    ),
    initContainers: (d.spec?.template?.spec?.initContainers ?? []).map(
      mapDetailedContainer,
    ),
    volumes: (d.spec?.template?.spec?.volumes ?? []).map(formatVolume),
    conditions: (d.status?.conditions ?? []).map((c) => ({
      type: c.type,
      status: c.status,
      reason: c.reason ?? "",
      message: c.message ?? "",
    })),
  }
}

export async function listDeployments(
  api: AppsV1Api,
  namespace?: string,
  labelSelector?: string,
): Promise<DeploymentSummary[]> {
  const res = namespace
    ? await api.listNamespacedDeployment({ namespace, labelSelector })
    : await api.listDeploymentForAllNamespaces({ labelSelector })
  return res.items.map(mapDeploymentSummary)
}

export async function getDeployment(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<DeploymentInfo> {
  return mapDeploymentInfo(
    await api.readNamespacedDeployment({ name, namespace }),
  )
}

export async function createDeployment(
  api: AppsV1Api,
  namespace: string,
  name: string,
  image: string,
  replicas: number,
): Promise<ResourceRef> {
  const body = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name, namespace },
    spec: {
      replicas,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: { containers: [{ name, image }] },
      },
    },
  }
  const res = await api.createNamespacedDeployment({ namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function updateDeployment(
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
  const res = await api.patchNamespacedDeployment({
    name,
    namespace,
    body,
  })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function replaceDeploymentFromYaml(
  api: AppsV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
): Promise<ResourceRef> {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedDeployment({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function listDeploymentHistory(
  api: AppsV1Api,
  namespace: string,
  deploymentName: string,
  selector: Record<string, string>,
): Promise<DeploymentRevision[]> {
  const labelSelector = Object.entries(selector)
    .map(([k, v]) => `${k}=${v}`)
    .join(",")
  const res = await api.listNamespacedReplicaSet({ namespace, labelSelector })
  const owned = res.items.filter((rs) =>
    (rs.metadata?.ownerReferences ?? []).some(
      (ref) => ref.kind === "Deployment" && ref.name === deploymentName,
    ),
  )
  const revisions = owned
    .map((rs) => {
      const revision = parseInt(
        rs.metadata?.annotations?.["deployment.kubernetes.io/revision"] ?? "0",
        10,
      )
      const changeCause =
        rs.metadata?.annotations?.["kubernetes.io/change-cause"] ?? ""
      const images = (rs.spec?.template?.spec?.containers ?? []).map(
        (c) => c.image ?? "",
      )
      return {
        revision,
        changeCause,
        images,
        creationTimestamp: toIso(rs.metadata?.creationTimestamp),
      }
    })
    .filter((r) => r.revision > 0)
    .sort((a, b) => b.revision - a.revision)
  return revisions
}

export async function rollbackDeployment(
  api: AppsV1Api,
  namespace: string,
  deploymentName: string,
  revision: number,
): Promise<MutationResult> {
  const res = await api.listNamespacedReplicaSet({ namespace })
  const targetRS = res.items.find((rs) => {
    const isOwned = (rs.metadata?.ownerReferences ?? []).some(
      (ref) => ref.kind === "Deployment" && ref.name === deploymentName,
    )
    const rsRevision = parseInt(
      rs.metadata?.annotations?.["deployment.kubernetes.io/revision"] ?? "0",
      10,
    )
    return isOwned && rsRevision === revision
  })
  if (!targetRS) {
    throw new Error(
      `Revision ${revision} not found for deployment ${deploymentName}`,
    )
  }
  const podTemplateSpec = targetRS.spec?.template
  if (!podTemplateSpec) {
    throw new Error(`No pod template found in revision ${revision}`)
  }
  const body = {
    spec: {
      template: podTemplateSpec,
    },
  }
  await api.patchNamespacedDeployment(
    { name: deploymentName, namespace, body },
    MERGE_PATCH,
  )
  return { success: true }
}

export async function restartDeployment(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.patchNamespacedDeployment(
    { name, namespace, body: restartPatchBody() },
    MERGE_PATCH,
  )
  return { success: true, name, namespace }
}

/** Flips `spec.paused`, as `kubectl rollout pause/resume` does. A paused
 *  Deployment keeps its pods but stops reconciling template changes, so edits
 *  pile up until it is resumed and then roll out as one revision. Resuming
 *  writes `false` rather than dropping the field; both read the same to the
 *  controller. */
export async function setDeploymentPaused(
  api: AppsV1Api,
  namespace: string,
  name: string,
  paused: boolean,
): Promise<MutationResult> {
  await api.patchNamespacedDeployment(
    { name, namespace, body: { spec: { paused } } },
    MERGE_PATCH,
  )
  return { success: true, name, namespace }
}

export async function scaleDeployment(
  api: AppsV1Api,
  namespace: string,
  name: string,
  replicas: number,
): Promise<MutationResult> {
  await api.patchNamespacedDeploymentScale(
    { name, namespace, body: scaleBody(replicas) },
    MERGE_PATCH,
  )
  return { success: true, name, namespace }
}
