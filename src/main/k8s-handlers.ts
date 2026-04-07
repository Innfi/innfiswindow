import { KubeConfig, CoreV1Api, AppsV1Api, NetworkingV1Api } from "@kubernetes/client-node"

export async function listServices(api: CoreV1Api) {
  const res = await api.listServiceForAllNamespaces()
  return res.items.map((svc) => {
    const lbIngress = svc.status?.loadBalancer?.ingress ?? []
    const externalIP =
      lbIngress[0]?.ip ??
      lbIngress[0]?.hostname ??
      (svc.spec?.externalIPs ?? [])[0] ??
      ""
    const ports = (svc.spec?.ports ?? []).map((p) => ({
      name: p.name ?? "",
      protocol: p.protocol ?? "TCP",
      port: p.port,
      targetPort: String(p.targetPort ?? ""),
      nodePort: p.nodePort ?? null,
    }))
    return {
      name: svc.metadata?.name ?? "",
      namespace: svc.metadata?.namespace ?? "",
      type: svc.spec?.type ?? "ClusterIP",
      clusterIP: svc.spec?.clusterIP ?? "",
      externalIP,
      ports,
      creationTimestamp: svc.metadata?.creationTimestamp?.toISOString() ?? "",
      selector: svc.spec?.selector ?? {},
      labels: svc.metadata?.labels ?? {},
      annotations: svc.metadata?.annotations ?? {},
    }
  })
}

export async function listIngresses(api: NetworkingV1Api) {
  const res = await api.listIngressForAllNamespaces()
  return res.items.map((ing) => {
    const lbIngress = ing.status?.loadBalancer?.ingress ?? []
    const address = lbIngress[0]?.ip ?? lbIngress[0]?.hostname ?? ""
    const hosts = (ing.spec?.rules ?? [])
      .map((r) => r.host ?? "*")
      .filter((h, i, arr) => arr.indexOf(h) === i)
      .join(", ") || "*"
    const hasTLS = (ing.spec?.tls ?? []).length > 0
    const ports = hasTLS ? "80, 443" : "80"
    const tls = (ing.spec?.tls ?? []).map((t) => ({
      secretName: t.secretName ?? "",
      hosts: t.hosts ?? [],
    }))
    const rules = (ing.spec?.rules ?? []).map((r) => ({
      host: r.host ?? "*",
      paths: (r.http?.paths ?? []).map((p) => ({
        path: p.path ?? "/",
        pathType: p.pathType ?? "",
        serviceName: p.backend?.service?.name ?? "",
        servicePort: p.backend?.service?.port?.number ?? p.backend?.service?.port?.name ?? "",
      })),
    }))
    return {
      name: ing.metadata?.name ?? "",
      namespace: ing.metadata?.namespace ?? "",
      ingressClassName: ing.spec?.ingressClassName ?? "",
      hosts,
      address,
      ports,
      creationTimestamp: ing.metadata?.creationTimestamp?.toISOString() ?? "",
      tls,
      rules,
      labels: ing.metadata?.labels ?? {},
      annotations: ing.metadata?.annotations ?? {},
    }
  })
}

export function listContexts(kc: KubeConfig) {
  return kc
    .getContexts()
    .map((ctx) => ({ name: ctx.name, cluster: ctx.cluster, user: ctx.user }))
}

export function getCurrentContext(kc: KubeConfig) {
  return kc.getCurrentContext()
}

export function getClusterType(kc: KubeConfig) {
  const cluster = kc.getCurrentCluster()
  const user = kc.getCurrentUser()
  const server = cluster?.server ?? ""
  const execCommand = user?.exec?.command ?? ""
  if (server.includes("eks.amazonaws.com") || execCommand === "aws")
    return "EKS"
  if (server.includes("azmk8s.io") || execCommand === "az") return "AKS"
  return "Local"
}

export async function listNamespaces(api: CoreV1Api) {
  const res = await api.listNamespace()
  return res.items.map((ns) => ({
    name: ns.metadata?.name ?? "",
    status: ns.status?.phase ?? "",
    creationTimestamp: ns.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: ns.metadata?.labels ?? {},
    annotations: ns.metadata?.annotations ?? {},
  }))
}

