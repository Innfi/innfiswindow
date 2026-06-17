import { AppsV1Api, CoreV1Api } from "@kubernetes/client-node"

interface AlarmRule {
  id: string
  name: string
  severity: "critical" | "warning" | "info"
  conditionType:
    | "pod-not-running"
    | "deployment-unavailable"
    | "warning-event"
    | "node-not-ready"
  context: string
  namespace?: string
  resourceNameFilter?: string
}

interface AlarmEntry {
  id: string
  ruleId: string
  ruleName: string
  severity: "critical" | "warning" | "info"
  context: string
  sourceKind: string
  sourceName: string
  namespace: string | null
  message: string
  triggeredAt: string
}

export async function evaluateAlarmRule(
  rule: AlarmRule,
  coreV1: CoreV1Api,
  appsV1: AppsV1Api,
): Promise<AlarmEntry[]> {
  const entries: AlarmEntry[] = []
  const now = new Date().toISOString()

  function makeId(ns: string, name: string): string {
    return `${rule.id}-${ns}-${name}`
  }

  switch (rule.conditionType) {
    case "pod-not-running": {
      const res = rule.namespace
        ? await coreV1.listNamespacedPod({ namespace: rule.namespace })
        : await coreV1.listPodForAllNamespaces()
      for (const pod of res.items) {
        const name = pod.metadata?.name ?? ""
        const ns = pod.metadata?.namespace ?? ""
        const phase = pod.status?.phase ?? ""
        if (rule.resourceNameFilter && !name.includes(rule.resourceNameFilter))
          continue
        if (phase !== "Running" && phase !== "Succeeded") {
          entries.push({
            id: makeId(ns, name),
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            context: rule.context,
            sourceKind: "Pod",
            sourceName: name,
            namespace: ns || null,
            message: `Pod ${name} is in phase ${phase || "Unknown"}`,
            triggeredAt: now,
          })
        }
      }
      break
    }
    case "deployment-unavailable": {
      const res = rule.namespace
        ? await appsV1.listNamespacedDeployment({ namespace: rule.namespace })
        : await appsV1.listDeploymentForAllNamespaces()
      for (const dep of res.items) {
        const name = dep.metadata?.name ?? ""
        const ns = dep.metadata?.namespace ?? ""
        const unavailable = dep.status?.unavailableReplicas ?? 0
        if (rule.resourceNameFilter && !name.includes(rule.resourceNameFilter))
          continue
        if (unavailable > 0) {
          entries.push({
            id: makeId(ns, name),
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            context: rule.context,
            sourceKind: "Deployment",
            sourceName: name,
            namespace: ns || null,
            message: `Deployment ${name} has ${unavailable} unavailable replica(s)`,
            triggeredAt: now,
          })
        }
      }
      break
    }
    case "warning-event": {
      const res = rule.namespace
        ? await coreV1.listNamespacedEvent({ namespace: rule.namespace })
        : await coreV1.listEventForAllNamespaces()
      for (const ev of res.items) {
        const name = ev.metadata?.name ?? ""
        const ns = ev.metadata?.namespace ?? ""
        const involvedName = ev.involvedObject?.name ?? ""
        const involvedKind = ev.involvedObject?.kind ?? "Object"
        if (
          rule.resourceNameFilter &&
          !involvedName.includes(rule.resourceNameFilter)
        )
          continue
        if (ev.type === "Warning") {
          entries.push({
            id: makeId(ns, name),
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            context: rule.context,
            sourceKind: involvedKind,
            sourceName: involvedName,
            namespace: ns || null,
            message: `${ev.reason ?? "Warning"}: ${ev.message ?? ""}`,
            triggeredAt: now,
          })
        }
      }
      break
    }
    case "node-not-ready": {
      const res = await coreV1.listNode()
      for (const node of res.items) {
        const name = node.metadata?.name ?? ""
        if (rule.resourceNameFilter && !name.includes(rule.resourceNameFilter))
          continue
        const readyCond = node.status?.conditions?.find(
          (c) => c.type === "Ready",
        )
        if (!readyCond || readyCond.status !== "True") {
          entries.push({
            id: makeId("", name),
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            context: rule.context,
            sourceKind: "Node",
            sourceName: name,
            namespace: null,
            message: `Node ${name} is not Ready (status: ${readyCond?.status ?? "Unknown"})`,
            triggeredAt: now,
          })
        }
      }
      break
    }
  }

  return entries
}
