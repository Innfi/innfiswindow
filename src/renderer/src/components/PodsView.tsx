import { ArrowLeftRight, ScrollText, SquareTerminal, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
import { EmptyState } from "../../components/ui/EmptyState"
import { RefreshBar } from "../../components/ui/RefreshBar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { cn, filterResources, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sPod } from "../types/k8s"
import { ContainerCard } from "./ContainerCard"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { PodMetricsSection } from "./PodMetricsSection"
import { ResourceEventsSection } from "./ResourceEventsSection"

function SectionHeader({ title }: { title: string }): JSX.Element {
  return (
    <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
      {title}
    </h3>
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
  const selectedContext = useAppStore((s) => s.selectedContext)
  const appendHistory = useAppStore((s) => s.appendHistory)
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
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deletePod(pod.namespace, pod.name)
      appendHistory({
        action: "delete",
        resourceKind: "Pod",
        resourceName: pod.name,
        namespace: pod.namespace,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`Pod ${pod.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleteSuccess()
      onClose()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "Pod",
        resourceName: pod.name,
        namespace: pod.namespace,
        context: selectedContext ?? "",
        success: false,
        error: String(e),
      })
      setDeleteError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
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
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-1"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
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
        <MetaEntry label="Deployment" value={pod.deployment || "-"} />
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
    </div>
  )
}

export function PodsView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sPod | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: pods,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listPods({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || pods.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = pods.find(
      (p) => p.name === item.name && p.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [pods])

  const visiblePods = filterResources(pods, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Pods</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visiblePods.length === 0 && (
          <EmptyState message="No Pods found" />
        )}
        {!loading && !error && visiblePods.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Deployment
                  </TableHead>
                  <TableHead className="whitespace-nowrap">App</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Restarts</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePods.map((p) => (
                  <TableRow
                    key={`${p.namespace}/${p.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === p.name &&
                        selectedItem?.namespace === p.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === p.name &&
                          selectedItem?.namespace === p.namespace
                          ? null
                          : p,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {p.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.deployment || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.app || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.status}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.restarts}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(p.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.containers !== undefined && (
        <DetailPanel
          pod={selectedItem}
          onClose={() => setSelectedItem(null)}
          onLogs={() =>
            openDrawerTab({
              tabKey: `pod-log:${selectedItem.namespace}/${selectedItem.name}`,
              type: "pod-log",
              namespace: selectedItem.namespace,
              podName: selectedItem.name,
              containers: selectedItem.containers,
            })
          }
          onShell={(containerName) => {
            const sessionId = crypto.randomUUID()
            openDrawerTab({
              tabKey: `pod-shell:${sessionId}`,
              type: "pod-shell",
              sessionId,
              namespace: selectedItem.namespace,
              podName: selectedItem.name,
              containerName,
            })
          }}
          onPortForward={() => {
            openDrawerTab({
              tabKey: `port-forward:Pod:${selectedItem.namespace}/${selectedItem.name}`,
              type: "port-forward",
              resourceKind: "Pod",
              resourceName: selectedItem.name,
              namespace: selectedItem.namespace,
              localPort: 8080,
              targetPort: 8080,
            })
          }}
          onDeleteSuccess={() => {
            setSelectedItem(null)
            reload()
          }}
          onDeleteDialogChange={setDeleteDialogOpen}
        />
      )}
    </div>
  )
}
