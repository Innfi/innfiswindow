import {
  ApiextensionsV1Api,
  CustomObjectsApi,
  V1CustomResourceDefinition,
} from "@kubernetes/client-node"

import { evaluateJsonPath } from "../../shared/jsonpath"
import {
  Condition,
  CRDInfo,
  CRDPrinterColumn,
  CRDVersionInfo,
  CustomResourceDetail,
  CustomResourceInfo,
  CustomResourceRef,
  CustomResourceScope,
} from "./types"

function toPrinterColumns(
  columns: V1CustomResourceDefinition["spec"]["versions"][number]["additionalPrinterColumns"],
): CRDPrinterColumn[] {
  return (columns ?? []).map((col) => ({
    name: col.name ?? "",
    type: col.type ?? "string",
    jsonPath: col.jsonPath ?? "",
    description: col.description ?? "",
    priority: col.priority ?? 0,
  }))
}

function toVersions(crd: V1CustomResourceDefinition): CRDVersionInfo[] {
  return (crd.spec?.versions ?? []).map((v) => ({
    name: v.name ?? "",
    served: v.served ?? false,
    storage: v.storage ?? false,
    deprecated: v.deprecated ?? false,
    deprecationWarning: v.deprecationWarning ?? "",
    printerColumns: toPrinterColumns(v.additionalPrinterColumns),
    hasScale: v.subresources?.scale !== undefined,
    hasStatus: v.subresources?.status !== undefined,
  }))
}

export async function listCRDs(api: ApiextensionsV1Api): Promise<CRDInfo[]> {
  const res = await api.listCustomResourceDefinition()
  return res.items.map((crd) => {
    const versions = toVersions(crd)
    const conditions: Condition[] = (crd.status?.conditions ?? []).map((c) => ({
      type: c.type ?? "",
      status: c.status ?? "",
      reason: c.reason ?? "",
      message: c.message ?? "",
    }))
    const names = crd.spec?.names
    return {
      name: crd.metadata?.name ?? "",
      group: crd.spec?.group ?? "",
      kind: names?.kind ?? "",
      listKind: names?.listKind ?? "",
      singular: names?.singular ?? "",
      plural: names?.plural ?? "",
      shortNames: names?.shortNames ?? [],
      categories: names?.categories ?? [],
      scope: (crd.spec?.scope as CustomResourceScope) ?? "Namespaced",
      versions,
      storageVersion: versions.find((v) => v.storage)?.name ?? "",
      servedVersions: versions.filter((v) => v.served).map((v) => v.name),
      established:
        conditions.find((c) => c.type === "Established")?.status === "True",
      conditions,
      creationTimestamp: crd.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: crd.metadata?.labels ?? {},
      annotations: crd.metadata?.annotations ?? {},
    }
  })
}

function toInfo(
  item: unknown,
  ref: CustomResourceRef,
  printerColumns: string[],
): CustomResourceInfo {
  const obj = (item ?? {}) as Record<string, unknown>
  const meta = (obj.metadata ?? {}) as Record<string, unknown>
  const created = meta.creationTimestamp
  return {
    name: (meta.name as string) ?? "",
    namespace: (meta.namespace as string) ?? "",
    apiVersion:
      (obj.apiVersion as string) ??
      (ref.group ? `${ref.group}/${ref.version}` : ref.version),
    kind: (obj.kind as string) ?? ref.kind,
    creationTimestamp: created ? new Date(created as string).toISOString() : "",
    labels: (meta.labels as Record<string, string>) ?? {},
    annotations: (meta.annotations as Record<string, string>) ?? {},
    columns: printerColumns.map((path) => evaluateJsonPath(obj, path)),
  }
}

/** `metadata.managedFields` is the bulk of most server-side-applied objects
 *  and is noise in a manifest view, so it never crosses IPC. */
function stripManagedFields(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const meta = obj.metadata as Record<string, unknown> | undefined
  if (!meta || !("managedFields" in meta)) return obj
  const cleanMeta = { ...meta }
  delete cleanMeta.managedFields
  return { ...obj, metadata: cleanMeta }
}

/**
 * Lists the objects of one CRD version through `CustomObjectsApi`, which
 * addresses a kind by group/version/plural rather than by a compiled-in
 * client — the whole point of the generic browser.
 *
 * `printerColumns` are the JSONPaths from the CRD's own
 * `additionalPrinterColumns`; the caller passes them down so the table shows
 * what `kubectl get` would show for that kind. A path this app's evaluator
 * cannot handle yields `null` for that cell rather than failing the list.
 */
export async function listCustomResources(
  api: CustomObjectsApi,
  ref: CustomResourceRef,
  printerColumns: string[] = [],
  namespace?: string,
): Promise<CustomResourceInfo[]> {
  const gvr = { group: ref.group, version: ref.version, plural: ref.plural }
  const res = (
    ref.scope === "Cluster"
      ? await api.listClusterCustomObject(gvr)
      : namespace
        ? await api.listNamespacedCustomObject({ ...gvr, namespace })
        : await api.listCustomObjectForAllNamespaces(gvr)
  ) as { items?: unknown[] }
  return (res.items ?? []).map((item) => toInfo(item, ref, printerColumns))
}

export async function getCustomResource(
  api: CustomObjectsApi,
  ref: CustomResourceRef,
  name: string,
  printerColumns: string[] = [],
  namespace?: string,
): Promise<CustomResourceDetail> {
  const gvr = { group: ref.group, version: ref.version, plural: ref.plural }
  if (ref.scope === "Namespaced" && !namespace) {
    // The cluster-scoped read path would answer this with a bare 404 rather
    // than saying what is actually missing.
    throw new Error(
      `${ref.kind} is namespaced — reading ${name} needs a namespace.`,
    )
  }
  const res =
    namespace === undefined || ref.scope === "Cluster"
      ? await api.getClusterCustomObject({ ...gvr, name })
      : await api.getNamespacedCustomObject({ ...gvr, namespace, name })
  const object = stripManagedFields((res ?? {}) as Record<string, unknown>)
  return { info: toInfo(object, ref, printerColumns), object }
}
