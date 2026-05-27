import { load as yamlLoad } from "js-yaml"
import { CoreV1Api, NetworkingV1Api } from "@kubernetes/client-node"

export interface ServicePort {
  protocol: string
  port: number
  targetPort: number | string
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

function buildIngressSpec(
  ingressClassName: string,
  rules: IngressRuleEntry[],
  tls: IngressTLSEntry[],
) {
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

export async function listEndpoints(api: CoreV1Api) {
  const res = await api.listEndpointsForAllNamespaces()
  return res.items.map((ep) => {
    const subsets = ep.subsets ?? []
    let readyAddressCount = 0
    let notReadyAddressCount = 0
    const subsetsData = subsets.map((subset) => {
      const ready = (subset.addresses ?? []).map((addr) => ({
        ip: addr.ip,
        targetPodName: addr.targetRef?.name ?? null,
        targetPodNamespace: addr.targetRef?.namespace ?? null,
      }))
      const notReady = (subset.notReadyAddresses ?? []).map((addr) => ({
        ip: addr.ip,
        targetPodName: addr.targetRef?.name ?? null,
        targetPodNamespace: addr.targetRef?.namespace ?? null,
      }))
      readyAddressCount += ready.length
      notReadyAddressCount += notReady.length
      return {
        readyAddresses: ready,
        notReadyAddresses: notReady,
        ports: (subset.ports ?? []).map((p) => ({
          name: p.name ?? "",
          port: p.port,
          protocol: p.protocol ?? "TCP",
        })),
      }
    })
    const allPorts = subsets.flatMap((s) =>
      (s.ports ?? []).map(
        (p) => `${p.name ? p.name + ":" : ""}${p.port}/${p.protocol ?? "TCP"}`,
      ),
    )
    return {
      name: ep.metadata?.name ?? "",
      namespace: ep.metadata?.namespace ?? "",
      readyAddressCount,
      notReadyAddressCount,
      ports: [...new Set(allPorts)].join(", "),
      creationTimestamp: ep.metadata?.creationTimestamp?.toISOString() ?? "",
      subsets: subsetsData,
    }
  })
}

function labelsToString(labels: Record<string, string> | undefined): string {
  if (!labels || Object.keys(labels).length === 0) return "All pods"
  return Object.entries(labels)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")
}

export async function listNetworkPolicies(api: NetworkingV1Api) {
  const res = await api.listNetworkPolicyForAllNamespaces()
  return res.items.map((np) => {
    const ingress = np.spec?.ingress ?? []
    const egress = np.spec?.egress ?? []
    const ingressRules = ingress.map((rule) => ({
      peers: (rule.from ?? []).map((peer) => ({
        ipBlock: peer.ipBlock
          ? { cidr: peer.ipBlock.cidr, except: peer.ipBlock.except ?? [] }
          : undefined,
        namespaceSelector: peer.namespaceSelector?.matchLabels ?? undefined,
        podSelector: peer.podSelector?.matchLabels ?? undefined,
      })),
      ports: (rule.ports ?? []).map((p) => ({
        protocol: p.protocol ?? "TCP",
        port: p.port !== undefined ? String(p.port) : undefined,
      })),
    }))
    const egressRules = egress.map((rule) => ({
      peers: (rule.to ?? []).map((peer) => ({
        ipBlock: peer.ipBlock
          ? { cidr: peer.ipBlock.cidr, except: peer.ipBlock.except ?? [] }
          : undefined,
        namespaceSelector: peer.namespaceSelector?.matchLabels ?? undefined,
        podSelector: peer.podSelector?.matchLabels ?? undefined,
      })),
      ports: (rule.ports ?? []).map((p) => ({
        protocol: p.protocol ?? "TCP",
        port: p.port !== undefined ? String(p.port) : undefined,
      })),
    }))
    return {
      name: np.metadata?.name ?? "",
      namespace: np.metadata?.namespace ?? "",
      podSelector: labelsToString(np.spec?.podSelector?.matchLabels),
      policyTypes: np.spec?.policyTypes ?? [],
      ingressRuleCount: ingress.length,
      egressRuleCount: egress.length,
      creationTimestamp: np.metadata?.creationTimestamp?.toISOString() ?? "",
      ingressRules,
      egressRules,
    }
  })
}
