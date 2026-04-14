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

interface K8sDaemonSetContainer {
  name: string
  image: string
}

interface K8sDaemonSetToleration {
  key: string
  operator: string
  value: string
  effect: string
}

interface K8sDaemonSet {
  name: string
  namespace: string
  desiredNumberScheduled: number
  currentNumberScheduled: number
  numberReady: number
  updatedNumberScheduled: number
  numberAvailable: number
  creationTimestamp: string
  updateStrategy: string
  selector: Record<string, string>
  nodeSelector: Record<string, string>
  containers: K8sDaemonSetContainer[]
  tolerations: K8sDaemonSetToleration[]
}

function DetailPanel({
  ds,
  onClose,
}: {
  ds: K8sDaemonSet
  onClose: () => void
}): JSX.Element {
  const selectorEntries = Object.entries(ds.selector)
  const nodeSelectorEntries = Object.entries(ds.nodeSelector)

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{ds.name}</h2>
          <span className="text-xs text-muted-foreground">{ds.namespace}</span>
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
          Scheduling
        </h3>
        <MetaEntry label="Desired" value={String(ds.desiredNumberScheduled)} />
        <MetaEntry label="Current" value={String(ds.currentNumberScheduled)} />
        <MetaEntry label="Ready" value={String(ds.numberReady)} />
        <MetaEntry
          label="Up-to-date"
          value={String(ds.updatedNumberScheduled)}
        />
        <MetaEntry label="Available" value={String(ds.numberAvailable)} />
        <MetaEntry
          label="Created"
          value={new Date(ds.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Update Strategy
        </h3>
        <MetaEntry label="Strategy" value={ds.updateStrategy} />
      </div>

      {nodeSelectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Node Selector
          </h3>
          {nodeSelectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

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

      {ds.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {ds.containers.map((c) => (
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

      {ds.tolerations.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Tolerations
          </h3>
          {ds.tolerations.map((t, i) => (
            <div key={i} className="text-sm border rounded p-2 space-y-0.5">
              {t.key && <div className="font-medium">{t.key}</div>}
              <div className="text-xs text-muted-foreground">
                {[t.operator, t.value, t.effect].filter(Boolean).join(" / ")}
              </div>
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
  daemonSet: K8sDaemonSet | null
  onDeleted: () => void
}

function DeleteDialog({
  open,
  onOpenChange,
  daemonSet,
  onDeleted,
}: DeleteDialogProps): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  async function handleDelete(): Promise<void> {
    if (!daemonSet) return
    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.deleteDaemonSet(daemonSet.namespace, daemonSet.name)
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
          <DialogTitle>Delete DaemonSet</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>
              {daemonSet ? `${daemonSet.namespace}/${daemonSet.name}` : ""}
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

export function DaemonSetsView(): JSX.Element {
  const [daemonSets, setDaemonSets] = useState<K8sDaemonSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<K8sDaemonSet | null>(null)

  const selectedItem = useAppStore((s) => s.selectedItem) as K8sDaemonSet | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)

  const visibleDaemonSets = selectedNamespace
    ? daemonSets.filter((ds) => ds.namespace === selectedNamespace)
    : daemonSets

  function fetchDaemonSets(): void {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listDaemonSets()
      .then((data) => {
        setDaemonSets(data)
        setLoading(false)
      })
      .catch((err) => {
        handleIpcError(err, "DaemonSets")
        setError(String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchDaemonSets()
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">DaemonSets</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Desired</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Up-to-date</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Age</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleDaemonSets.map((ds) => (
                <TableRow
                  key={`${ds.namespace}/${ds.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === ds.name &&
                      selectedItem?.namespace === ds.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === ds.name &&
                        selectedItem?.namespace === ds.namespace
                        ? null
                        : ds,
                    )
                  }
                >
                  <TableCell>{ds.name}</TableCell>
                  <TableCell>{ds.namespace}</TableCell>
                  <TableCell>{ds.desiredNumberScheduled}</TableCell>
                  <TableCell>{ds.currentNumberScheduled}</TableCell>
                  <TableCell>{ds.numberReady}</TableCell>
                  <TableCell>{ds.updatedNumberScheduled}</TableCell>
                  <TableCell>{ds.numberAvailable}</TableCell>
                  <TableCell>{formatAge(ds.creationTimestamp)}</TableCell>
                  <TableCell>
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(ds)}
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

      {selectedItem && selectedItem.desiredNumberScheduled !== undefined && (
        <DetailPanel ds={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      <DeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        daemonSet={deleteTarget}
        onDeleted={() => {
          fetchDaemonSets()
          setSelectedItem(null)
        }}
      />
    </div>
  )
}
