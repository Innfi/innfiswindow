import { useCallback, useEffect, useRef, useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DeleteButton } from "../../components/ui/DeleteButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { EditButton } from "../../components/ui/EditButton"
import { EmptyState } from "../../components/ui/EmptyState"
import { MetaEntry } from "../../components/ui/MetaEntry"
import { RefreshBar } from "../../components/ui/RefreshBar"
import { SectionHeader } from "../../components/ui/SectionHeader"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table"
import { cn, filterResources, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sNode } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

interface NodeMetric {
  nodeName: string
  cpuUsage: string
  memoryUsage: string
}

function parseCpuNanocores(cpu: string): number {
  if (cpu.endsWith("n")) return parseInt(cpu.slice(0, -1), 10)
  if (cpu.endsWith("m")) return Math.round(parseInt(cpu) * 1e6)
  return Math.round(parseFloat(cpu) * 1e9)
}

function parseAllocatableCpuToNanocores(cpu: string): number {
  if (cpu.endsWith("m")) return Math.round(parseInt(cpu) * 1e6)
  return Math.round(parseFloat(cpu) * 1e9)
}

function parseMemoryToBytes(mem: string): number {
  if (mem.endsWith("Ki")) return parseInt(mem) * 1024
  if (mem.endsWith("Mi")) return parseInt(mem) * 1024 * 1024
  if (mem.endsWith("Gi")) return parseInt(mem) * 1024 * 1024 * 1024
  if (mem.endsWith("Ti")) return parseInt(mem) * 1024 * 1024 * 1024 * 1024
  if (mem.endsWith("k")) return parseInt(mem) * 1000
  if (mem.endsWith("M")) return parseInt(mem) * 1000 * 1000
  if (mem.endsWith("G")) return parseInt(mem) * 1000 * 1000 * 1000
  return parseInt(mem) || 0
}

