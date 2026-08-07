import { load as yamlLoad } from "js-yaml"
import {
  CoreV1Api,
  NetworkingV1Api,
  V1EndpointAddress,
  V1Endpoints,
  V1Ingress,
  V1NetworkPolicy,
  V1NetworkPolicyPeer,
  V1NetworkPolicyPort,
} from "@kubernetes/client-node"

import {
  EndpointAddress,
  EndpointInfo,
  EndpointSummary,
  IngressInfo,
  IngressSummary,
  NetworkPolicyInfo,
  NetworkPolicyRule,
  NetworkPolicySummary,
  ResourceRef,
  ServiceInfo,
} from "./types"

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

export async function listServices(
  api: CoreV1Api,
  namespace?: string,
): Promise<ServiceInfo[]> {
  const res = namespace
    ? await api.listNamespacedService({ namespace })
    : await api.listServiceForAllNamespaces()
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
      sessionAffinity: svc.spec?.sessionAffinity ?? "None",
      externalTrafficPolicy: svc.spec?.externalTrafficPolicy ?? "",
    }
  })
}

function mapIngressSummary(ing: V1Ingress): IngressSummary {
  const lbIngress = ing.status?.loadBalancer?.ingress ?? []
  const hasTLS = (ing.spec?.tls ?? []).length > 0
  return {
    name: ing.metadata?.name ?? "",
    namespace: ing.metadata?.namespace ?? "",
    ingressClassName: ing.spec?.ingressClassName ?? "",
    hosts:
      (ing.spec?.rules ?? [])
        .map((r) => r.host ?? "*")
        .filter((h, i, arr) => arr.indexOf(h) === i)
        .join(", ") || "*",
    address: lbIngress[0]?.ip ?? lbIngress[0]?.hostname ?? "",
    ports: hasTLS ? "80, 443" : "80",
    creationTimestamp: ing.metadata?.creationTimestamp?.toISOString() ?? "",
  }
}

export async function listIngresses(
  api: NetworkingV1Api,
  namespace?: string,
): Promise<IngressSummary[]> {
  const res = namespace
    ? await api.listNamespacedIngress({ namespace })
    : await api.listIngressForAllNamespaces()
  return res.items.map(mapIngressSummary)
}

export async function getIngress(
  api: NetworkingV1Api,
  namespace: string,
  name: string,
): Promise<IngressInfo> {
  const ing = await api.readNamespacedIngress({ name, namespace })
  return {
    ...mapIngressSummary(ing),
    tls: (ing.spec?.tls ?? []).map((t) => ({
      secretName: t.secretName ?? "",
      hosts: t.hosts ?? [],
    })),
    rules: (ing.spec?.rules ?? []).map((r) => ({
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
    })),
    labels: ing.metadata?.labels ?? {},
    annotations: ing.metadata?.annotations ?? {},
  }
}

