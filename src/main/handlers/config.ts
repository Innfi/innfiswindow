import { load as yamlLoad } from "js-yaml"
import { CoreV1Api, V1ConfigMap, V1Secret } from "@kubernetes/client-node"

import {
  ConfigMapInfo,
  ConfigMapSummary,
  ResourceRef,
  SecretInfo,
  SecretSummary,
  ServiceAccountInfo,
} from "./types"

function mapConfigMapSummary(cm: V1ConfigMap): ConfigMapSummary {
  return {
    name: cm.metadata?.name ?? "",
    namespace: cm.metadata?.namespace ?? "",
    creationTimestamp: cm.metadata?.creationTimestamp?.toISOString() ?? "",
    keys: [...Object.keys(cm.data ?? {}), ...Object.keys(cm.binaryData ?? {})],
  }
}

export async function listConfigMaps(
  api: CoreV1Api,
  namespace?: string,
): Promise<ConfigMapSummary[]> {
  const res = namespace
    ? await api.listNamespacedConfigMap({ namespace })
    : await api.listConfigMapForAllNamespaces()
  return res.items.map(mapConfigMapSummary)
}

export async function getConfigMap(
  api: CoreV1Api,
  namespace: string,
  name: string,
): Promise<ConfigMapInfo> {
  const cm = await api.readNamespacedConfigMap({ name, namespace })
  return {
    ...mapConfigMapSummary(cm),
    labels: cm.metadata?.labels ?? {},
    annotations: cm.metadata?.annotations ?? {},
    data: cm.data ?? {},
    binaryData: Object.fromEntries(
      Object.entries(cm.binaryData ?? {}).map(([k, v]) => [
        k,
        v ? v.length : 0,
      ]),
    ),
  }
}

function mapSecretSummary(secret: V1Secret): SecretSummary {
  return {
    name: secret.metadata?.name ?? "",
    namespace: secret.metadata?.namespace ?? "",
    type: secret.type ?? "Opaque",
    creationTimestamp: secret.metadata?.creationTimestamp?.toISOString() ?? "",
    keys: Object.keys(secret.data ?? {}),
  }
}

/** Lists key names only. The values stay in the main process until the detail
 *  panel asks for one Secret through `getSecret`. */
export async function listSecrets(
  api: CoreV1Api,
  namespace?: string,
): Promise<SecretSummary[]> {
  const res = namespace
    ? await api.listNamespacedSecret({ namespace })
    : await api.listSecretForAllNamespaces()
  return res.items.map(mapSecretSummary)
}

export async function getSecret(
  api: CoreV1Api,
  namespace: string,
  name: string,
): Promise<SecretInfo> {
  const secret = await api.readNamespacedSecret({ name, namespace })
  return {
    ...mapSecretSummary(secret),
    labels: secret.metadata?.labels ?? {},
    annotations: secret.metadata?.annotations ?? {},
    data: secret.data ?? {},
  }
}

export async function listServiceAccounts(
  api: CoreV1Api,
  namespace?: string,
): Promise<ServiceAccountInfo[]> {
  const res = namespace
    ? await api.listNamespacedServiceAccount({ namespace })
    : await api.listServiceAccountForAllNamespaces()
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
