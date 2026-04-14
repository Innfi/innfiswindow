import { Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"

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
import { handleIpcError } from "../../lib/ipc-error"
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { MetaEntry } from "./MetaEntry"

interface K8sStatefulSetContainer {
  name: string
  image: string
}

interface K8sStatefulSetVolumeClaimTemplate {
  name: string
  storage: string
}

interface K8sStatefulSet {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  creationTimestamp: string
  serviceName: string
  updateStrategy: string
  selector: Record<string, string>
  containers: K8sStatefulSetContainer[]
  volumeClaimTemplates: K8sStatefulSetVolumeClaimTemplate[]
}

function DetailPanel({
  ss,
  onClose,
}: {
  ss: K8sStatefulSet
  onClose: () => void
}): JSX.Element {
  const selectorEntries = Object.entries(ss.selector)

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{ss.name}</h2>
          <span className="text-xs text-muted-foreground">{ss.namespace}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
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
    </div>
  )
}

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  statefulSet: K8sStatefulSet | null
  onDeleted: () => void
}

function DeleteDialog({
  open,
  onOpenChange,
  statefulSet,
  onDeleted,
}: DeleteDialogProps): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  async function handleDelete(): Promise<void> {
    if (!statefulSet) return
    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.deleteStatefulSet(
        statefulSet.namespace,
        statefulSet.name,
      )
      onDeleted()
      onOpenChange(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Delete StatefulSet</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>
              {statefulSet
                ? `${statefulSet.namespace}/${statefulSet.name}`
                : ""}
            </strong>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={submitting}
          >
            {submitting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StatefulSetsView(): JSX.Element {
  const [statefulSets, setStatefulSets] = useState<K8sStatefulSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<K8sStatefulSet | null>(null)

  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sStatefulSet | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)

  const visibleStatefulSets = selectedNamespace
    ? statefulSets.filter((ss) => ss.namespace === selectedNamespace)
    : statefulSets

  function fetchStatefulSets(): void {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listStatefulSets()
      .then((data) => {
        setStatefulSets(data)
        setLoading(false)
      })
      .catch((err) => {
        handleIpcError(err, "StatefulSets")
        setError(String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchStatefulSets()
  }, [])

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
                <TableHead></TableHead>
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
                  <TableCell>
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(ss)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.serviceName !== undefined && (
        <DetailPanel ss={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      <DeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        statefulSet={deleteTarget}
        onDeleted={() => {
          fetchStatefulSets()
          setSelectedItem(null)
        }}
      />
    </div>
  )
}
