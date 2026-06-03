import { AutoscalingV2Api } from "@kubernetes/client-node"

import { HPAInfo } from "./types"

export async function listHPAs(api: AutoscalingV2Api): Promise<HPAInfo[]> {
  const res = await api.listHorizontalPodAutoscalerForAllNamespaces()
  return res.items.map((hpa) => {
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
            cur.external.current.value ??
              cur.external.current.averageValue ??
              "",
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
      creationTimestamp: hpa.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: hpa.metadata?.labels ?? {},
      annotations: hpa.metadata?.annotations ?? {},
    }
  })
}
