import { dump as yamlDump, load as yamlLoad } from "js-yaml"
import {
  KubeConfig,
  KubernetesObjectApi,
  PatchStrategy,
} from "@kubernetes/client-node"

import { ApplyResult, DryRunResult } from "./types"

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

/**
 * Deletes by GVK rather than a typed API, so one handler covers every kind the
 * detail panels expose — including CRDs like VolumeSnapshot.
 */
export async function deleteResource(
  kc: KubeConfig,
  apiVersion: string,
  kind: string,
  name: string,
  namespace?: string,
  propagationPolicy?: string,
): Promise<{ name: string; namespace: string }> {
  const client = KubernetesObjectApi.makeApiClient(kc)
  await client.delete(
    {
      apiVersion,
      kind,
      metadata: { name, ...(namespace ? { namespace } : {}) },
    },
    undefined,
    undefined,
    undefined,
    undefined,
    propagationPolicy,
  )
  return { name, namespace: namespace ?? "" }
}

/** A create against an object that already exists comes back 409, which is how
 *  apply learns it should patch instead. */
function isAlreadyExists(err: unknown): boolean {
  const statusCode =
    (err as Record<string, unknown>).statusCode ??
    (err as Record<string, unknown>).code
  return statusCode === 409
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
    if (isAlreadyExists(err)) {
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

// Mirrors YAML_DUMP_OPTS in src/renderer/lib/yaml.ts. Sorted keys matter most
// here: without them the two sides of the diff would differ by key order alone.
const DIFF_YAML_OPTS = {
  lineWidth: -1,
  sortKeys: true,
  noRefs: true,
  indent: 2,
} as const

const DIFF_CONTEXT_LINES = 3

type DiffOp = { type: " " | "-" | "+"; line: string }

/** Longest-common-subsequence line diff. A dedicated diff dependency would be
 *  overkill: both sides are the server's own serialisation of the same object,
 *  so they already line up closely. */
function diffOps(a: string[], b: string[]): DiffOp[] {
  const n = a.length
  const m = b.length
  // lcs[i][j] = length of the LCS of a[i:] and b[j:].
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: " ", line: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: "-", line: a[i] })
      i++
    } else {
      ops.push({ type: "+", line: b[j] })
      j++
    }
  }
  while (i < n) ops.push({ type: "-", line: a[i++] })
  while (j < m) ops.push({ type: "+", line: b[j++] })
  return ops
}

function toLines(text: string): string[] {
  const trimmed = text.replace(/\n$/, "")
  return trimmed === "" ? [] : trimmed.split("\n")
}

/** Unified-style diff, collapsing unchanged stretches to a few lines of
 *  context so a large manifest doesn't bury the handful of changed lines. */
function unifiedDiff(before: string, after: string): string {
  if (before === after) return ""
  const ops = diffOps(toLines(before), toLines(after))

  const keep = new Array<boolean>(ops.length).fill(false)
  ops.forEach((op, idx) => {
    if (op.type === " ") return
    const from = Math.max(0, idx - DIFF_CONTEXT_LINES)
    const to = Math.min(ops.length - 1, idx + DIFF_CONTEXT_LINES)
    for (let k = from; k <= to; k++) keep[k] = true
  })

  const out: string[] = []
  let collapsing = false
  ops.forEach((op, idx) => {
    if (!keep[idx]) {
      if (!collapsing) out.push("@@")
      collapsing = true
      return
    }
    collapsing = false
    out.push(`${op.type}${op.line}`)
  })
  return out.join("\n")
}

function responseBody(res: unknown): Record<string, unknown> {
  const wrapped = res as { body?: Record<string, unknown> }
  return (wrapped.body ?? res) as Record<string, unknown>
}

/**
 * Server-side dry run of `applyResource`: the API server runs defaulting,
 * admission webhooks and validation with `dryRun=All` and persists nothing,
 * then we diff what it hands back against what's live. This is the
 * "show me what changes" step the apply UI offers before the real write.
 */
export async function dryRunResource(
  kc: KubeConfig,
  yamlString: string,
): Promise<DryRunResult> {
  const obj = yamlLoad(yamlString) as Record<string, unknown>
  if (!obj || typeof obj !== "object") {
    throw new Error("Invalid YAML: must be a Kubernetes object")
  }
  const { name, namespace } = requireObjectIdentity(obj)
  const kind = obj.kind as string
  const client = KubernetesObjectApi.makeApiClient(kc)

  // A missing object is the normal "this apply creates it" case, so a failed
  // read leaves us with no "before" side rather than failing the preview.
  let live: Record<string, unknown> | null = null
  try {
    const res = await client.read({
      apiVersion: obj.apiVersion as string,
      kind,
      metadata: { name, ...(namespace ? { namespace } : {}) },
    })
    live = stripServerFields(responseBody(res))
  } catch {
    live = null
  }

  let rendered: Record<string, unknown>
  try {
    rendered = responseBody(await client.create(obj as never, undefined, "All"))
  } catch (err: unknown) {
    if (!isAlreadyExists(err)) throw err
    rendered = responseBody(
      await client.patch(
        obj as never,
        undefined,
        "All",
        undefined,
        undefined,
        PatchStrategy.StrategicMergePatch,
      ),
    )
  }

  const renderedYaml = yamlDump(stripServerFields(rendered), DIFF_YAML_OPTS)
  const liveYaml = live ? yamlDump(live, DIFF_YAML_OPTS) : ""

  return {
    name,
    namespace,
    kind,
    action: live ? "update" : "create",
    diff: live ? unifiedDiff(liveYaml, renderedYaml) : "",
    rendered: renderedYaml,
  }
}
