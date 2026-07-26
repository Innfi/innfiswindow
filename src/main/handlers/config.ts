import { load as yamlLoad } from "js-yaml"
import { CoreV1Api } from "@kubernetes/client-node"

import {
  ConfigMapInfo,
  ResourceRef,
  SecretInfo,
  ServiceAccountInfo,
} from "./types"

export async function listConfigMaps(api: CoreV1Api): Promise<ConfigMapInfo[]> {
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

export async function listSecrets(api: CoreV1Api): Promise<SecretInfo[]> {
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

export async function listServiceAccounts(
  api: CoreV1Api,
): Promise<ServiceAccountInfo[]> {
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

export async function replaceConfigMapFromYaml(
  api: CoreV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
): Promise<ResourceRef> {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedConfigMap({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}

export async function replaceSecretFromYaml(
  api: CoreV1Api,
  namespace: string,
  name: string,
  yamlStr: string,
): Promise<ResourceRef> {
  const body = yamlLoad(yamlStr) as object
  const res = await api.replaceNamespacedSecret({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
  }
}
