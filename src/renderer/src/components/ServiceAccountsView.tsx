import { Trash2 } from "lucide-react"
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
import { useAppStore } from "../../store/app.store"
import { useRecordHistory } from "../hooks/useRecordHistory"
import { K8sServiceAccount } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

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
  const recordHistory = useRecordHistory()
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
    const target = {
      action: "delete",
      resourceKind: "ServiceAccount",
      resourceName: sa.name,
      namespace: sa.namespace,
    } as const
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deleteServiceAccount(sa.namespace, sa.name)
      recordHistory(target, { success: true })
      toast.success(`ServiceAccount ${sa.name} deleted`)
      setDeleteOpenNotify(false)
      setSelectedItem(null)
      onDeleteSuccess()
    } catch (e) {
      recordHistory(target, { success: false, error: String(e) })
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
          <ClosePanelButton onClose={onClose} />
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
  return (
    <ResourceListView<K8sServiceAccount>
      title="Service Accounts"
      emptyMessage="No Service Accounts found"
      list={(ctx) => window.api.k8s.listServiceAccounts({ contextName: ctx })}
      detailGuard={(item) => (item as K8sServiceAccount).secrets !== undefined}
      columns={[
        { head: "Name", cell: (sa) => sa.name },
        { head: "Namespace", cell: (sa) => sa.namespace },
        { head: "Secrets", cell: (sa) => sa.secrets.length },
        ageColumn<K8sServiceAccount>(),
      ]}
      renderDetail={(sa, ctl: DetailController) => (
        <DetailPanel
          sa={sa}
          onClose={ctl.onClose}
          onDeleteSuccess={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
