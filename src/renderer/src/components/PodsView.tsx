import { ArrowLeftRight, ScrollText, SquareTerminal } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/Button"
import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/Dialog"
import { EditButton } from "../../components/ui/EditButton"
import { MetaEntry } from "../../components/ui/MetaEntry"
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useRecordHistory } from "../hooks/useRecordHistory"
import { K8sPod } from "../types/k8s"
import { ContainerCard } from "./ContainerCard"
import { PodMetricsSection } from "./PodMetricsSection"
import { ResourceEventsSection } from "./ResourceEventsSection"

const WORKLOAD_KIND_CLASS: Record<string, string> = {
  Deployment:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  StatefulSet:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  DaemonSet:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Job: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  CronJob:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  ReplicaSet:
    "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
}

// Grouping order for the "Workload type" sort. Kinds not listed sort last.
const WORKLOAD_KIND_ORDER = [
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "ReplicaSet",
  "Job",
  "CronJob",
]

function kindRank(kind: string): number {
  const i = WORKLOAD_KIND_ORDER.indexOf(kind)
  return i === -1 ? WORKLOAD_KIND_ORDER.length : i
}

// Row tint for resources that aren't fully healthy.
const UNHEALTHY_ROW = "bg-red-50 dark:bg-red-950/30"

// A pod is healthy while Running or once it has Succeeded/Completed. Any other
// phase (Pending, Failed, Unknown, CrashLoopBackOff, …) flags the row.
function isPodHealthy(status: string): boolean {
  return (
    status === "Running" || status === "Succeeded" || status === "Completed"
  )
}

function WorkloadBadge({
  kind,
  name,
}: {
  kind: string
  name: string
}): JSX.Element {
  if (!kind) return <span className="text-muted-foreground">-</span>
  const cls = WORKLOAD_KIND_CLASS[kind] ?? "bg-muted text-muted-foreground"
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{kind}</span>
      <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", cls)}>
        {name}
      </span>
    </span>
  )
}

