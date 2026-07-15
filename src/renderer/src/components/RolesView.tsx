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
import { K8sRole } from "../types/k8s"

function DetailPanel({
  role,
  onClose,
  onDeleteSuccess,
  onDeleteDialogChange,
}: {
  role: K8sRole
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
      await window.api.k8s.deleteRole(role.namespace, role.name)
      appendHistory({
        action: "delete",
        resourceKind: "Role",
        resourceName: role.name,
        namespace: role.namespace,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`Role ${role.name} deleted`)
      setDeleteOpenNotify(false)
      setSelectedItem(null)
      onDeleteSuccess()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "Role",
        resourceName: role.name,
        namespace: role.namespace,
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
          <h2 className="font-semibold text-base mb-1">{role.name}</h2>
          <span className="text-xs text-muted-foreground">
            {role.namespace}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <EditButton
            resourceKind="Role"
            resourceName={role.name}
            namespace={role.namespace}
            buildYaml={() => ({
              apiVersion: "rbac.authorization.k8s.io/v1",
              kind: "Role",
              metadata: {
                name: role.name,
                namespace: role.namespace,
                ...(Object.keys(role.labels).length > 0 && {
                  labels: role.labels,
                }),
                ...(Object.keys(role.annotations).length > 0 && {
                  annotations: role.annotations,
                }),
              },
              rules: role.rules,
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
            name={role.name}
            namespace={role.namespace}
            resourceKind="role"
          />
          <ClosePanelButton onClose={onClose} />
        </div>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpenNotify}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Delete role <strong>{role.name}</strong> in namespace{" "}
              <strong>{role.namespace}</strong>? This cannot be undone.
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
          value={new Date(role.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <SectionHeader title={`Rules (${role.rules.length})`} />
        {role.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">
                    API Groups
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Resources</TableHead>
                  <TableHead className="whitespace-nowrap">Verbs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {role.rules
                  .filter(
                    (rule) =>
                      !sl ||
                      rule.resources.some((r) =>
                        r.toLowerCase().includes(sl),
                      ) ||
                      rule.verbs.some((v) => v.toLowerCase().includes(sl)) ||
                      rule.apiGroups.some((g) => g.toLowerCase().includes(sl)),
                  )
                  .map((rule, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap text-xs font-mono">
                        {rule.apiGroups.join(", ") || '""'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {rule.resources.join(", ") || "*"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {rule.verbs.join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {Object.keys(role.labels).length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          {Object.entries(role.labels)
            .filter(([k, v]) => kv(k, v))
            .map(([k, v]) => (
              <MetaEntry key={k} label={k} value={v} />
            ))}
        </div>
      )}

      {Object.keys(role.annotations).length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {Object.entries(role.annotations)
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

export function RolesView(): JSX.Element {
  return (
    <ResourceListView<K8sRole>
      title="Roles"
      list={(ctx) => window.api.k8s.listRoles({ contextName: ctx })}
      detailGuard={(item) => (item as K8sRole).namespace !== undefined}
      columns={[
        { head: "Name", cell: (role) => role.name },
        { head: "Namespace", cell: (role) => role.namespace },
        { head: "Rules", cell: (role) => role.rulesCount },
        ageColumn<K8sRole>(),
      ]}
      renderDetail={(role, ctl: DetailController) => (
        <DetailPanel
          role={role}
          onClose={ctl.onClose}
          onDeleteSuccess={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
