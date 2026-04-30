import { dump as yamlDump } from "js-yaml"
import { Pencil, Trash2, X } from "lucide-react"
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
import { K8sRole } from "../types/k8s"

function DetailPanel({
  role,
  onClose,
  onDeleteSuccess,
}: {
  role: K8sRole
  onClose: () => void
  onDeleteSuccess: () => void
}): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function handleEdit(): void {
    openDrawerTab({
      type: "edit-resource",
      resourceKind: "Role",
      resourceName: role.name,
      namespace: role.namespace,
      initialYaml: yamlDump(role.rules),
    })
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deleteRole(role.namespace, role.name)
      toast.success(`Role ${role.name} deleted`)
      setDeleteOpen(false)
      setSelectedItem(null)
      onDeleteSuccess()
    } catch (e) {
      setDeleteError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="w-[480px] shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{role.name}</h2>
          <span className="text-xs text-muted-foreground">
            {role.namespace}
          </span>
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
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Rules ({role.rules.length})
        </h3>
        {role.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>API Groups</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Verbs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {role.rules.map((rule, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-mono">
                    {rule.apiGroups.join(", ") || '""'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {rule.resources.join(", ") || "*"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {rule.verbs.join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

export function RolesView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sRole | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: roles,
    loading,
    error,
    reload,
  } = useK8sResource(
    (ctx) => window.api.k8s.listRoles({ contextName: ctx }),
    selectedContext,
  )

  const visible = filterResources(roles, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Roles</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((role) => (
                <TableRow
                  key={`${role.namespace}/${role.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === role.name &&
                      selectedItem?.namespace === role.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === role.name &&
                        selectedItem?.namespace === role.namespace
                        ? null
                        : role,
                    )
                  }
                >
                  <TableCell>{role.name}</TableCell>
                  <TableCell>{role.namespace}</TableCell>
                  <TableCell>{role.rulesCount}</TableCell>
                  <TableCell>{formatAge(role.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.namespace !== undefined && (
        <DetailPanel
          role={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleteSuccess={reload}
        />
      )}
    </div>
  )
}
