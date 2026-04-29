import { ScrollText, SquareTerminal, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
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
import { MetaEntry } from "./MetaEntry"
import { PodMetricsSection } from "./PodMetricsSection"

interface K8sPodContainer {
  name: string
  image: string
  restartCount: number
}

interface K8sPodCondition {
  type: string
  status: string
  reason: string
  message: string
}

interface K8sPod {
  name: string
  namespace: string
  deployment: string
  app: string
  status: string
  restarts: number
  creationTimestamp: string
  nodeName: string
  containers: K8sPodContainer[]
  conditions: K8sPodCondition[]
}

function DetailPanel({
  pod,
  onClose,
  onLogs,
  onShell,
  onDeleteSuccess,
}: {
  pod: K8sPod
  onClose: () => void
  onLogs: () => void
  onShell: (containerName: string) => void
  onDeleteSuccess: () => void
}): JSX.Element {
  const [selectedContainer, setSelectedContainer] = useState(
    pod.containers[0]?.name ?? "",
  )
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deletePod(pod.namespace, pod.name)
      toast.success(`Pod ${pod.name} deleted`)
      setDeleteOpen(false)
      onDeleteSuccess()
      onClose()
    } catch (e) {
      setDeleteError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{pod.name}</h2>
          <span className="text-xs text-muted-foreground">{pod.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
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
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-1"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {pod.containers.length > 1 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Shell Container
          </h3>
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

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Info
        </h3>
        <MetaEntry label="Status" value={pod.status} />
        <MetaEntry label="Node" value={pod.nodeName || "-"} />
        <MetaEntry label="Deployment" value={pod.deployment || "-"} />
        <MetaEntry label="App" value={pod.app || "-"} />
        <MetaEntry label="Restarts" value={String(pod.restarts)} />
        <MetaEntry
          label="Created"
          value={new Date(pod.creationTimestamp).toLocaleString()}
        />
      </div>

      {pod.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {pod.containers.map((c) => (
            <div
              key={c.name}
              className="text-sm border rounded p-2 space-y-0.5"
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground break-all">
                {c.image}
              </div>
              <div className="text-xs text-muted-foreground">
                Restarts: {c.restartCount}
              </div>
            </div>
          ))}
        </div>
      )}

      {pod.conditions.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Conditions
          </h3>
          {pod.conditions.map((c) => (
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
                <div className="text-xs text-muted-foreground">{c.reason}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <PodMetricsSection namespace={pod.namespace} podName={pod.name} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent onClose={() => setDeleteOpen(false)}>
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
              onClick={() => setDeleteOpen(false)}
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

  const {
    data: pods,
    loading,
    error,
    reload,
  } = useK8sResource(
    (ctx) => window.api.k8s.listPods({ contextName: ctx }),
    selectedContext,
  )

  const visiblePods = filterResources(pods, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4">
          <h1 className="text-lg font-semibold">Pods</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Deployment</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Restarts</TableHead>
                <TableHead>Age</TableHead>
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
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.namespace}</TableCell>
                  <TableCell>{p.deployment || "-"}</TableCell>
                  <TableCell>{p.app || "-"}</TableCell>
                  <TableCell>{p.status}</TableCell>
                  <TableCell>{p.restarts}</TableCell>
                  <TableCell>{formatAge(p.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.containers !== undefined && (
        <DetailPanel
          pod={selectedItem}
          onClose={() => setSelectedItem(null)}
          onLogs={() =>
            openDrawerTab({
              type: "pod-log",
              namespace: selectedItem.namespace,
              podName: selectedItem.name,
              containers: selectedItem.containers,
            })
          }
          onShell={(containerName) =>
            openDrawerTab({
              type: "pod-shell",
              sessionId: crypto.randomUUID(),
              namespace: selectedItem.namespace,
              podName: selectedItem.name,
              containerName,
            })
          }
          onDeleteSuccess={() => {
            setSelectedItem(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
