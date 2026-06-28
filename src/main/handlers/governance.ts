import { CoreV1Api, PolicyV1Api } from "@kubernetes/client-node"

import { LimitRangeInfo, PDBInfo, ResourceQuotaInfo } from "./types"

export async function listResourceQuotas(
  api: CoreV1Api,
): Promise<ResourceQuotaInfo[]> {
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
    labels: rq.metadata?.labels ?? {},
    annotations: rq.metadata?.annotations ?? {},
  }))
}

export async function listLimitRanges(
  api: CoreV1Api,
): Promise<LimitRangeInfo[]> {
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
        Object.entries(l._default ?? {}).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
      defaultRequest: Object.fromEntries(
        Object.entries(l.defaultRequest ?? {}).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
    })),
    creationTimestamp: lr.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: lr.metadata?.labels ?? {},
    annotations: lr.metadata?.annotations ?? {},
  }))
}

export async function listPDBs(api: PolicyV1Api): Promise<PDBInfo[]> {
  try {
    const res = await api.listPodDisruptionBudgetForAllNamespaces()
    return res.items.map((pdb) => ({
      name: pdb.metadata?.name ?? "",
      namespace: pdb.metadata?.namespace ?? "",
      minAvailable:
        pdb.spec?.minAvailable !== undefined
          ? String(pdb.spec.minAvailable)
          : null,
      maxUnavailable:
        pdb.spec?.maxUnavailable !== undefined
          ? String(pdb.spec.maxUnavailable)
          : null,
      currentHealthy: pdb.status?.currentHealthy ?? 0,
      desiredHealthy: pdb.status?.desiredHealthy ?? 0,
      disruptionsAllowed: pdb.status?.disruptionsAllowed ?? 0,
      expectedPods: pdb.status?.expectedPods ?? 0,
      selector: pdb.spec?.selector?.matchLabels ?? {},
      creationTimestamp: pdb.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: (pdb.metadata?.labels as Record<string, string>) ?? {},
      annotations: (pdb.metadata?.annotations as Record<string, string>) ?? {},
    }))
  } catch (e: unknown) {
    const httpErr = e as {
      response?: { statusCode?: number }
      statusCode?: number
    }
    const code = httpErr.response?.statusCode ?? httpErr.statusCode
    if (code === 404 || code === 403) {
      return []
    }
    throw e
  }
}
