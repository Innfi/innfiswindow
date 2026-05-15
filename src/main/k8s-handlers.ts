import { load as yamlLoad } from "js-yaml"
import {
  AppsV1Api,
  AutoscalingV2Api,
  BatchV1Api,
  CoreV1Api,
  CustomObjectsApi,
  KubeConfig,
  KubernetesObjectApi,
  NetworkingV1Api,
  PatchStrategy,
  RbacAuthorizationV1Api,
} from "@kubernetes/client-node"

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
    const hosts =
      (ing.spec?.rules ?? [])
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
        servicePort:
          p.backend?.service?.port?.number ??
          p.backend?.service?.port?.name ??
          "",
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

export async function listEvents(api: CoreV1Api) {
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

export function listContexts(kc: KubeConfig) {
  const clusters = kc.getClusters()
  const users = kc.getUsers()
  return kc.getContexts().map((ctx) => {
    const cluster = clusters.find((c) => c.name === ctx.cluster)
    const user = users.find((u) => u.name === ctx.user)
    const server = cluster?.server ?? ""
    const execCommand = user?.exec?.command ?? ""
    let clusterType: "EKS" | "AKS" | "Local" = "Local"
    if (server.includes("eks.amazonaws.com") || execCommand === "aws")
      clusterType = "EKS"
    else if (server.includes("azmk8s.io") || execCommand === "az")
      clusterType = "AKS"
    return { name: ctx.name, cluster: ctx.cluster, user: ctx.user, clusterType }
  })
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

export async function listServiceAccounts(api: CoreV1Api) {
  const res = await api.listServiceAccountForAllNamespaces()
  return res.items.map((sa) => ({
    name: sa.metadata?.name ?? "",
    namespace: sa.metadata?.namespace ?? "",
    creationTimestamp: sa.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: sa.metadata?.labels ?? {},
    annotations: sa.metadata?.annotations ?? {},
    secrets: (sa.secrets ?? []).map((s) => s.name ?? ""),
    imagePullSecrets: (sa.imagePullSecrets ?? []).map((s) => s.name ?? ""),
  }))
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

export interface IngressRuleEntry {
  host: string
  path: string
  pathType: string
  serviceName: string
  servicePort: number | string
}

export interface IngressTLSEntry {
  hosts: string[]
  secretName: string
}

function buildIngressSpec(
  ingressClassName: string,
  rules: IngressRuleEntry[],
  tls: IngressTLSEntry[],
) {
  // Group rules by host
  const hostMap = new Map<string, IngressRuleEntry[]>()
  for (const r of rules) {
    const host = r.host || "*"
    if (!hostMap.has(host)) hostMap.set(host, [])
    hostMap.get(host)!.push(r)
  }
  const k8sRules = Array.from(hostMap.entries()).map(([host, paths]) => ({
    host: host === "*" ? undefined : host,
    http: {
      paths: paths.map((p) => ({
        path: p.path || "/",
        pathType: p.pathType || "Prefix",
        backend: {
          service: {
            name: p.serviceName,
            port: {
              number:
                typeof p.servicePort === "number"
                  ? p.servicePort
                  : parseInt(String(p.servicePort), 10) || 80,
            },
          },
        },
      })),
    },
  }))
  return {
    ...(ingressClassName ? { ingressClassName } : {}),
    rules: k8sRules,
    ...(tls.length > 0
      ? {
          tls: tls.map((t) => ({
            hosts: t.hosts,
            secretName: t.secretName,
          })),
        }
      : {}),
  }
}

export async function createIngress(
  api: NetworkingV1Api,
  namespace: string,
  name: string,
  ingressClassName: string,
  rules: IngressRuleEntry[],
  tls: IngressTLSEntry[],
) {
  const body = {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: { name, namespace },
    spec: buildIngressSpec(ingressClassName, rules, tls),
  }
  const res = await api.createNamespacedIngress({ namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function updateIngress(
  api: NetworkingV1Api,
  namespace: string,
  name: string,
  ingressClassName: string,
  rules: IngressRuleEntry[],
  tls: IngressTLSEntry[],
) {
  const body = {
    spec: buildIngressSpec(ingressClassName, rules, tls),
  }
  const res = await api.patchNamespacedIngress({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function deleteIngress(
  api: NetworkingV1Api,
  namespace: string,
  name: string,
) {
  await api.deleteNamespacedIngress({ name, namespace })
  return { success: true, name, namespace }
}

export async function replaceDeploymentFromYaml(
  api: AppsV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
) {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedDeployment({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function replaceServiceFromYaml(
  api: CoreV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
) {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedService({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function replaceIngressFromYaml(
  api: NetworkingV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
) {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedIngress({ name, namespace, body })
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
) {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedDaemonSet({ name, namespace, body })
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
) {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedStatefulSet({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function replaceConfigMapFromYaml(
  api: CoreV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
) {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedConfigMap({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function deleteConfigMap(
  api: CoreV1Api,
  namespace: string,
  name: string,
) {
  await api.deleteNamespacedConfigMap({ name, namespace })
  return { success: true, name, namespace }
}

export async function replaceSecretFromYaml(
  api: CoreV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
) {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedSecret({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function deleteSecret(
  api: CoreV1Api,
  namespace: string,
  name: string,
) {
  await api.deleteNamespacedSecret({ name, namespace })
  return { success: true, name, namespace }
}

export async function deletePod(
  api: CoreV1Api,
  namespace: string,
  name: string,
) {
  await api.deleteNamespacedPod({ name, namespace })
  return { success: true, name, namespace }
}

export async function deleteRole(
  api: RbacAuthorizationV1Api,
  namespace: string,
  name: string,
) {
  await api.deleteNamespacedRole({ name, namespace })
  return { success: true, name, namespace }
}

export async function deleteClusterRole(
  api: RbacAuthorizationV1Api,
  name: string,
) {
  await api.deleteClusterRole({ name })
  return { success: true, name }
}

export async function deleteRoleBinding(
  api: RbacAuthorizationV1Api,
  namespace: string,
  name: string,
) {
  await api.deleteNamespacedRoleBinding({ name, namespace })
  return { success: true, name, namespace }
}

export async function deleteClusterRoleBinding(
  api: RbacAuthorizationV1Api,
  name: string,
) {
  await api.deleteClusterRoleBinding({ name })
  return { success: true, name }
}

export async function deleteServiceAccount(
  api: CoreV1Api,
  namespace: string,
  name: string,
) {
  await api.deleteNamespacedServiceAccount({ name, namespace })
  return { success: true, name, namespace }
}

export async function listResourceQuotas(api: CoreV1Api) {
  const res = await api.listResourceQuotaForAllNamespaces()
  return res.items.map((rq) => ({
    name: rq.metadata?.name ?? "",
    namespace: rq.metadata?.namespace ?? "",
    hard: Object.fromEntries(
      Object.entries(rq.spec?.hard ?? {}).map(([k, v]) => [k, String(v)]),
    ) as Record<string, string>,
    used: Object.fromEntries(
      Object.entries(rq.status?.used ?? {}).map(([k, v]) => [k, String(v)]),
    ) as Record<string, string>,
    creationTimestamp: rq.metadata?.creationTimestamp?.toISOString() ?? "",
  }))
}

export async function listLimitRanges(api: CoreV1Api) {
  const res = await api.listLimitRangeForAllNamespaces()
  return res.items.map((lr) => ({
    name: lr.metadata?.name ?? "",
    namespace: lr.metadata?.namespace ?? "",
    limits: (lr.spec?.limits ?? []).map((l) => ({
      type: l.type ?? "",
      max: Object.fromEntries(
        Object.entries(l.max ?? {}).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
      min: Object.fromEntries(
        Object.entries(l.min ?? {}).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
      default: Object.fromEntries(
        Object.entries(l.default ?? {}).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
      defaultRequest: Object.fromEntries(
        Object.entries(l.defaultRequest ?? {}).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
    })),
    creationTimestamp: lr.metadata?.creationTimestamp?.toISOString() ?? "",
  }))
}

export async function listRoles(
  api: RbacAuthorizationV1Api,
  namespace?: string,
) {
  const res = namespace
    ? await api.listNamespacedRole({ namespace })
    : await api.listRoleForAllNamespaces()
  return res.items.map((r) => ({
    name: r.metadata?.name ?? "",
    namespace: r.metadata?.namespace ?? "",
    rulesCount: (r.rules ?? []).length,
    creationTimestamp: r.metadata?.creationTimestamp?.toISOString() ?? "",
    rules: (r.rules ?? []).map((rule) => ({
      apiGroups: rule.apiGroups ?? [],
      resources: rule.resources ?? [],
      verbs: rule.verbs ?? [],
    })),
  }))
}

export async function listClusterRoles(api: RbacAuthorizationV1Api) {
  const res = await api.listClusterRole()
  return res.items.map((r) => ({
    name: r.metadata?.name ?? "",
    rulesCount: (r.rules ?? []).length,
    creationTimestamp: r.metadata?.creationTimestamp?.toISOString() ?? "",
    rules: (r.rules ?? []).map((rule) => ({
      apiGroups: rule.apiGroups ?? [],
      resources: rule.resources ?? [],
      verbs: rule.verbs ?? [],
    })),
  }))
}

export async function listRoleBindings(
  api: RbacAuthorizationV1Api,
  namespace?: string,
) {
  const res = namespace
    ? await api.listNamespacedRoleBinding({ namespace })
    : await api.listRoleBindingForAllNamespaces()
  return res.items.map((rb) => ({
    name: rb.metadata?.name ?? "",
    namespace: rb.metadata?.namespace ?? "",
    roleRef: {
      kind: rb.roleRef?.kind ?? "",
      name: rb.roleRef?.name ?? "",
    },
    subjects: (rb.subjects ?? []).map((s) => ({
      kind: s.kind ?? "",
      name: s.name ?? "",
      namespace: s.namespace ?? "",
    })),
    subjectsCount: (rb.subjects ?? []).length,
    creationTimestamp: rb.metadata?.creationTimestamp?.toISOString() ?? "",
  }))
}

export async function listClusterRoleBindings(api: RbacAuthorizationV1Api) {
  const res = await api.listClusterRoleBinding()
  return res.items.map((crb) => ({
    name: crb.metadata?.name ?? "",
    roleRef: {
      kind: crb.roleRef?.kind ?? "",
      name: crb.roleRef?.name ?? "",
    },
    subjects: (crb.subjects ?? []).map((s) => ({
      kind: s.kind ?? "",
      name: s.name ?? "",
      namespace: s.namespace ?? "",
    })),
    subjectsCount: (crb.subjects ?? []).length,
    creationTimestamp: crb.metadata?.creationTimestamp?.toISOString() ?? "",
  }))
}

export async function updateRole(
  api: RbacAuthorizationV1Api,
  namespace: string,
  name: string,
  rules: Array<{ apiGroups: string[]; resources: string[]; verbs: string[] }>,
) {
  const body = { rules }
  const res = await api.patchNamespacedRole({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
    rules: (res.rules ?? []).map((rule) => ({
      apiGroups: rule.apiGroups ?? [],
      resources: rule.resources ?? [],
      verbs: rule.verbs ?? [],
    })),
  }
}

export async function updateClusterRole(
  api: RbacAuthorizationV1Api,
  name: string,
  rules: Array<{ apiGroups: string[]; resources: string[]; verbs: string[] }>,
) {
  const body = { rules }
  const res = await api.patchClusterRole({ name, body })
  return {
    name: res.metadata?.name ?? "",
    rules: (res.rules ?? []).map((rule) => ({
      apiGroups: rule.apiGroups ?? [],
      resources: rule.resources ?? [],
      verbs: rule.verbs ?? [],
    })),
  }
}

export async function updateRoleBinding(
  api: RbacAuthorizationV1Api,
  namespace: string,
  name: string,
  subjects: Array<{ kind: string; name: string; namespace?: string }>,
) {
  const body = { subjects }
  const res = await api.patchNamespacedRoleBinding({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
    subjects: (res.subjects ?? []).map((s) => ({
      kind: s.kind ?? "",
      name: s.name ?? "",
      namespace: s.namespace ?? "",
    })),
  }
}

export async function updateClusterRoleBinding(
  api: RbacAuthorizationV1Api,
  name: string,
  subjects: Array<{ kind: string; name: string; namespace?: string }>,
) {
  const body = { subjects }
  const res = await api.patchClusterRoleBinding({ name, body })
  return {
    name: res.metadata?.name ?? "",
    subjects: (res.subjects ?? []).map((s) => ({
      kind: s.kind ?? "",
      name: s.name ?? "",
      namespace: s.namespace ?? "",
    })),
  }
}

export async function updateServiceAccount(
  api: CoreV1Api,
  namespace: string,
  name: string,
  metadata: {
    labels?: Record<string, string>
    annotations?: Record<string, string>
  },
) {
  const body = { metadata }
  const res = await api.patchNamespacedServiceAccount({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
    labels: res.metadata?.labels ?? {},
    annotations: res.metadata?.annotations ?? {},
  }
}

export async function applyResource(kc: KubeConfig, yamlString: string) {
  const obj = yamlLoad(yamlString) as Record<string, unknown>
  if (!obj || typeof obj !== "object") {
    throw new Error("Invalid YAML: must be a Kubernetes object")
  }
  const meta = (obj.metadata ?? {}) as Record<string, unknown>
  const name = (meta.name as string) ?? ""
  const namespace = (meta.namespace as string) ?? ""
  if (!obj.apiVersion || !obj.kind || !name) {
    throw new Error("YAML must include apiVersion, kind, and metadata.name")
  }
  const client = KubernetesObjectApi.makeApiClient(kc)
  try {
    const res = await client.create(obj as never)
    const body =
      (res as unknown as { body: Record<string, unknown> }).body ?? res
    const bodyMeta = (body as Record<string, unknown>).metadata as
      | Record<string, unknown>
      | undefined
    return {
      name: (bodyMeta?.name as string) ?? name,
      namespace: (bodyMeta?.namespace as string) ?? namespace,
    }
  } catch (err: unknown) {
    const statusCode =
      (err as Record<string, unknown>).statusCode ??
      (err as Record<string, unknown>).code
    if (statusCode === 409) {
      const res = await client.patch(
        obj as never,
        undefined,
        undefined,
        undefined,
        undefined,
        PatchStrategy.StrategicMergePatch,
      )
      const body =
        (res as unknown as { body: Record<string, unknown> }).body ?? res
      const bodyMeta = (body as Record<string, unknown>).metadata as
        | Record<string, unknown>
        | undefined
      return {
        name: (bodyMeta?.name as string) ?? name,
        namespace: (bodyMeta?.namespace as string) ?? namespace,
      }
    }
    throw err
  }
}

export async function listHPAs(api: AutoscalingV2Api) {
  const res = await api.listHorizontalPodAutoscalerForAllNamespaces()
  return res.items.map((hpa) => {
    const specMetrics = hpa.spec?.metrics ?? []
    const currentMetrics = hpa.status?.currentMetrics ?? []
    const metrics = specMetrics.map((m) => {
      let targetStr = ""
      let currentStr = ""
      const type = m.type
      if (type === "Resource" && m.resource) {
        const tgt = m.resource.target
        if (tgt.averageUtilization != null) {
          targetStr = `${m.resource.name} utilization ${tgt.averageUtilization}%`
        } else if (tgt.averageValue != null) {
          targetStr = `${m.resource.name} avgValue ${String(tgt.averageValue)}`
        } else if (tgt.value != null) {
          targetStr = `${m.resource.name} value ${String(tgt.value)}`
        }
        const cur = currentMetrics.find(
          (c) => c.type === "Resource" && c.resource?.name === m.resource?.name,
        )
        if (cur?.resource) {
          if (cur.resource.current?.averageUtilization != null) {
            currentStr = `${cur.resource.current.averageUtilization}%`
          } else if (cur.resource.current?.averageValue != null) {
            currentStr = String(cur.resource.current.averageValue)
          }
        }
      } else if (type === "Pods" && m.pods) {
        const tgt = m.pods.metric.name
        targetStr = `${tgt} avgValue ${String(m.pods.target.averageValue ?? "")}`
        const cur = currentMetrics.find(
          (c) =>
            c.type === "Pods" && c.pods?.metric?.name === m.pods?.metric?.name,
        )
        if (cur?.pods?.current?.averageValue != null) {
          currentStr = String(cur.pods.current.averageValue)
        }
      } else if (type === "Object" && m.object) {
        const tgt = m.object.metric.name
        targetStr = `${tgt} value ${String(m.object.target.value ?? m.object.target.averageValue ?? "")}`
        const cur = currentMetrics.find(
          (c) =>
            c.type === "Object" &&
            c.object?.metric?.name === m.object?.metric?.name,
        )
        if (cur?.object?.current) {
          currentStr = String(
            cur.object.current.value ?? cur.object.current.averageValue ?? "",
          )
        }
      } else if (type === "External" && m.external) {
        const tgt = m.external.metric.name
        targetStr = `${tgt} value ${String(m.external.target.value ?? m.external.target.averageValue ?? "")}`
        const cur = currentMetrics.find(
          (c) =>
            c.type === "External" &&
            c.external?.metric?.name === m.external?.metric?.name,
        )
        if (cur?.external?.current) {
          currentStr = String(
            cur.external.current.value ??
              cur.external.current.averageValue ??
              "",
          )
        }
      } else if (type === "ContainerResource" && m.containerResource) {
        const tgt = m.containerResource.target
        targetStr = `${m.containerResource.name}/${m.containerResource.container}`
        if (tgt.averageUtilization != null)
          targetStr += ` util ${tgt.averageUtilization}%`
        else if (tgt.averageValue != null)
          targetStr += ` avgValue ${String(tgt.averageValue)}`
      }
      return { type, target: targetStr, current: currentStr }
    })
    return {
      name: hpa.metadata?.name ?? "",
      namespace: hpa.metadata?.namespace ?? "",
      targetRef: {
        kind: hpa.spec?.scaleTargetRef?.kind ?? "",
        name: hpa.spec?.scaleTargetRef?.name ?? "",
      },
      minReplicas: hpa.spec?.minReplicas ?? 1,
      maxReplicas: hpa.spec?.maxReplicas ?? 0,
      currentReplicas: hpa.status?.currentReplicas ?? 0,
      desiredReplicas: hpa.status?.desiredReplicas ?? 0,
      conditions: (hpa.status?.conditions ?? []).map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason ?? "",
        message: c.message ?? "",
      })),
      metrics,
      creationTimestamp: hpa.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: hpa.metadata?.labels ?? {},
      annotations: hpa.metadata?.annotations ?? {},
    }
  })
}

export async function listPVs(api: CoreV1Api) {
  const res = await api.listPersistentVolume()
  return res.items.map((pv) => {
    const claimRef = pv.spec?.claimRef
      ? {
          namespace: pv.spec.claimRef.namespace ?? "",
          name: pv.spec.claimRef.name ?? "",
        }
      : null
    return {
      name: pv.metadata?.name ?? "",
      capacity: pv.spec?.capacity?.["storage"] ?? "",
      accessModes: pv.spec?.accessModes ?? [],
      reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy ?? "",
      status: pv.status?.phase ?? "",
      claimRef,
      storageClass: pv.spec?.storageClassName ?? "",
      volumeMode: pv.spec?.volumeMode ?? "",
      creationTimestamp: pv.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: pv.metadata?.labels ?? {},
      annotations: pv.metadata?.annotations ?? {},
    }
  })
}

export async function listPVCs(api: CoreV1Api) {
  const res = await api.listPersistentVolumeClaimForAllNamespaces()
  return res.items.map((pvc) => ({
    name: pvc.metadata?.name ?? "",
    namespace: pvc.metadata?.namespace ?? "",
    status: pvc.status?.phase ?? "",
    volumeName: pvc.spec?.volumeName ?? "",
    capacity: pvc.status?.capacity?.["storage"] ?? "",
    accessModes: pvc.spec?.accessModes ?? [],
    storageClass: pvc.spec?.storageClassName ?? "",
    creationTimestamp: pvc.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: pvc.metadata?.labels ?? {},
    annotations: pvc.metadata?.annotations ?? {},
  }))
}

export async function listJobs(api: BatchV1Api) {
  const res = await api.listJobForAllNamespaces()
  return res.items.map((job) => {
    const startTime = job.status?.startTime?.toISOString() ?? ""
    const completionTime = job.status?.completionTime?.toISOString() ?? ""
    let duration = ""
    if (startTime && completionTime) {
      const ms =
        new Date(completionTime).getTime() - new Date(startTime).getTime()
      const totalSecs = Math.floor(ms / 1000)
      const mins = Math.floor(totalSecs / 60)
      const secs = totalSecs % 60
      duration = mins > 0 ? `${mins}m${secs}s` : `${secs}s`
    }
    return {
      name: job.metadata?.name ?? "",
      namespace: job.metadata?.namespace ?? "",
      completions: job.spec?.completions ?? null,
      succeeded: job.status?.succeeded ?? 0,
      failed: job.status?.failed ?? 0,
      active: job.status?.active ?? 0,
      startTime,
      completionTime,
      duration,
      conditions: (job.status?.conditions ?? []).map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason ?? "",
        message: c.message ?? "",
      })),
      creationTimestamp: job.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: job.metadata?.labels ?? {},
      annotations: job.metadata?.annotations ?? {},
    }
  })
}

export async function listCronJobs(api: BatchV1Api) {
  const res = await api.listCronJobForAllNamespaces()
  return res.items.map((cj) => {
    const activeJobs = cj.status?.active ?? []
    return {
      name: cj.metadata?.name ?? "",
      namespace: cj.metadata?.namespace ?? "",
      schedule: cj.spec?.schedule ?? "",
      concurrencyPolicy: cj.spec?.concurrencyPolicy ?? "",
      suspend: cj.spec?.suspend ?? false,
      lastScheduleTime: cj.status?.lastScheduleTime?.toISOString() ?? "",
      activeCount: activeJobs.length,
      activeJobNames: activeJobs.map((r) => r.name ?? ""),
      creationTimestamp: cj.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: cj.metadata?.labels ?? {},
      annotations: cj.metadata?.annotations ?? {},
    }
  })
}

// TODO: refactor handler by resource category

export async function getNodeMetrics(
  api: CustomObjectsApi,
): Promise<
  | { nodeName: string; cpuUsage: string; memoryUsage: string }[]
  | { unavailable: true }
> {
  try {
    const res = (await api.listClusterCustomObject({
      group: "metrics.k8s.io",
      version: "v1beta1",
      plural: "nodes",
    })) as {
      items: Array<{
        metadata: { name: string }
        usage: { cpu: string; memory: string }
      }>
    }
    return res.items.map((item) => ({
      nodeName: item.metadata.name,
      cpuUsage: item.usage.cpu,
      memoryUsage: item.usage.memory,
    }))
  } catch (e: unknown) {
    const httpErr = e as {
      response?: { statusCode?: number }
      statusCode?: number
    }
    const code = httpErr.response?.statusCode ?? httpErr.statusCode
    if (code === 404 || code === 403) {
      return { unavailable: true }
    }
    throw e
  }
}
