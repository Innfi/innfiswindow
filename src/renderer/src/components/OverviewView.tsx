import { useCallback, useEffect, useMemo, useState } from "react"

import type { AlertMutes, ClusterAlert } from "../../../shared/triage"
import {
  alertsInScope,
  partitionAlerts,
  pruneMutes,
  triageCluster,
} from "../../../shared/triage"
import { RefreshBar } from "../../components/ui/RefreshBar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table"
import { handleIpcError } from "../../lib/ipc-error"
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import {
  K8sDaemonSetSummary,
  K8sDeploymentSummary,
  K8sEvent,
  K8sJob,
  K8sNode,
  K8sPodSummary,
  K8sPVC,
  K8sStatefulSetSummary,
} from "../types/k8s"
import type { ResourceType } from "../types/resource"
import { NeedsAttentionSection } from "./NeedsAttentionSection"

interface OverviewData {
  pods: K8sPodSummary[]
  nodes: K8sNode[]
  deployments: K8sDeploymentSummary[]
  events: K8sEvent[]
  // Read for the triage at the top rather than for a card of their own: a
  // StatefulSet with nothing ready is as urgent as a Deployment with nothing
  // ready, and neither shows up in a pod count.
  statefulSets: K8sStatefulSetSummary[]
  daemonSets: K8sDaemonSetSummary[]
  jobs: K8sJob[]
  pvcs: K8sPVC[]
  /** What the lists were read for. A context or namespace switch leaves the
   *  previous read on screen until the next one lands; anything that reasons
   *  from an object's *absence* has to know which read it is looking at. */
  readFor: { context: string | null; namespace: string | null } | null
}

const NO_MUTES: AlertMutes = {}

function isUnhealthyPod(pod: K8sPodSummary): boolean {
  const phase = pod.status
  if (phase !== "Running" && phase !== "Succeeded") return true
  if (pod.restarts > 5) return true
  return false
}

function isNodeUnderPressure(node: K8sNode): boolean {
  const pressureTypes = ["MemoryPressure", "DiskPressure", "PIDPressure"]
  return node.conditions.some(
    (c) => pressureTypes.includes(c.type) && c.status === "True",
  )
}

function isFailedDeployment(dep: K8sDeploymentSummary): boolean {
  return dep.availableReplicas < dep.replicas
}

function isRecentWarningEvent(ev: K8sEvent): boolean {
  if (ev.type !== "Warning") return false
  const ts = ev.lastTimestamp || ev.creationTimestamp
  if (!ts) return false
  return Date.now() - new Date(ts).getTime() < 60 * 60 * 1000
}

