// Validation for the parts of an HPA spec the UI edits. Shared so the dialogs
// and the handlers refuse the same input, and the message the user reads is
// the message that would have come back from the write.

import { HPAResourceMetricSpec } from "./k8s"
import { isPositiveQuantity } from "./quantity"

/** The metric sources the editor covers. Pods/Object/External carry a metric
 *  selector and stay in YAML. */
export const RESOURCE_METRIC_KINDS = ["Resource", "ContainerResource"] as const

/** How a resource metric states its target. `Value` is valid autoscaling/v2,
 *  but only for Object and External metrics. */
export const RESOURCE_METRIC_TARGET_TYPES = [
  "Utilization",
  "AverageValue",
] as const

/** Resource names are lowercase DNS-ish, optionally prefixed for an extended
 *  resource (`nvidia.com/gpu`). */
const RESOURCE_NAME_RE =
  /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?(\/[a-z0-9]([-a-z0-9.]*[a-z0-9])?)?$/

/** A message naming what is wrong with the metric, or null when it is fine. */
export function validateResourceMetric(
  metric: HPAResourceMetricSpec,
): string | null {
  if (!metric.name) return "Resource name is required."
  if (!RESOURCE_NAME_RE.test(metric.name)) {
    return `"${metric.name}" is not a resource name — use cpu, memory, or an extended resource like nvidia.com/gpu.`
  }
  if (metric.kind === "ContainerResource" && !metric.container) {
    return "A ContainerResource metric needs the container it reads."
  }
  if (metric.targetType === "Utilization") {
    const util = metric.averageUtilization
    if (util === null || !Number.isInteger(util) || util <= 0) {
      return "Average utilization must be a whole percentage above 0."
    }
    return null
  }
  if (metric.targetType === "AverageValue") {
    if (!isPositiveQuantity(metric.value)) {
      return `"${metric.value}" is not a quantity above zero — use a value like 100m or 500Mi.`
    }
    return null
  }
  return `A resource metric cannot target ${metric.targetType}; use Utilization or AverageValue.`
}

/** Identifies the reading a metric takes: the API server rejects two metrics
 *  reading the same resource off the same container. */
export function metricIdentity(metric: HPAResourceMetricSpec): string {
  return `${metric.kind}/${metric.name}/${metric.container}`
}

export function validateReplicaBounds(
  minReplicas: number,
  maxReplicas: number,
): string | null {
  if (!Number.isInteger(minReplicas) || !Number.isInteger(maxReplicas)) {
    return "minReplicas and maxReplicas must be whole numbers."
  }
  if (minReplicas < 0) return "minReplicas cannot be negative."
  if (maxReplicas < 1) return "maxReplicas must be at least 1."
  if (maxReplicas < minReplicas) {
    return `maxReplicas (${maxReplicas}) cannot be below minReplicas (${minReplicas}).`
  }
  return null
}
