import { dump as yamlDump } from "js-yaml"
import { X } from "lucide-react"
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
import { K8sStatefulSet } from "../types/k8s"
import { MetaEntry } from "./MetaEntry"

function DetailPanel({
  ss,
  onClose,
  onDeleted,
}: {
  ss: K8sStatefulSet
  onClose: () => void
  onDeleted: () => void
}): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const selectorEntries = Object.entries(ss.selector)

  function handleEdit(): void {
    const obj = {
      apiVersion: "apps/v1",
      kind: "StatefulSet",
      metadata: { name: ss.name, namespace: ss.namespace },
      spec: {
        replicas: ss.replicas,
        serviceName: ss.serviceName,
        selector: { matchLabels: ss.selector },
        updateStrategy: { type: ss.updateStrategy },
        template: {
          metadata: { labels: ss.selector },
          spec: {
            containers: ss.containers.map((c) => ({
              name: c.name,
              image: c.image,
            })),
          },
        },
      },
    }
    openDrawerTab({
      type: "yaml-edit",
      resourceKind: "StatefulSet",
      resourceName: ss.name,
      namespace: ss.namespace,
      initialYaml: yamlDump(obj),
    })
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deleteStatefulSet(ss.namespace, ss.name)
      toast.success(`StatefulSet ${ss.name} deleted`)
      setDeleteOpen(false)
      onDeleted()
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
          <h2 className="font-semibold text-base mb-1">{ss.name}</h2>
          <span className="text-xs text-muted-foreground">{ss.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={handleEdit}
          >
            Edit
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

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Replicas
        </h3>
        <MetaEntry label="Desired" value={String(ss.replicas)} />
        <MetaEntry label="Ready" value={String(ss.readyReplicas)} />
        <MetaEntry
          label="Created"
          value={new Date(ss.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Configuration
        </h3>
        <MetaEntry label="Service Name" value={ss.serviceName} />
        <MetaEntry label="Update Strategy" value={ss.updateStrategy} />
      </div>

      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Selector Labels
          </h3>
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {ss.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {ss.containers.map((c) => (
            <div
              key={c.name}
              className="text-sm border rounded p-2 space-y-0.5"
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground break-all">
                {c.image}
              </div>
            </div>
          ))}
        </div>
      )}

      {ss.volumeClaimTemplates.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Volume Claim Templates
          </h3>
          {ss.volumeClaimTemplates.map((vct) => (
            <div
              key={vct.name}
              className="text-sm border rounded p-2 space-y-0.5"
            >
              <div className="font-medium">{vct.name}</div>
              <div className="text-xs text-muted-foreground">{vct.storage}</div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent onClose={() => setDeleteOpen(false)}>
          <DialogHeader>
            <DialogTitle>Delete StatefulSet</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {ss.namespace}/{ss.name}
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
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function StatefulSetsView(): JSX.Element {
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sStatefulSet | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: statefulSets,
    loading,
    error,
    reload,
  } = useK8sResource(
    (ctx) => window.api.k8s.listStatefulSets({ contextName: ctx }),
    selectedContext,
  )

  const visibleStatefulSets = filterResources(
    statefulSets,
    nameFilter,
    selectedNamespace,
  )

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">StatefulSets</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Service</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleStatefulSets.map((ss) => (
                <TableRow
                  key={`${ss.namespace}/${ss.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === ss.name &&
                      selectedItem?.namespace === ss.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === ss.name &&
                        selectedItem?.namespace === ss.namespace
                        ? null
                        : ss,
                    )
                  }
                >
                  <TableCell>{ss.name}</TableCell>
                  <TableCell>{ss.namespace}</TableCell>
                  <TableCell>
                    {ss.readyReplicas}/{ss.replicas}
                  </TableCell>
                  <TableCell>{formatAge(ss.creationTimestamp)}</TableCell>
                  <TableCell>{ss.serviceName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.serviceName !== undefined && (
        <DetailPanel
          ss={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleted={() => {
            reload()
            setSelectedItem(null)
          }}
        />
      )}
    </div>
  )
}