export function OverviewView(): JSX.Element {
  const [data, setData] = useState<OverviewData>({
    pods: [],
    nodes: [],
    deployments: [],
    events: [],
    statefulSets: [],
    daemonSets: [],
    jobs: [],
    pvcs: [],
    readFor: null,
  })
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null)

  const selectedContext = useAppStore((s) => s.selectedContext)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const mutes = useAppStore(
    (s) => s.alertMutes[selectedContext ?? ""] ?? NO_MUTES,
  )
  const setAlertMutes = useAppStore((s) => s.setAlertMutes)
  const refreshInterval = useAppStore((s) => s.refreshInterval)
  const setSelectedResourceType = useAppStore((s) => s.setSelectedResourceType)

  const fetchAll = useCallback(
    async (silent = false) => {
      try {
        const ctx = { contextName: selectedContext ?? undefined }
        // The app bar's namespace scope, answered by the API server like it
        // is for every list view. Nodes are cluster-scoped and read whole.
        const scoped = { ...ctx, namespace: selectedNamespace ?? undefined }
        const [
          pods,
          nodes,
          deployments,
          events,
          statefulSets,
          daemonSets,
          jobs,
          pvcs,
        ] = await Promise.all([
          window.api.k8s.listPods(scoped),
          window.api.k8s.listNodes(ctx),
          window.api.k8s.listDeployments(scoped),
          window.api.listEvents(scoped),
          window.api.k8s.listStatefulSets(scoped),
          window.api.k8s.listDaemonSets(scoped),
          window.api.k8s.listJobs(scoped),
          window.api.k8s.listPVCs(scoped),
        ])
        setData({
          pods,
          nodes,
          deployments,
          events,
          statefulSets,
          daemonSets,
          jobs,
          pvcs,
          readFor: { context: selectedContext, namespace: selectedNamespace },
        })
        setLastRefreshedAt(Date.now())
      } catch (err) {
        if (!silent) handleIpcError(err, "overview")
      }
    },
    [selectedContext, selectedNamespace],
  )

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (refreshInterval === "off") return
    const ms = (refreshInterval as number) * 1000
    const id = setInterval(() => fetchAll(true), ms)
    return () => clearInterval(id)
  }, [refreshInterval, fetchAll])

  // Worst-first list of what is actually broken, from the same objects the
  // cards below count.
  const raised = useMemo(() => triageCluster(data), [data])
  // The lists are already read under the namespace scope; filtering again
  // keeps the previous namespace's rows off screen while the next read is in
  // flight.
  const { active: alerts, muted } = partitionAlerts(
    alertsInScope(raised, selectedNamespace),
    mutes,
  )

  // A mute lasts as long as its problem: once a read of this context no longer
  // raises the alert, forget it, so a recurrence is shown again. Only a read
  // made for the context and namespace on screen can say that.
  useEffect(() => {
    if (
      data.readFor === null ||
      data.readFor.context !== selectedContext ||
      data.readFor.namespace !== selectedNamespace
    ) {
      return
    }
    const kept = pruneMutes(mutes, raised, selectedNamespace)
    if (kept !== mutes) setAlertMutes(selectedContext, kept)
  }, [data, raised, mutes, selectedContext, selectedNamespace, setAlertMutes])

  const muteAlert = (alert: ClusterAlert, until: number | null): void =>
    setAlertMutes(selectedContext, {
      ...mutes,
      [alert.id]: { until, namespace: alert.namespace },
    })

  const restoreAlerts = (restored: ClusterAlert[]): void => {
    const kept = { ...mutes }
    for (const alert of restored) delete kept[alert.id]
    setAlertMutes(selectedContext, kept)
  }

  const unhealthyPods = data.pods.filter(isUnhealthyPod)
  const nodePressureCount = data.nodes.filter(isNodeUnderPressure).length
  const failedDeploymentCount =
    data.deployments.filter(isFailedDeployment).length
  const recentWarningEvents = data.events
    .filter(isRecentWarningEvent)
    .sort((a, b) => {
      const ta = new Date(a.lastTimestamp || a.creationTimestamp).getTime()
      const tb = new Date(b.lastTimestamp || b.creationTimestamp).getTime()
      return tb - ta
    })
    .slice(0, 20)
  const recentWarningCount = data.events.filter(isRecentWarningEvent).length

  const cards: {
    label: string
    count: number
    color: string
    textColor: string
    resourceType: ResourceType
  }[] = [
    {
      label: "Unhealthy Pods",
      count: unhealthyPods.length,
      color:
        unhealthyPods.length > 0
          ? "border-red-400 bg-red-50 dark:bg-red-950/20"
          : "border-green-400 bg-green-50 dark:bg-green-950/20",
      textColor:
        unhealthyPods.length > 0
          ? "text-red-700 dark:text-red-400"
          : "text-green-700 dark:text-green-400",
      resourceType: "Pods",
    },
    {
      label: "Node Pressure",
      count: nodePressureCount,
      color:
        nodePressureCount > 0
          ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20"
          : "border-green-400 bg-green-50 dark:bg-green-950/20",
      textColor:
        nodePressureCount > 0
          ? "text-orange-700 dark:text-orange-400"
          : "text-green-700 dark:text-green-400",
      resourceType: "Nodes",
    },
    {
      label: "Failed Deployments",
      count: failedDeploymentCount,
      color:
        failedDeploymentCount > 0
          ? "border-red-400 bg-red-50 dark:bg-red-950/20"
          : "border-green-400 bg-green-50 dark:bg-green-950/20",
      textColor:
        failedDeploymentCount > 0
          ? "text-red-700 dark:text-red-400"
          : "text-green-700 dark:text-green-400",
      resourceType: "Deployments",
    },
    {
      label: "Recent Errors (1h)",
      count: recentWarningCount,
      color:
        recentWarningCount > 0
          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
          : "border-green-400 bg-green-50 dark:bg-green-950/20",
      textColor:
        recentWarningCount > 0
          ? "text-amber-700 dark:text-amber-400"
          : "text-green-700 dark:text-green-400",
      resourceType: "Events",
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2 shrink-0">
        <h2 className="font-semibold flex-1">
          Cluster Overview
          {selectedNamespace && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              namespace {selectedNamespace} · nodes are cluster-wide
            </span>
          )}
        </h2>
        <RefreshBar
          lastRefreshedAt={lastRefreshedAt}
          onRefresh={() => fetchAll(false)}
        />
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        <NeedsAttentionSection
          alerts={alerts}
          muted={muted}
          mutes={mutes}
          namespace={selectedNamespace}
          onMute={muteAlert}
          onRestore={restoreAlerts}
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((card) => (
            <button
              key={card.label}
              className={cn(
                "rounded-lg border-2 p-4 text-left hover:opacity-80 transition-opacity cursor-pointer",
                card.color,
              )}
              onClick={() => setSelectedResourceType(card.resourceType)}
            >
              <div className={cn("text-3xl font-bold", card.textColor)}>
                {card.count}
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {card.label}
              </div>
            </button>
          ))}
        </div>

        {/* Unhealthy Pods table */}
        <div>
          <h3 className="font-semibold mb-2">Unhealthy Pods</h3>
          {unhealthyPods.length === 0 ? (
            <p className="text-sm text-muted-foreground">All pods healthy.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap w-36">
                      Namespace
                    </TableHead>
                    <TableHead className="whitespace-nowrap w-28">
                      Phase
                    </TableHead>
                    <TableHead className="whitespace-nowrap w-24 text-center">
                      Restarts
                    </TableHead>
                    <TableHead className="whitespace-nowrap w-20">
                      Age
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unhealthyPods.map((pod) => (
                    <TableRow key={`${pod.namespace}/${pod.name}`}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {pod.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {pod.namespace}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                            pod.status === "Pending"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
                          )}
                        >
                          {pod.status}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center text-xs">
                        {pod.restarts}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatAge(pod.creationTimestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Recent Warning Events table */}
        <div>
          <h3 className="font-semibold mb-2">Recent Warning Events</h3>
          {recentWarningEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No warning events in the last hour.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap w-24">
                      Type
                    </TableHead>
                    <TableHead className="whitespace-nowrap w-36">
                      Reason
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Message</TableHead>
                    <TableHead className="whitespace-nowrap w-40">
                      Object
                    </TableHead>
                    <TableHead className="whitespace-nowrap w-20">
                      Age
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentWarningEvents.map((ev, i) => (
                    <TableRow key={`${ev.name}-${i}`}>
                      <TableCell className="whitespace-nowrap">
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          {ev.type}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {ev.reason}
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap text-xs max-w-xs truncate"
                        title={ev.message}
                      >
                        {ev.message}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {ev.involvedObjectKind}/{ev.involvedObjectName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatAge(ev.lastTimestamp || ev.creationTimestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
