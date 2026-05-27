import { load as yamlLoad } from "js-yaml"
import {
  KubeConfig,
  KubernetesObjectApi,
  PatchStrategy,
} from "@kubernetes/client-node"

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
