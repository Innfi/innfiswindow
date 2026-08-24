import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  formatMemory,
  parseCpuToNanocores,
  parseMemoryToBytes,
} from "../../../shared/quantity"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/AlertDialog"
import { Button } from "../../components/ui/Button"
import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DeleteButton } from "../../components/ui/DeleteButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { EditButton } from "../../components/ui/EditButton"
import { EmptyState } from "../../components/ui/EmptyState"
import { Input } from "../../components/ui/Input"
import { Label } from "../../components/ui/Label"
import { MetaEntry } from "../../components/ui/MetaEntry"
import { NodeLabelsButton } from "../../components/ui/NodeLabelsButton"
import { NodeTaintsButton } from "../../components/ui/NodeTaintsButton"
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
import { useRecordHistory } from "../hooks/useRecordHistory"
import { K8sNode } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

interface NodeMetric {
  nodeName: string
  cpuUsage: string
  memoryUsage: string
}

/** Drain's seconds-valued inputs. Blank or nonsense becomes undefined so the
 *  handler falls back to its own default rather than receiving a NaN. */
function positiveSeconds(value: string): number | undefined {
  if (value.trim() === "") return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function computeMetricPcts(
  metric: NodeMetric,
  allocatable: Record<string, string>,
): { cpuPct: number; memPct: number; cpuLabel: string; memLabel: string } {
  const cpuNano = parseCpuToNanocores(metric.cpuUsage)
  const cpuAllocNano = parseCpuToNanocores(allocatable.cpu ?? "0")
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
  onChanged,
  onDeleted,
  onDialogChange,
}: {
  node: K8sNode
  metric: NodeMetric | undefined
  metricsUnavailable: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
  /** Pauses list polling while any dialog in the panel is open. */
  onDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [cordonOpen, setCordonOpen] = useState(false)
  const [cordoning, setCordoning] = useState(false)
  const [drainOpen, setDrainOpen] = useState(false)
  const [draining, setDraining] = useState(false)
  const [drainForce, setDrainForce] = useState(false)
  const [drainIgnoreDaemonSets, setDrainIgnoreDaemonSets] = useState(true)
  const [drainEmptyDirData, setDrainEmptyDirData] = useState(false)
  // Blank grace period means "use each pod's own terminationGracePeriodSeconds".
  const [drainGracePeriod, setDrainGracePeriod] = useState("")
  const [drainTimeout, setDrainTimeout] = useState("300")

  async function handleCordon(): Promise<void> {
    const schedulable = node.unschedulable // toggling back to schedulable
    const target = {
      action: schedulable ? "uncordon" : "cordon",
      resourceKind: "Node",
      resourceName: node.name,
      namespace: "",
    } as const
    setCordoning(true)
    try {
      await window.api.k8s.cordonNode({
        contextName: selectedContext ?? undefined,
        name: node.name,
        schedulable,
      })
      recordHistory(target, { success: true })
      toast.success(
        schedulable ? `Uncordoned ${node.name}` : `Cordoned ${node.name}`,
      )
      setCordonOpen(false)
      onChanged()
    } catch (e) {
      recordHistory(target, { success: false, error: String(e) })
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "Node: cordon")
      setCordonOpen(false)
    } finally {
      setCordoning(false)
    }
  }

  async function handleDrain(): Promise<void> {
    const target = {
      action: "drain",
      resourceKind: "Node",
      resourceName: node.name,
      namespace: "",
    } as const
    setDraining(true)
    try {
      const result = await window.api.k8s.drainNode({
        contextName: selectedContext ?? undefined,
        name: node.name,
        options: {
          force: drainForce,
          ignoreDaemonSets: drainIgnoreDaemonSets,
          deleteEmptyDirData: drainEmptyDirData,
          gracePeriodSeconds: positiveSeconds(drainGracePeriod),
          timeoutSeconds: positiveSeconds(drainTimeout),
        },
      })
      // A drain fails three different ways — refused up front, an eviction
      // rejected, or pods that never terminated — and each needs its own
      // message, since "drain failed" alone doesn't tell you what to change.
      const problem =
        result.error ??
        (result.failed.length > 0
          ? `${result.failed.length} pod(s) could not be evicted — ${result.failed
              .map((f) => `${f.pod}: ${f.error}`)
              .join("; ")}`
          : result.timedOut
            ? `evictions issued, but ${result.pending.length} pod(s) were still running at the timeout: ${result.pending.join(", ")}`
            : undefined)

      recordHistory(target, { success: result.success, error: problem })
      if (result.success) {
        toast.success(
          `Drained ${node.name}: evicted ${result.evicted}, skipped ${result.skipped.length}`,
        )
      } else {
        const message = problem ?? "Drain did not complete"
        toast.error(`Drain ${node.name}: ${message}`)
        useAppStore.getState().addGlobalError(message, "Node: drain")
      }
      setDrainOpen(false)
      onChanged()
    } catch (e) {
      recordHistory(target, { success: false, error: String(e) })
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "Node: drain")
      setDrainOpen(false)
    } finally {
      setDraining(false)
    }
  }

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
              {node.unschedulable && (
                <span className="ml-1 inline-block rounded px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">
                  SchedulingDisabled
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setCordonOpen(true)}
              >
                {node.unschedulable ? "Uncordon" : "Cordon"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setDrainOpen(true)}
              >
                Drain
              </Button>
              <NodeLabelsButton
                nodeName={node.name}
                labels={node.labels}
                onUpdated={onChanged}
                onDialogChange={onDialogChange}
              />
              <NodeTaintsButton
                nodeName={node.name}
                taints={node.taints}
                onUpdated={onChanged}
                onDialogChange={onDialogChange}
              />
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
                onDeleteDialogChange={onDialogChange}
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

      <AlertDialog open={cordonOpen} onOpenChange={setCordonOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {node.unschedulable ? "Uncordon Node" : "Cordon Node"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {node.unschedulable ? (
                <>
                  Mark <span className="font-medium">{node.name}</span>{" "}
                  schedulable again so new pods can land on it.
                </>
              ) : (
                <>
                  Mark <span className="font-medium">{node.name}</span>{" "}
                  unschedulable. Existing pods keep running; no new pods will be
                  scheduled here.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setCordonOpen(false)}
              disabled={cordoning}
            >
              Cancel
            </Button>
            <Button onClick={handleCordon} disabled={cordoning}>
              {cordoning
                ? "Working…"
                : node.unschedulable
                  ? "Uncordon"
                  : "Cordon"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={drainOpen} onOpenChange={setDrainOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drain Node</AlertDialogTitle>
            <AlertDialogDescription>
              Cordon <span className="font-medium">{node.name}</span> and evict
              its pods (honouring PodDisruptionBudgets), then wait for them to
              terminate. Static pods are always left in place. The drain is
              refused up front if it finds a pod the options below don&apos;t
              cover.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={drainIgnoreDaemonSets}
                onChange={(e) => setDrainIgnoreDaemonSets(e.target.checked)}
                disabled={draining}
              />
              <span>
                Ignore DaemonSets
                <span className="block text-xs text-muted-foreground">
                  Leave DaemonSet pods running instead of refusing the drain.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={drainForce}
                onChange={(e) => setDrainForce(e.target.checked)}
                disabled={draining}
              />
              <span>
                Force
                <span className="block text-xs text-muted-foreground">
                  Evict pods no controller owns. Nothing will recreate them.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={drainEmptyDirData}
                onChange={(e) => setDrainEmptyDirData(e.target.checked)}
                disabled={draining}
              />
              <span>
                Delete emptyDir data
                <span className="block text-xs text-muted-foreground">
                  Evict pods with emptyDir volumes, discarding their contents.
                </span>
              </span>
            </label>

            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="drain-grace-period" className="text-xs">
                  Grace period (s)
                </Label>
                <Input
                  id="drain-grace-period"
                  type="number"
                  min={0}
                  placeholder="pod default"
                  value={drainGracePeriod}
                  onChange={(e) => setDrainGracePeriod(e.target.value)}
                  disabled={draining}
                  className="h-8"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="drain-timeout" className="text-xs">
                  Timeout (s)
                </Label>
                <Input
                  id="drain-timeout"
                  type="number"
                  min={0}
                  value={drainTimeout}
                  onChange={(e) => setDrainTimeout(e.target.value)}
                  disabled={draining}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setDrainOpen(false)}
              disabled={draining}
            >
              Cancel
            </Button>
            <Button onClick={handleDrain} disabled={draining}>
              {draining ? "Draining…" : "Drain"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailPanelLayout>
  )
}

export function NodesView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sNode | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const refreshInterval = useAppStore((s) => s.refreshInterval)

  // Any write dialog in the detail panel pauses the poll, so an edit in
  // progress is not overwritten by a refreshed node.
  const [dialogOpen, setDialogOpen] = useState(false)

  const {
    data: nodes,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listNodes({ contextName: ctx }),
    selectedContext,
    { paused: dialogOpen },
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
          onChanged={reload}
          onDeleted={reload}
          onDialogChange={setDialogOpen}
        />
      )}
    </div>
  )
}
