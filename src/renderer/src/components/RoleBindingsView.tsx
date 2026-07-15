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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table"
import { useAppStore } from "../../store/app.store"
import { K8sRoleBinding } from "../types/k8s"

function DetailPanel({
  binding,
  onClose,
  onDeleteSuccess,
  onDeleteDialogChange,
}: {
  binding: K8sRoleBinding
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
      await window.api.k8s.deleteRoleBinding(binding.namespace, binding.name)
      appendHistory({
        action: "delete",
        resourceKind: "RoleBinding",
        resourceName: binding.name,
        namespace: binding.namespace,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`RoleBinding ${binding.name} deleted`)
      setDeleteOpenNotify(false)
      setSelectedItem(null)
      onDeleteSuccess()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "RoleBinding",
        resourceName: binding.name,
        namespace: binding.namespace,
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
          <h2 className="font-semibold text-base mb-1">{binding.name}</h2>
          <span className="text-xs text-muted-foreground">
            {binding.namespace}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <EditButton
            resourceKind="RoleBinding"
            resourceName={binding.name}
            namespace={binding.namespace}
            buildYaml={() => ({
              apiVersion: "rbac.authorization.k8s.io/v1",
              kind: "RoleBinding",
              metadata: {
                name: binding.name,
                namespace: binding.namespace,
                ...(Object.keys(binding.labels).length > 0 && {
                  labels: binding.labels,
                }),
                ...(Object.keys(binding.annotations).length > 0 && {
                  annotations: binding.annotations,
                }),
              },
              roleRef: {
                apiGroup: "rbac.authorization.k8s.io",
                kind: binding.roleRef.kind,
                name: binding.roleRef.name,
              },
              subjects: binding.subjects,
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
            name={binding.name}
            namespace={binding.namespace}
            resourceKind="rolebinding"
          />
          <ClosePanelButton onClose={onClose} />
        </div>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpenNotify}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete RoleBinding</DialogTitle>
            <DialogDescription>
              Delete role binding <strong>{binding.name}</strong> in namespace{" "}
              <strong>{binding.namespace}</strong>? This cannot be undone.
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

      <div className="space-y-1">
        <SectionHeader title="Metadata" />
        <MetaEntry
          label="Created"
          value={new Date(binding.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <SectionHeader title="Role Ref" />
        <div className="text-sm">
          <span className="font-medium">{binding.roleRef.kind}:</span>{" "}
          {binding.roleRef.name}
        </div>
      </div>

      <div className="space-y-1">
        <SectionHeader title={`Subjects (${binding.subjects.length})`} />
        {binding.subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subjects</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Kind</TableHead>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {binding.subjects
                  .filter(
                    (s) =>
                      !sl ||
                      s.kind.toLowerCase().includes(sl) ||
                      s.name.toLowerCase().includes(sl) ||
                      (s.namespace ?? "").toLowerCase().includes(sl),
                  )
                  .map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {s.kind}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-mono">
                        {s.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {s.namespace}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {Object.keys(binding.labels).length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          {Object.entries(binding.labels)
            .filter(([k, v]) => kv(k, v))
            .map(([k, v]) => (
              <MetaEntry key={k} label={k} value={v} />
            ))}
        </div>
      )}

      {Object.keys(binding.annotations).length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {Object.entries(binding.annotations)
            .filter(
              ([k]) =>
                !k.startsWith(
                  "kubectl.kubernetes.io/last-applied-configuration",
                ),
            )
            .filter(([k, v]) => kv(k, v))
            .map(([k, v]) => (
              <MetaEntry key={k} label={k} value={v} />
            ))}
        </div>
      )}
    </DetailPanelLayout>
  )
}

export function RoleBindingsView(): JSX.Element {
  return (
    <ResourceListView<K8sRoleBinding>
      title="Role Bindings"
      emptyMessage="No Role Bindings found"
      list={(ctx) => window.api.k8s.listRoleBindings({ contextName: ctx })}
      detailGuard={(item) => {
        const b = item as K8sRoleBinding
        return b.namespace !== undefined && b.roleRef !== undefined
      }}
      columns={[
        { head: "Name", cell: (b) => b.name },
        { head: "Namespace", cell: (b) => b.namespace },
        { head: "Role", cell: (b) => b.roleRef.name },
        { head: "Subjects", cell: (b) => b.subjectsCount },
        ageColumn<K8sRoleBinding>(),
      ]}
      renderDetail={(binding, ctl: DetailController) => (
        <DetailPanel
          binding={binding}
          onClose={ctl.onClose}
          onDeleteSuccess={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
