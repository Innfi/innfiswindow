import { load as yamlLoad } from "js-yaml"
import { AppsV1Api, CoreV1Api } from "@kubernetes/client-node"

import {
  DaemonSetInfo,
  DeploymentInfo,
  DeploymentRevision,
  MutationResult,
  PodInfo,
  ReplicaSetInfo,
  ResourceRef,
  StatefulSetInfo,
} from "./types"

export async function listDeployments(
  api: AppsV1Api,
): Promise<DeploymentInfo[]> {
  const res = await api.listDeploymentForAllNamespaces()
  return res.items.map((d) => ({
    name: d.metadata?.name ?? "",
    namespace: d.metadata?.namespace ?? "",
    replicas: d.spec?.replicas ?? 0,
    readyReplicas: d.status?.readyReplicas ?? 0,
    updatedReplicas: d.status?.updatedReplicas ?? 0,
    availableReplicas: d.status?.availableReplicas ?? 0,
    strategy: d.spec?.strategy?.type ?? "",
    creationTimestamp: d.metadata?.creationTimestamp?.toISOString() ?? "",
    selector: d.spec?.selector?.matchLabels ?? {},
    containers: (d.spec?.template?.spec?.containers ?? []).map((c) => ({
      name: c.name,
      image: c.image ?? "",
    })),
    conditions: (d.status?.conditions ?? []).map((c) => ({
      type: c.type,
      status: c.status,
      reason: c.reason ?? "",
      message: c.message ?? "",
    })),
  }))
}

export async function listReplicaSets(
  api: AppsV1Api,
): Promise<ReplicaSetInfo[]> {
  const res = await api.listReplicaSetForAllNamespaces()
  return res.items.map((rs) => ({
    name: rs.metadata?.name ?? "",
    namespace: rs.metadata?.namespace ?? "",
    desiredReplicas: rs.spec?.replicas ?? 0,
    currentReplicas: rs.status?.replicas ?? 0,
    readyReplicas: rs.status?.readyReplicas ?? 0,
    creationTimestamp: rs.metadata?.creationTimestamp?.toISOString() ?? "",
    selector: rs.spec?.selector?.matchLabels ?? {},
    containers: (rs.spec?.template?.spec?.containers ?? []).map((c) => ({
      name: c.name,
      image: c.image ?? "",
    })),
    ownerReferences: (rs.metadata?.ownerReferences ?? []).map((o) => ({
      kind: o.kind,
      name: o.name,
    })),
    podTemplateLabels: rs.spec?.template?.metadata?.labels ?? {},
  }))
}

export async function listStatefulSets(
  api: AppsV1Api,
): Promise<StatefulSetInfo[]> {
  const res = await api.listStatefulSetForAllNamespaces()
  return res.items.map((ss) => ({
    name: ss.metadata?.name ?? "",
    namespace: ss.metadata?.namespace ?? "",
    replicas: ss.spec?.replicas ?? 0,
    readyReplicas: ss.status?.readyReplicas ?? 0,
    creationTimestamp: ss.metadata?.creationTimestamp?.toISOString() ?? "",
    serviceName: ss.spec?.serviceName ?? "",
    updateStrategy: ss.spec?.updateStrategy?.type ?? "",
    selector: ss.spec?.selector?.matchLabels ?? {},
    containers: (ss.spec?.template?.spec?.containers ?? []).map((c) => ({
      name: c.name,
      image: c.image ?? "",
    })),
    volumeClaimTemplates: (ss.spec?.volumeClaimTemplates ?? []).map((vct) => ({
      name: vct.metadata?.name ?? "",
      storage: vct.spec?.resources?.requests?.["storage"] ?? "",
    })),
  }))
}

export async function listDaemonSets(api: AppsV1Api): Promise<DaemonSetInfo[]> {
  const res = await api.listDaemonSetForAllNamespaces()
  return res.items.map((ds) => ({
    name: ds.metadata?.name ?? "",
    namespace: ds.metadata?.namespace ?? "",
    desiredNumberScheduled: ds.status?.desiredNumberScheduled ?? 0,
    currentNumberScheduled: ds.status?.currentNumberScheduled ?? 0,
    numberReady: ds.status?.numberReady ?? 0,
    updatedNumberScheduled: ds.status?.updatedNumberScheduled ?? 0,
    numberAvailable: ds.status?.numberAvailable ?? 0,
    creationTimestamp: ds.metadata?.creationTimestamp?.toISOString() ?? "",
    updateStrategy: ds.spec?.updateStrategy?.type ?? "",
    selector: ds.spec?.selector?.matchLabels ?? {},
    nodeSelector: ds.spec?.template?.spec?.nodeSelector ?? {},
    containers: (ds.spec?.template?.spec?.containers ?? []).map((c) => ({
      name: c.name,
      image: c.image ?? "",
    })),
    tolerations: (ds.spec?.template?.spec?.tolerations ?? []).map((t) => ({
      key: t.key ?? "",
      operator: t.operator ?? "",
      value: t.value ?? "",
      effect: t.effect ?? "",
    })),
  }))
}

export async function listPods(api: CoreV1Api): Promise<PodInfo[]> {
  const res = await api.listPodForAllNamespaces()
  return res.items.map((pod) => {
    const ownerRef = (pod.metadata?.ownerReferences ?? []).find(
      (r) => r.kind === "ReplicaSet",
    )
    const deploymentName = ownerRef
      ? ownerRef.name.replace(/-[a-z0-9]+$/, "")
      : ""
    const restarts = (pod.status?.containerStatuses ?? []).reduce(
      (sum, cs) => sum + (cs.restartCount ?? 0),
      0,
    )
    return {
      name: pod.metadata?.name ?? "",
      namespace: pod.metadata?.namespace ?? "",
      deployment: deploymentName,
      app: pod.metadata?.labels?.["app"] ?? "",
      status: pod.status?.phase ?? "",
      restarts,
      creationTimestamp: pod.metadata?.creationTimestamp?.toISOString() ?? "",
      nodeName: pod.spec?.nodeName ?? "",
      containers: (pod.spec?.containers ?? []).map((c) => ({
        name: c.name,
        image: c.image ?? "",
        restartCount:
          (pod.status?.containerStatuses ?? []).find((cs) => cs.name === c.name)
            ?.restartCount ?? 0,
      })),
      conditions: (pod.status?.conditions ?? []).map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason ?? "",
        message: c.message ?? "",
      })),
    }
  })
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

export async function deleteDeployment(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.deleteNamespacedDeployment({ name, namespace })
  return { success: true, name, namespace }
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

export async function deleteStatefulSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.deleteNamespacedStatefulSet({ name, namespace })
  return { success: true, name, namespace }
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

export async function deleteDaemonSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.deleteNamespacedDaemonSet({ name, namespace })
  return { success: true, name, namespace }
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

export async function deletePod(
  api: CoreV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.deleteNamespacedPod({ name, namespace })
  return { success: true, name, namespace }
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
        creationTimestamp: rs.metadata?.creationTimestamp?.toISOString() ?? "",
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
  await api.patchNamespacedDeployment({ name: deploymentName, namespace, body })
  return { success: true }
}
