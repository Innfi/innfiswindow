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
import { K8sRoleBinding } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { RefreshBar } from "./RefreshBar"

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
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const appendHistory = useAppStore((s) => s.appendHistory)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  function handleEdit(): void {
    openDrawerTab({
      tabKey: `edit-resource:RoleBinding:${binding.namespace}/${binding.name}`,
      type: "edit-resource",
      resourceKind: "RoleBinding",
      resourceName: binding.name,
      namespace: binding.namespace,
      initialYaml: yamlDump(binding.subjects),
      roleRef: { kind: binding.roleRef.kind, name: binding.roleRef.name },
    })
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
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{binding.name}</h2>
          <span className="text-xs text-muted-foreground">
            {binding.namespace}
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

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Role Ref
        </h3>
        <div className="text-sm">
          <span className="font-medium">{binding.roleRef.kind}:</span>{" "}
          {binding.roleRef.name}
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Subjects ({binding.subjects.length})
        </h3>
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
                {binding.subjects.map((s, i) => (
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
    </div>
  )
}

export function RoleBindingsView(): JSX.Element {
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sRoleBinding | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: bindings,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listRoleBindings({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || bindings.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = bindings.find(
      (b) => b.name === item.name && b.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [bindings])

  const visible = filterResources(bindings, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Role Bindings</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message="No Role Bindings found" />
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Role</TableHead>
                  <TableHead className="whitespace-nowrap">Subjects</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((binding) => (
                  <TableRow
                    key={`${binding.namespace}/${binding.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === binding.name &&
                        selectedItem?.namespace === binding.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === binding.name &&
                          selectedItem?.namespace === binding.namespace
                          ? null
                          : binding,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {binding.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {binding.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {binding.roleRef.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {binding.subjectsCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(binding.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem &&
        selectedItem.namespace !== undefined &&
        selectedItem.roleRef !== undefined && (
          <DetailPanel
            binding={selectedItem}
            onClose={() => setSelectedItem(null)}
            onDeleteSuccess={reload}
            onDeleteDialogChange={setDeleteDialogOpen}
          />
        )}
    </div>
  )
}