function formatMemory(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Gi`
  return `${(bytes / (1024 * 1024)).toFixed(0)} Mi`
}

function computeMetricPcts(
  metric: NodeMetric,
  allocatable: Record<string, string>,
): { cpuPct: number; memPct: number; cpuLabel: string; memLabel: string } {
  const cpuNano = parseCpuNanocores(metric.cpuUsage)
  const cpuAllocNano = parseAllocatableCpuToNanocores(allocatable.cpu ?? "0")
  const cpuPct = cpuAllocNano > 0 ? (cpuNano / cpuAllocNano) * 100 : 0

  const memBytes = parseMemoryToBytes(metric.memoryUsage)
  const memAllocBytes = parseMemoryToBytes(allocatable.memory ?? "0")
  const memPct = memAllocBytes > 0 ? (memBytes / memAllocBytes) * 100 : 0

  const cpuCores = cpuNano / 1e9
  const cpuAllocCores = cpuAllocNano / 1e9
  const cpuLabel = `${cpuCores.toFixed(2)} / ${cpuAllocCores.toFixed(2)} cores`

  const memLabel = `${formatMemory(memBytes)} / ${formatMemory(memAllocBytes)}`

  return { cpuPct, memPct, cpuLabel, memLabel }
}

function ProgressBar({
  value,
  label,
}: {
  value: number
  label: string
}): JSX.Element {
  const pct = Math.min(100, Math.max(0, value))
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-blue-500"
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ResourceUsageSection({
  node,
  metric,
  unavailable,
}: {
  node: K8sNode
  metric: NodeMetric | undefined
  unavailable: boolean
}): JSX.Element {
  if (unavailable) {
    return (
      <div className="space-y-1">
        <SectionHeader title="Resource Usage" />
        <p className="text-xs text-muted-foreground">Metrics unavailable</p>
      </div>
    )
  }

  if (!metric) {
    return (
      <div className="space-y-1">
        <SectionHeader title="Resource Usage" />
        <p className="text-xs text-muted-foreground">Loading metrics…</p>
      </div>
    )
  }

  const { cpuPct, memPct, cpuLabel, memLabel } = computeMetricPcts(
    metric,
    node.allocatable,
  )

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
        Resource Usage
      </h3>
      <div className="space-y-0.5">
        <p className="text-xs font-medium">CPU</p>
        <ProgressBar value={cpuPct} label={cpuLabel} />
      </div>
      <div className="space-y-0.5">
        <p className="text-xs font-medium">Memory</p>
        <ProgressBar value={memPct} label={memLabel} />
      </div>
    </div>
  )
}

function DetailPanel({
  node,
  metric,
  metricsUnavailable,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  node: K8sNode
  metric: NodeMetric | undefined
  metricsUnavailable: boolean
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(node.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(node.annotations ?? {})
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))
  const capacityEntries = Object.entries(node.capacity).filter(([k, v]) =>
    kv(k, v),
  )
  const allocatableEntries = Object.entries(node.allocatable).filter(([k, v]) =>
    kv(k, v),
  )

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1">{node.name}</h2>
              <span
                className={cn(
                  "inline-block rounded px-2 py-0.5 text-xs font-medium",
                  node.status === "Ready"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800",
                )}
              >
                {node.status}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="Node"
                resourceName={node.name}
                buildYaml={() => ({
                  apiVersion: "v1",
                  kind: "Node",
                  metadata: {
                    name: node.name,
                    labels: node.labels,
                    ...(Object.keys(node.annotations ?? {}).length > 0 && {
                      annotations: node.annotations,
                    }),
                  },
                  spec: {
                    ...(node.taints.length > 0 && {
                      taints: node.taints.map((t) => ({
                        key: t.key,
                        value: t.value,
                        effect: t.effect,
                      })),
                    }),
                  },
                })}
              />
              <DeleteButton
                resourceKind="Node"
                resourceName={node.name}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
                warning="Removes the node from the cluster. Drain it first — running pods are not evicted gracefully."
              />
              <CopyResourceButton name={node.name} resourceKind="node" />
              <ClosePanelButton onClose={onClose} />
            </div>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
          />
        </>
      }
    >
      <ResourceUsageSection
        node={node}
        metric={metric}
        unavailable={metricsUnavailable}
      />

      {/* Metadata */}
      <div className="space-y-1">
        <SectionHeader title="Metadata" />
        <MetaEntry
          label="Created"
          value={new Date(node.creationTimestamp).toLocaleString()}
        />
        <MetaEntry label="Roles" value={node.roles} />
        <MetaEntry label="Version" value={node.version} />
      </div>

      {/* Addresses */}
      {node.addresses.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Addresses" />
          {node.addresses
            .filter((a) => m(a.type) || m(a.address))
            .map((a, i) => (
              <MetaEntry key={i} label={a.type} value={a.address} mono />
            ))}
        </div>
      )}

      {/* System Info */}
      {node.systemInfo && (
        <div className="space-y-1">
          <SectionHeader title="System Info" />
          {node.systemInfo.osImage && m(node.systemInfo.osImage) && (
            <MetaEntry label="OS Image" value={node.systemInfo.osImage} />
          )}
          {node.systemInfo.operatingSystem &&
            m(node.systemInfo.operatingSystem) && (
              <MetaEntry label="OS" value={node.systemInfo.operatingSystem} />
            )}
          {node.systemInfo.architecture && m(node.systemInfo.architecture) && (
            <MetaEntry
              label="Architecture"
              value={node.systemInfo.architecture}
            />
          )}
          {node.systemInfo.containerRuntimeVersion &&
            m(node.systemInfo.containerRuntimeVersion) && (
              <MetaEntry
                label="Container Runtime"
                value={node.systemInfo.containerRuntimeVersion}
              />
            )}
          {node.systemInfo.kubeletVersion &&
            m(node.systemInfo.kubeletVersion) && (
              <MetaEntry
                label="Kubelet"
                value={node.systemInfo.kubeletVersion}
              />
            )}
          {node.systemInfo.kubeProxyVersion &&
            m(node.systemInfo.kubeProxyVersion) && (
              <MetaEntry
                label="Kube-Proxy"
                value={node.systemInfo.kubeProxyVersion}
              />
            )}
        </div>
      )}

      {/* Taints */}
      {node.taints.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Taints" />
          {node.taints
            .filter((t) => m(t.key) || m(t.effect) || m(t.value))
            .map((t, i) => (
              <div key={i} className="text-xs border rounded p-2 space-y-0.5">
                <div className="font-medium font-mono">{t.key}</div>
                <div className="text-muted-foreground">
                  {t.value ? `${t.value}:` : ""}
                  {t.effect}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Capacity */}
      {capacityEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Capacity" />
          {capacityEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Allocatable */}
      {allocatableEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Allocatable" />
          {allocatableEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Conditions */}
      {node.conditions.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Conditions" />
          {node.conditions
            .filter((c) => m(c.type) || m(c.reason) || m(c.message))
            .map((c) => (
              <div
                key={c.type}
                className="text-sm space-y-0.5 border rounded p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.type}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs",
                      c.status === "True"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800",
                    )}
                  >
                    {c.status}
                  </span>
                </div>
                {c.reason && (
                  <div className="text-xs text-muted-foreground">
                    {c.reason}
                  </div>
                )}
                {c.message && (
                  <div className="text-xs text-muted-foreground">
                    {c.message}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Labels */}
      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          {labelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Annotations */}
      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Events — nodes are cluster-scoped, pass empty namespace */}
      <ResourceEventsSection
        namespace=""
        name={node.name}
        kind="Node"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function NodesView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sNode | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const refreshInterval = useAppStore((s) => s.refreshInterval)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: nodes,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listNodes({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  const [metricsMap, setMetricsMap] = useState<Map<string, NodeMetric>>(
    new Map(),
  )
  const [metricsUnavailable, setMetricsUnavailable] = useState(false)
  const selectedContextRef = useRef(selectedContext)
  selectedContextRef.current = selectedContext

  const fetchMetrics = useCallback(async () => {
    try {
      const result = await window.api.k8s.getNodeMetrics({
        contextName: selectedContextRef.current ?? undefined,
      })
      if ("unavailable" in result) {
        setMetricsUnavailable(true)
        return
      }
      setMetricsMap(new Map(result.map((m) => [m.nodeName, m])))
      setMetricsUnavailable(false)
    } catch {
      // silently fail — metrics are optional
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
  }, [selectedContext, fetchMetrics])

  useEffect(() => {
    if (refreshInterval === "off") return
    const ms = (refreshInterval as number) * 1000
    const id = setInterval(fetchMetrics, ms)
    return () => clearInterval(id)
  }, [refreshInterval, fetchMetrics])

  useEffect(() => {
    if (!selectedItem || nodes.length === 0) return
    const item = selectedItem as { name: string }
    const fresh = nodes.find((n) => n.name === item.name)
    if (fresh) setSelectedItem(fresh as object)
  }, [nodes])

  const visibleNodes = filterResources(nodes, nameFilter)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Nodes</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleNodes.length === 0 && (
          <EmptyState message="No Nodes found" />
        )}
        {!loading && !error && visibleNodes.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Roles</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                  <TableHead className="whitespace-nowrap">Version</TableHead>
                  <TableHead className="whitespace-nowrap">CPU%</TableHead>
                  <TableHead className="whitespace-nowrap">Mem%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleNodes.map((node) => {
                  const metric = metricsMap.get(node.name)
                  let cpuPct: number | null = null
                  let memPct: number | null = null
                  if (metric && !metricsUnavailable) {
                    const pcts = computeMetricPcts(metric, node.allocatable)
                    cpuPct = pcts.cpuPct
                    memPct = pcts.memPct
                  }
                  return (
                    <TableRow
                      key={node.name}
                      className={cn(
                        "cursor-pointer",
                        selectedItem?.name === node.name && "bg-muted",
                      )}
                      onClick={() =>
                        setSelectedItem(
                          selectedItem?.name === node.name ? null : node,
                        )
                      }
                    >
                      <TableCell className="whitespace-nowrap">
                        {node.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {node.status}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {node.roles}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatAge(node.creationTimestamp)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {node.version}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {cpuPct !== null ? `${cpuPct.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {memPct !== null ? `${memPct.toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && (
        <DetailPanel
          node={selectedItem}
          metric={metricsMap.get(selectedItem.name)}
          metricsUnavailable={metricsUnavailable}
          onClose={() => setSelectedItem(null)}
          onDeleted={reload}
          onDeleteDialogChange={setDeleteDialogOpen}
        />
      )}
    </div>
  )
}
