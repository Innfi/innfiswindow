import { Trash2, X } from "lucide-react"
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
import { K8sServiceAccount } from "../types/k8s"
import { DetailPanelLayout } from "./DetailPanelLayout"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

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
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const appendHistory = useAppStore((s) => s.appendHistory)
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(sa.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(sa.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deleteServiceAccount(sa.namespace, sa.name)
      appendHistory({
        action: "delete",
        resourceKind: "ServiceAccount",
        resourceName: sa.name,
        namespace: sa.namespace,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`ServiceAccount ${sa.name} deleted`)
      setDeleteOpenNotify(false)
      setSelectedItem(null)
      onDeleteSuccess()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "ServiceAccount",
        resourceName: sa.name,
        namespace: sa.namespace,
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
    <DetailPanelLayout>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{sa.name}</h2>
          <span className="text-xs text-muted-foreground">{sa.namespace}</span>
        </div>
        <div className="flex items-center gap-2">
          <EditButton
            resourceKind="ServiceAccount"
            resourceName={sa.name}
            namespace={sa.namespace}
            buildYaml={() => ({
              apiVersion: "v1",
              kind: "ServiceAccount",
              metadata: {
                name: sa.name,
                namespace: sa.namespace,
                ...(Object.keys(sa.labels).length > 0 && { labels: sa.labels }),
                ...(Object.keys(sa.annotations).length > 0 && {
                  annotations: sa.annotations,
                }),
              },
            })}
          />
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpenNotify(true)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
          <CopyResourceButton
            name={sa.name}
            namespace={sa.namespace}
            resourceKind="serviceaccount"
          />
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

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
      />

      {/* Metadata */}
      <div className="space-y-1">
        <SectionHeader title="Metadata" />
        <MetaEntry
          label="Created"
          value={new Date(sa.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Secrets */}
      <div className="space-y-1">
        <SectionHeader title={`Secrets (${sa.secrets.length})`} />
        {sa.secrets.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          sa.secrets
            .filter((s) => m(s))
            .map((s) => (
              <div key={s} className="text-xs font-mono">
                {s}
              </div>
            ))
        )}
      </div>

      {/* Image Pull Secrets */}
      <div className="space-y-1">
        <SectionHeader
          title={`Image Pull Secrets (${sa.imagePullSecrets.length})`}
        />
        {sa.imagePullSecrets.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          sa.imagePullSecrets
            .filter((s) => m(s))
            .map((s) => (
              <div key={s} className="text-xs font-mono">
                {s}
              </div>
            ))
        )}
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

      {/* Events */}
      <ResourceEventsSection
        namespace={sa.namespace}
        name={sa.name}
        kind="ServiceAccount"
        search={sl}
      />
    </DetailPanelLayout>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Secrets</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
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
                    <TableCell className="whitespace-nowrap">
                      {sa.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {sa.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {sa.secrets.length}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(sa.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
