import { dump as yamlDump } from "js-yaml"
import { Pencil, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
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
import { K8sServiceAccount } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { RefreshBar } from "./RefreshBar"

function DetailPanel({
  sa,
  onClose,
  onDeleteSuccess,
  onDeleteDialogChange,
}: {
  sa: K8sServiceAccount
  onClose: () => void
  onDeleteSuccess: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const labelEntries = Object.entries(sa.labels)
  const annotationEntries = Object.entries(sa.annotations)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  function handleEdit(): void {
    openDrawerTab({
      tabKey: `edit-resource:ServiceAccount:${sa.namespace}/${sa.name}`,
      type: "edit-resource",
      resourceKind: "ServiceAccount",
      resourceName: sa.name,
      namespace: sa.namespace,
      initialYaml: yamlDump({ labels: sa.labels, annotations: sa.annotations }),
    })
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deleteServiceAccount(sa.namespace, sa.name)
      toast.success(`ServiceAccount ${sa.name} deleted`)
      setDeleteOpenNotify(false)
      setSelectedItem(null)
      onDeleteSuccess()
    } catch (e) {
      setDeleteError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="w-96 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{sa.name}</h2>
          <span className="text-xs text-muted-foreground">{sa.namespace}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleEdit}>
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpenNotify(true)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
          <CopyResourceButton name={sa.name} namespace={sa.namespace} resourceKind="serviceaccount" />
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpenNotify}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete ServiceAccount</DialogTitle>
            <DialogDescription>
              Delete service account <strong>{sa.name}</strong> in namespace{" "}
              <strong>{sa.namespace}</strong>? This cannot be undone.
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

      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Labels
          </h3>
          {labelEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">
                {k}:
              </span>
              <span className="break-all">{v}</span>
            </div>
          ))}
        </div>
      )}

      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Annotations
          </h3>
          {annotationEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">
                {k}:
              </span>
              <span className="break-all">{v}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Secrets ({sa.secrets.length})
        </h3>
        {sa.secrets.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          sa.secrets.map((s) => (
            <div key={s} className="text-sm font-mono">
              {s}
            </div>
          ))
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Image Pull Secrets ({sa.imagePullSecrets.length})
        </h3>
        {sa.imagePullSecrets.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          sa.imagePullSecrets.map((s) => (
            <div key={s} className="text-sm font-mono">
              {s}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function ServiceAccountsView(): JSX.Element {
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sServiceAccount | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: serviceAccounts,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listServiceAccounts({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || serviceAccounts.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = serviceAccounts.find(
      (s) => s.name === item.name && s.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [serviceAccounts])

  const visible = filterResources(
    serviceAccounts,
    nameFilter,
    selectedNamespace,
  )

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Service Accounts</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message="No Service Accounts found" />
        )}
        {!loading && !error && visible.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Secrets</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((sa) => (
                <TableRow
                  key={`${sa.namespace}/${sa.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === sa.name &&
                      selectedItem?.namespace === sa.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === sa.name &&
                        selectedItem?.namespace === sa.namespace
                        ? null
                        : sa,
                    )
                  }
                >
                  <TableCell>{sa.name}</TableCell>
                  <TableCell>{sa.namespace}</TableCell>
                  <TableCell>{sa.secrets.length}</TableCell>
                  <TableCell>{formatAge(sa.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.secrets !== undefined && (
        <DetailPanel
          sa={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleteSuccess={reload}
          onDeleteDialogChange={setDeleteDialogOpen}
        />
      )}
    </div>
  )
}