export async function createService(
  api: CoreV1Api,
  namespace: string,
  name: string,
  type: string,
  ports: ServicePort[],
  selector: Record<string, string>,
): Promise<ResourceRef> {
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
): Promise<ResourceRef> {
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

export async function replaceServiceFromYaml(
  api: CoreV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
): Promise<ResourceRef> {
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
): Promise<ResourceRef> {
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
): Promise<ResourceRef> {
  const body = {
    spec: buildIngressSpec(ingressClassName, rules, tls),
  }
  const res = await api.patchNamespacedIngress({ name, namespace, body })
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
): Promise<ResourceRef> {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedIngress({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

function mapEndpointAddresses(
  addresses: V1EndpointAddress[],
): EndpointAddress[] {
  return addresses.map((addr) => ({
    ip: addr.ip,
    targetPodName: addr.targetRef?.name ?? null,
    targetPodNamespace: addr.targetRef?.namespace ?? null,
  }))
}

function mapEndpointSummary(ep: V1Endpoints): EndpointSummary {
  const subsets = ep.subsets ?? []
  const allPorts = subsets.flatMap((s) =>
    (s.ports ?? []).map(
      (p) => `${p.name ? p.name + ":" : ""}${p.port}/${p.protocol ?? "TCP"}`,
    ),
  )
  return {
    name: ep.metadata?.name ?? "",
    namespace: ep.metadata?.namespace ?? "",
    readyAddressCount: subsets.reduce(
      (n, s) => n + (s.addresses ?? []).length,
      0,
    ),
    notReadyAddressCount: subsets.reduce(
      (n, s) => n + (s.notReadyAddresses ?? []).length,
      0,
    ),
    ports: [...new Set(allPorts)].join(", "),
    creationTimestamp: ep.metadata?.creationTimestamp?.toISOString() ?? "",
  }
}

export async function listEndpoints(
  api: CoreV1Api,
  namespace?: string,
): Promise<EndpointSummary[]> {
  const res = namespace
    ? await api.listNamespacedEndpoints({ namespace })
    : await api.listEndpointsForAllNamespaces()
  return res.items.map(mapEndpointSummary)
}

export async function getEndpoint(
  api: CoreV1Api,
  namespace: string,
  name: string,
): Promise<EndpointInfo> {
  const ep = await api.readNamespacedEndpoints({ name, namespace })
  return {
    ...mapEndpointSummary(ep),
    labels: ep.metadata?.labels ?? {},
    annotations: ep.metadata?.annotations ?? {},
    subsets: (ep.subsets ?? []).map((subset) => ({
      readyAddresses: mapEndpointAddresses(subset.addresses ?? []),
      notReadyAddresses: mapEndpointAddresses(subset.notReadyAddresses ?? []),
      ports: (subset.ports ?? []).map((p) => ({
        name: p.name ?? "",
        port: p.port,
        protocol: p.protocol ?? "TCP",
      })),
    })),
  }
}

function labelsToString(labels: Record<string, string> | undefined): string {
  if (!labels || Object.keys(labels).length === 0) return "All pods"
  return Object.entries(labels)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")
}

function mapNetworkPolicySummary(np: V1NetworkPolicy): NetworkPolicySummary {
  return {
    name: np.metadata?.name ?? "",
    namespace: np.metadata?.namespace ?? "",
    podSelector: labelsToString(np.spec?.podSelector?.matchLabels),
    policyTypes: np.spec?.policyTypes ?? [],
    ingressRuleCount: (np.spec?.ingress ?? []).length,
    egressRuleCount: (np.spec?.egress ?? []).length,
    creationTimestamp: np.metadata?.creationTimestamp?.toISOString() ?? "",
  }
}

/** Ingress rules name their peers with `_from`, egress with `to`; everything
 *  else about the two is identical. */
function mapNetworkPolicyRule(
  peers: V1NetworkPolicyPeer[],
  ports: V1NetworkPolicyPort[],
): NetworkPolicyRule {
  return {
    peers: peers.map((peer) => ({
      ipBlock: peer.ipBlock
        ? { cidr: peer.ipBlock.cidr, except: peer.ipBlock.except ?? [] }
        : undefined,
      namespaceSelector: peer.namespaceSelector?.matchLabels ?? undefined,
      podSelector: peer.podSelector?.matchLabels ?? undefined,
    })),
    ports: ports.map((p) => ({
      protocol: p.protocol ?? "TCP",
      port: p.port !== undefined ? String(p.port) : undefined,
    })),
  }
}

export async function listNetworkPolicies(
  api: NetworkingV1Api,
  namespace?: string,
): Promise<NetworkPolicySummary[]> {
  const res = namespace
    ? await api.listNamespacedNetworkPolicy({ namespace })
    : await api.listNetworkPolicyForAllNamespaces()
  return res.items.map(mapNetworkPolicySummary)
}

export async function getNetworkPolicy(
  api: NetworkingV1Api,
  namespace: string,
  name: string,
): Promise<NetworkPolicyInfo> {
  const np = await api.readNamespacedNetworkPolicy({ name, namespace })
  return {
    ...mapNetworkPolicySummary(np),
    labels: np.metadata?.labels ?? {},
    annotations: np.metadata?.annotations ?? {},
    ingressRules: (np.spec?.ingress ?? []).map((rule) =>
      mapNetworkPolicyRule(rule._from ?? [], rule.ports ?? []),
    ),
    egressRules: (np.spec?.egress ?? []).map((rule) =>
      mapNetworkPolicyRule(rule.to ?? [], rule.ports ?? []),
    ),
  }
}
