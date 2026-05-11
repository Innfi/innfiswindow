import { useCallback, useEffect, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { handleIpcError } from "../../lib/ipc-error"
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { K8sDeployment, K8sEvent, K8sNode, K8sPod } from "../types/k8s"
import { RefreshBar } from "./RefreshBar"

interface OverviewData {
  pods: K8sPod[]
  nodes: K8sNode[]
  deployments: K8sDeployment[]
  events: K8sEvent[]
}

function isUnhealthyPod(pod: K8sPod): boolean {
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

function isFailedDeployment(dep: K8sDeployment): boolean {
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
  })
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null)

  const selectedContext = useAppStore((s) => s.selectedContext)
  const refreshInterval = useAppStore((s) => s.refreshInterval)
  const setSelectedResourceType = useAppStore((s) => s.setSelectedResourceType)

  const fetchAll = useCallback(
    async (silent = false) => {
      try {
        const [pods, nodes, deployments, events] = await Promise.all([
          window.api.k8s.listPods({
            contextName: selectedContext ?? undefined,
          }),
          window.api.k8s.listNodes({
            contextName: selectedContext ?? undefined,
          }),
          window.api.k8s.listDeployments({
            contextName: selectedContext ?? undefined,
          }),
          window.api.listEvents({ contextName: selectedContext ?? undefined }),
        ])
        setData({ pods, nodes, deployments, events })
        setLastRefreshedAt(Date.now())
      } catch (err) {
        if (!silent) handleIpcError(err, "overview")
      }
    },
    [selectedContext],
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

  const cards = [
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
        <h2 className="font-semibold flex-1">Cluster Overview</h2>
        <RefreshBar
          lastRefreshedAt={lastRefreshedAt}
          onRefresh={() => fetchAll(false)}
        />
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-36">Namespace</TableHead>
                  <TableHead className="w-28">Phase</TableHead>
                  <TableHead className="w-24 text-center">Restarts</TableHead>
                  <TableHead className="w-20">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unhealthyPods.map((pod) => (
                  <TableRow key={`${pod.namespace}/${pod.name}`}>
                    <TableCell className="font-mono text-xs">
                      {pod.name}
                    </TableCell>
                    <TableCell className="text-xs">{pod.namespace}</TableCell>
                    <TableCell>
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
                    <TableCell className="text-center text-xs">
                      {pod.restarts}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatAge(pod.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-36">Reason</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-40">Object</TableHead>
                  <TableHead className="w-20">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentWarningEvents.map((ev, i) => (
                  <TableRow key={`${ev.name}-${i}`}>
                    <TableCell>
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {ev.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ev.reason}
                    </TableCell>
                    <TableCell
                      className="text-xs max-w-xs truncate"
                      title={ev.message}
                    >
                      {ev.message}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ev.involvedObjectKind}/{ev.involvedObjectName}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatAge(ev.lastTimestamp || ev.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