export async function listNodes(api: CoreV1Api) {
  const res = await api.listNode()
  return res.items.map((node) => {
    const labels = node.metadata?.labels ?? {}
    const roles = Object.keys(labels)
      .filter((k) => k.startsWith("node-role.kubernetes.io/"))
      .map((k) => k.replace("node-role.kubernetes.io/", ""))
    const readyCondition = node.status?.conditions?.find(
      (c) => c.type === "Ready",
    )
    const status = readyCondition?.status === "True" ? "Ready" : "NotReady"
    return {
      name: node.metadata?.name ?? "",
      status,
      roles: roles.length > 0 ? roles.join(",") : "<none>",
      creationTimestamp: node.metadata?.creationTimestamp?.toISOString() ?? "",
      version: node.status?.nodeInfo?.kubeletVersion ?? "",
      labels,
      capacity: node.status?.capacity ?? {},
      allocatable: node.status?.allocatable ?? {},
      conditions: (node.status?.conditions ?? []).map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason ?? "",
        message: c.message ?? "",
      })),
    }
  })
}

export async function listDeployments(api: AppsV1Api) {
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

export async function listReplicaSets(api: AppsV1Api) {
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

export async function listStatefulSets(api: AppsV1Api) {
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

export async function listDaemonSets(api: AppsV1Api) {
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

export async function listPods(api: CoreV1Api) {
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

export async function listConfigMaps(api: CoreV1Api) {
  const res = await api.listConfigMapForAllNamespaces()
  return res.items.map((cm) => {
    const dataKeys = Object.keys(cm.data ?? {})
    const binaryDataKeys = Object.keys(cm.binaryData ?? {})
    return {
      name: cm.metadata?.name ?? "",
      namespace: cm.metadata?.namespace ?? "",
      creationTimestamp: cm.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: cm.metadata?.labels ?? {},
      annotations: cm.metadata?.annotations ?? {},
      data: cm.data ?? {},
      binaryData: Object.fromEntries(
        Object.entries(cm.binaryData ?? {}).map(([k, v]) => [
          k,
          v ? v.length : 0,
        ]),
      ),
      keys: [...dataKeys, ...binaryDataKeys],
    }
  })
}

export async function listSecrets(api: CoreV1Api) {
  const res = await api.listSecretForAllNamespaces()
  return res.items.map((secret) => {
    const dataKeys = Object.keys(secret.data ?? {})
    return {
      name: secret.metadata?.name ?? "",
      namespace: secret.metadata?.namespace ?? "",
      type: secret.type ?? "Opaque",
      creationTimestamp:
        secret.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: secret.metadata?.labels ?? {},
      annotations: secret.metadata?.annotations ?? {},
      data: secret.data ?? {},
      keys: dataKeys,
    }
  })
}

export async function createDeployment(
  api: AppsV1Api,
  namespace: string,
  name: string,
  image: string,
  replicas: number,
) {
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
) {
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
) {
  await api.deleteNamespacedDeployment({ name, namespace })
  return { success: true, name, namespace }
}

export async function createStatefulSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
  image: string,
  replicas: number,
  serviceName: string,
) {
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
) {
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
) {
  await api.deleteNamespacedStatefulSet({ name, namespace })
  return { success: true, name, namespace }
}

export async function createDaemonSet(
  api: AppsV1Api,
  namespace: string,
  name: string,
  image: string,
) {
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
) {
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
) {
  await api.deleteNamespacedDaemonSet({ name, namespace })
  return { success: true, name, namespace }
}

export interface ServicePort {
  protocol: string
  port: number
  targetPort: number | string
}

export async function createService(
  api: CoreV1Api,
  namespace: string,
  name: string,
  type: string,
  ports: ServicePort[],
  selector: Record<string, string>,
) {
  const body = {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name, namespace },
    spec: {
      type,
      selector,
      ports: ports.map((p) => ({
        protocol: p.protocol,
        port: p.port,
        targetPort: p.targetPort,
      })),
    },
  }
  const res = await api.createNamespacedService({ namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function updateService(
  api: CoreV1Api,
  namespace: string,
  name: string,
  type: string,
  ports: ServicePort[],
) {
  const body = {
    spec: {
      type,
      ports: ports.map((p) => ({
        protocol: p.protocol,
        port: p.port,
        targetPort: p.targetPort,
      })),
    },
  }
  const res = await api.patchNamespacedService({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function deleteService(
  api: CoreV1Api,
  namespace: string,
  name: string,
) {
  await api.deleteNamespacedService({ name, namespace })
  return { success: true, name, namespace }
}
