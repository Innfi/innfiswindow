import { load as yamlLoad } from "js-yaml"
import {
  KubeConfig,
  KubernetesObjectApi,
  PatchStrategy,
} from "@kubernetes/client-node"

import { ApplyResult } from "./types"

const SERVER_METADATA_FIELDS = [
  "managedFields",
  "resourceVersion",
  "uid",
  "creationTimestamp",
  "generation",
  "selfLink",
] as const

const LAST_APPLIED = "kubectl.kubernetes.io/last-applied-configuration"

function stripServerFields(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const rest = { ...obj }
  delete rest.status
  const meta = rest.metadata as Record<string, unknown> | undefined
  if (!meta) return rest
  const cleanMeta = { ...meta }
  for (const field of SERVER_METADATA_FIELDS) delete cleanMeta[field]
  const annotations = cleanMeta.annotations as
    | Record<string, unknown>
    | undefined
  if (annotations) {
    const cleanAnnotations = { ...annotations }
    delete cleanAnnotations[LAST_APPLIED]
    if (Object.keys(cleanAnnotations).length > 0) {
      cleanMeta.annotations = cleanAnnotations
    } else {
      delete cleanMeta.annotations
    }
  }
  return { ...rest, metadata: cleanMeta }
}

function toApplyResult(
  res: unknown,
  fallbackName: string,
  fallbackNamespace: string,
): ApplyResult {
  const body = (res as { body?: Record<string, unknown> }).body ?? res
  const meta = (body as Record<string, unknown>).metadata as
    | Record<string, unknown>
    | undefined
  return {
    name: (meta?.name as string) ?? fallbackName,
    namespace: (meta?.namespace as string) ?? fallbackNamespace,
  }
}

function requireObjectIdentity(obj: Record<string, unknown>): {
  name: string
  namespace: string
} {
  const meta = (obj?.metadata ?? {}) as Record<string, unknown>
  const name = (meta.name as string) ?? ""
  const namespace = (meta.namespace as string) ?? ""
  if (!obj?.apiVersion || !obj.kind || !name) {
    throw new Error("YAML must include apiVersion, kind, and metadata.name")
  }
  return { name, namespace }
}

export async function readResource(
  kc: KubeConfig,
  apiVersion: string,
  kind: string,
  name: string,
  namespace?: string,
): Promise<Record<string, unknown>> {
  const client = KubernetesObjectApi.makeApiClient(kc)
  const res = await client.read({
    apiVersion,
    kind,
    metadata: { name, ...(namespace ? { namespace } : {}) },
  })
  const body =
    (res as unknown as { body?: Record<string, unknown> }).body ?? res
  return stripServerFields(body as Record<string, unknown>)
}

/**
 * Full PUT replace. Unlike applyResource's merge-patch fallback, this removes
 * fields the user deleted from the manifest. Dispatches on the object's own
 * apiVersion/kind, so it covers every resource kind.
 */
export async function replaceResource(
  kc: KubeConfig,
  yamlString: string,
): Promise<ApplyResult> {
  const obj = yamlLoad(yamlString) as Record<string, unknown>
  if (!obj || typeof obj !== "object") {
    throw new Error("Invalid YAML: must be a Kubernetes object")
  }
  const { name, namespace } = requireObjectIdentity(obj)
  const client = KubernetesObjectApi.makeApiClient(kc)
  const res = await client.replace(obj as never)
  return toApplyResult(res, name, namespace)
}

export async function applyResource(
  kc: KubeConfig,
  yamlString: string,
): Promise<ApplyResult> {
  const obj = yamlLoad(yamlString) as Record<string, unknown>
  if (!obj || typeof obj !== "object") {
    throw new Error("Invalid YAML: must be a Kubernetes object")
  }
  const { name, namespace } = requireObjectIdentity(obj)
  const client = KubernetesObjectApi.makeApiClient(kc)
  try {
    const res = await client.create(obj as never)
    return toApplyResult(res, name, namespace)
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
      return toApplyResult(res, name, namespace)
    }
    throw err
  }
}