function DetailPanel({
  pod,
  onClose,
  onLogs,
  onShell,
  onPortForward,
  onDeleteSuccess,
  onDeleteDialogChange,
}: {
  pod: K8sPod
  onClose: () => void
  onLogs: () => void
  onShell: (containerName: string) => void
  onPortForward: () => void
  onDeleteSuccess: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const recordHistory = useRecordHistory()
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()
  const [selectedContainer, setSelectedContainer] = useState(
    pod.containers[0]?.name ?? "",
  )
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(pod.labels ?? {}).filter(([k, v]) =>
    kv(k, v),
  )
  const annotationEntries = Object.entries(pod.annotations ?? {})
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  async function handleDelete(): Promise<void> {
    const target = {
      action: "delete",
      resourceKind: "Pod",
      resourceName: pod.name,
      namespace: pod.namespace,
    } as const
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deletePod(pod.namespace, pod.name)
      recordHistory(target, { success: true })
      toast.success(`Pod ${pod.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleteSuccess()
      onClose()
    } catch (e) {
      recordHistory(target, { success: false, error: String(e) })
      setDeleteError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DetailPanelLayout>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{pod.name}</h2>
          <span className="text-xs text-muted-foreground">{pod.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="Pod"
            resourceName={pod.name}
            namespace={pod.namespace}
            buildYaml={() => ({
              apiVersion: "v1",
              kind: "Pod",
              metadata: { name: pod.name, namespace: pod.namespace },
              spec: {
                containers: pod.containers.map((c) => ({
                  name: c.name,
                  image: c.image,
                })),
              },
            })}
          />
          <Button variant="ghost" size="icon" title="Logs" onClick={onLogs}>
            <ScrollText className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Shell"
            onClick={() => onShell(selectedContainer)}
          >
            <SquareTerminal className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Port Forward"
            onClick={onPortForward}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            onClick={() => setDeleteOpenNotify(true)}
          >
            Delete
          </Button>
          <CopyResourceButton
            name={pod.name}
            namespace={pod.namespace}
            resourceKind="pod"
          />
          <ClosePanelButton onClose={onClose} className="ml-1" />
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
      />

      {/* Shell container selector */}
      {pod.containers.length > 1 && (
        <div className="space-y-1">
          <SectionHeader title="Shell Container" />
          <select
            value={selectedContainer}
            onChange={(e) => setSelectedContainer(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
          >
            {pod.containers.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Info */}
      <div className="space-y-1">
        <SectionHeader title="Info" />
        <MetaEntry label="Status" value={pod.status} />
        <MetaEntry label="Node" value={pod.nodeName || "-"} />
        {pod.ownerKind ? (
          <MetaEntry label={pod.ownerKind} value={pod.ownerName} />
        ) : (
          <MetaEntry label="Workload" value="-" />
        )}
        <MetaEntry label="App" value={pod.app || "-"} />
        <MetaEntry label="Restarts" value={String(pod.restarts)} />
        {pod.serviceAccountName && m(pod.serviceAccountName) && (
          <MetaEntry label="Service Account" value={pod.serviceAccountName} />
        )}
        {pod.qosClass && m(pod.qosClass) && (
          <MetaEntry label="QoS Class" value={pod.qosClass} />
        )}
        <MetaEntry
          label="Created"
          value={new Date(pod.creationTimestamp).toLocaleString()}
        />
      </div>

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

      {/* Init Containers */}
      {pod.initContainers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Init Containers" />
          {pod.initContainers
            .filter((c) => m(c.name) || m(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Containers */}
      {pod.containers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Containers" />
          {pod.containers
            .filter((c) => m(c.name) || m(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Volumes */}
      {pod.volumes.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Volumes" />
          {pod.volumes
            .filter((v) => m(v.name) || m(v.type) || m(v.detail))
            .map((v) => (
              <div
                key={v.name}
                className="text-xs border rounded p-2 space-y-0.5"
              >
                <div className="font-medium">{v.name}</div>
                <div className="text-muted-foreground">
                  {v.type}
                  {v.detail ? `: ${v.detail}` : ""}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Conditions */}
      {pod.conditions.filter((c) => m(c.type)).length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Conditions" />
          {pod.conditions
            .filter((c) => m(c.type))
            .map((c) => (
              <div
                key={c.type}
                className="text-sm space-y-0.5 border rounded p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.type}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs font-medium",
                      c.status === "True"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
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
              </div>
            ))}
        </div>
      )}

      {/* Events */}
      <ResourceEventsSection
        namespace={pod.namespace}
        name={pod.name}
        kind="Pod"
        search={sl}
      />

      <PodMetricsSection namespace={pod.namespace} podName={pod.name} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpenNotify}>
        <DialogContent onClose={() => setDeleteOpenNotify(false)}>
          <DialogHeader>
            <DialogTitle>Delete Pod</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {pod.namespace}/{pod.name}
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpenNotify(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DetailPanelLayout>
  )
}

export function PodsView(): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)

  return (
    <ResourceListView<K8sPod>
      title="Pods"
      list={(ctx) => window.api.k8s.listPods({ contextName: ctx })}
      detailGuard={(item) => (item as K8sPod).containers !== undefined}
      rowClassName={(p) => (isPodHealthy(p.status) ? undefined : UNHEALTHY_ROW)}
      sortOptions={[
        { label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
        {
          label: "Workload type",
          compare: (a, b) =>
            kindRank(a.ownerKind) - kindRank(b.ownerKind) ||
            a.ownerKind.localeCompare(b.ownerKind) ||
            a.name.localeCompare(b.name),
        },
        {
          label: "Status",
          compare: (a, b) => a.status.localeCompare(b.status),
        },
      ]}
      columns={[
        { head: "Name", cell: (p) => p.name },
        { head: "Namespace", cell: (p) => p.namespace },
        {
          head: "Workload",
          cell: (p) => <WorkloadBadge kind={p.ownerKind} name={p.ownerName} />,
        },
        { head: "App", cell: (p) => p.app || "-" },
        { head: "Status", cell: (p) => p.status },
        { head: "Restarts", cell: (p) => p.restarts },
        ageColumn<K8sPod>(),
      ]}
      renderDetail={(pod, ctl: DetailController) => (
        <DetailPanel
          pod={pod}
          onClose={ctl.onClose}
          onLogs={() =>
            openDrawerTab({
              tabKey: `pod-log:${pod.namespace}/${pod.name}`,
              type: "pod-log",
              namespace: pod.namespace,
              podName: pod.name,
              containers: pod.containers,
            })
          }
          onShell={(containerName) => {
            const sessionId = crypto.randomUUID()
            openDrawerTab({
              tabKey: `pod-shell:${sessionId}`,
              type: "pod-shell",
              sessionId,
              namespace: pod.namespace,
              podName: pod.name,
              containerName,
            })
          }}
          onPortForward={() => {
            openDrawerTab({
              tabKey: `port-forward:Pod:${pod.namespace}/${pod.name}`,
              type: "port-forward",
              resourceKind: "Pod",
              resourceName: pod.name,
              namespace: pod.namespace,
              localPort: 8080,
              targetPort: 8080,
            })
          }}
          onDeleteSuccess={() => {
            ctl.onClose()
            ctl.onDeleted()
          }}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
