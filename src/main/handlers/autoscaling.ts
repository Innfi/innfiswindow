import {
  AutoscalingV2Api,
  PatchStrategy,
  setHeaderOptions,
  V2HorizontalPodAutoscaler,
  V2MetricSpec,
  V2MetricTarget,
} from "@kubernetes/client-node"

import {
  metricIdentity,
  validateReplicaBounds,
  validateResourceMetric,
} from "../../shared/hpa"
import {
  HPAInfo,
  HPAReplicaBounds,
  HPAResourceMetric,
  HPAResourceMetricSpec,
  MutationResult,
} from "./types"

/** A JSON merge patch, not the strategic merge the client defaults to:
 *  `spec.metrics` has no merge key, so the HPA has to end with exactly the
 *  list sent rather than with the two lists merged. */
const JSON_MERGE_PATCH = setHeaderOptions(
  "Content-Type",
  PatchStrategy.MergePatch,
)

/** Resource and ContainerResource entries of `spec.metrics`, paired with the
 *  matching `status.currentMetrics` reading, in the structured form the metric
 *  editor round-trips. */
function toResourceMetrics(
  hpa: V2HorizontalPodAutoscaler,
): HPAResourceMetric[] {
  const currentMetrics = hpa.status?.currentMetrics ?? []
  const out: HPAResourceMetric[] = []
  for (const m of hpa.spec?.metrics ?? []) {
    if (m.type === "Resource" && m.resource) {
      const current = currentMetrics.find(
        (c) => c.type === "Resource" && c.resource?.name === m.resource?.name,
      )?.resource?.current
      out.push({
        kind: "Resource",
        name: m.resource.name,
        container: "",
        targetType:
          m.resource.target.averageUtilization != null
            ? "Utilization"
            : "AverageValue",
        averageUtilization: m.resource.target.averageUtilization ?? null,
        value:
          m.resource.target.averageValue != null
            ? String(m.resource.target.averageValue)
            : "",
        currentUtilization: current?.averageUtilization ?? null,
        currentValue:
          current?.averageValue != null ? String(current.averageValue) : "",
      })
    } else if (m.type === "ContainerResource" && m.containerResource) {
      const spec = m.containerResource
      const current = currentMetrics.find(
        (c) =>
          c.type === "ContainerResource" &&
          c.containerResource?.name === spec.name &&
          c.containerResource?.container === spec.container,
      )?.containerResource?.current
      out.push({
        kind: "ContainerResource",
        name: spec.name,
        container: spec.container,
        targetType:
          spec.target.averageUtilization != null
            ? "Utilization"
            : "AverageValue",
        averageUtilization: spec.target.averageUtilization ?? null,
        value:
          spec.target.averageValue != null
            ? String(spec.target.averageValue)
            : "",
        currentUtilization: current?.averageUtilization ?? null,
        currentValue:
          current?.averageValue != null ? String(current.averageValue) : "",
      })
    }
  }
  return out
}

function toHPAInfo(hpa: V2HorizontalPodAutoscaler): HPAInfo {
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
          cur.external.current.value ?? cur.external.current.averageValue ?? "",
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
    resourceMetrics: toResourceMetrics(hpa),
    otherMetricCount: specMetrics.filter(
      (m) => m.type !== "Resource" && m.type !== "ContainerResource",
    ).length,
    creationTimestamp: hpa.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: hpa.metadata?.labels ?? {},
    annotations: hpa.metadata?.annotations ?? {},
  }
}

export async function listHPAs(
  api: AutoscalingV2Api,
  namespace?: string,
): Promise<HPAInfo[]> {
  const res = namespace
    ? await api.listNamespacedHorizontalPodAutoscaler({ namespace })
    : await api.listHorizontalPodAutoscalerForAllNamespaces()
  return res.items.map(toHPAInfo)
}

/** One HPA, for the utilisation chart: it samples on its own interval rather
 *  than riding the list poll, so a re-list of every HPA in the namespace would
 *  be most of the payload thrown away. */
export async function getHPA(
  api: AutoscalingV2Api,
  namespace: string,
  name: string,
): Promise<HPAInfo> {
  const hpa = await api.readNamespacedHorizontalPodAutoscaler({
    name,
    namespace,
  })
  return toHPAInfo(hpa)
}

export async function updateHPAReplicas(
  api: AutoscalingV2Api,
  namespace: string,
  name: string,
  bounds: HPAReplicaBounds,
): Promise<MutationResult> {
  const { minReplicas, maxReplicas } = bounds
  const problem = validateReplicaBounds(minReplicas, maxReplicas)
  if (problem) throw new Error(problem)

  await api.patchNamespacedHorizontalPodAutoscaler(
    { name, namespace, body: { spec: { minReplicas, maxReplicas } } },
    JSON_MERGE_PATCH,
  )
  return { success: true, name, namespace }
}

function toMetricSpec(metric: HPAResourceMetricSpec): V2MetricSpec {
  const target: V2MetricTarget =
    metric.targetType === "Utilization"
      ? {
          type: "Utilization",
          averageUtilization: metric.averageUtilization ?? undefined,
        }
      : { type: "AverageValue", averageValue: metric.value.trim() }
  return metric.kind === "Resource"
    ? { type: "Resource", resource: { name: metric.name, target } }
    : {
        type: "ContainerResource",
        containerResource: {
          name: metric.name,
          container: metric.container,
          target,
        },
      }
}

/**
 * Replace the Resource and ContainerResource entries of `spec.metrics` with
 * exactly the list given, the edit `kubectl edit hpa` would make by hand.
 * `spec.metrics` has no merge key, so add and remove are the same write; the
 * Pods/Object/External metrics the editor cannot represent are read back off
 * the live object and carried through untouched.
 */
export async function updateHPAMetrics(
  api: AutoscalingV2Api,
  namespace: string,
  name: string,
  metrics: HPAResourceMetricSpec[],
): Promise<MutationResult> {
  const seen = new Set<string>()
  for (const metric of metrics) {
    const problem = validateResourceMetric(metric)
    if (problem) throw new Error(`Metric "${metric.name}": ${problem}`)
    // The API server rejects two metrics reading the same resource off the
    // same container; catching it here names the pair.
    const id = metricIdentity(metric)
    if (seen.has(id)) {
      throw new Error(
        `Metric "${metric.name}"${metric.container ? ` on container ${metric.container}` : ""} appears twice.`,
      )
    }
    seen.add(id)
  }

  const hpa = await api.readNamespacedHorizontalPodAutoscaler({
    name,
    namespace,
  })
  const preserved = (hpa.spec?.metrics ?? []).filter(
    (m) => m.type !== "Resource" && m.type !== "ContainerResource",
  )

  await api.patchNamespacedHorizontalPodAutoscaler(
    {
      name,
      namespace,
      body: { spec: { metrics: [...metrics.map(toMetricSpec), ...preserved] } },
    },
    JSON_MERGE_PATCH,
  )
  return { success: true, name, namespace }
}
