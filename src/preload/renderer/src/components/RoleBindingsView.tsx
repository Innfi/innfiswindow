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
import { handleIpcError } from "../../lib/ipc-error"
import { cn, filterResources, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"

interface BindingSubject {
  kind: string
  name: string
  namespace: string
}

interface RoleRef {
  kind: string
  name: string
}

interface K8sRoleBinding {
  name: string
  namespace: string
  roleRef: RoleRef
  subjects: BindingSubject[]
  subjectsCount: number
  creationTimestamp: string
}

function DetailPanel({
  binding,
  onClose,
  onDeleteSuccess,
}: {
  binding: K8sRoleBinding
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
      toast.success(`RoleBinding ${binding.name} deleted`)
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {binding.subjects.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{s.kind}</TableCell>
                  <TableCell className="text-xs font-mono">{s.name}</TableCell>
                  <TableCell className="text-xs">{s.namespace}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

export function RoleBindingsView(): JSX.Element {
  const [bindings, setBindings] = useState<K8sRoleBinding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sRoleBinding | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const visible = filterResources(bindings, nameFilter, selectedNamespace)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listRoleBindings({ contextName: selectedContext ?? undefined })
      .then((data) => {
        setBindings(data)
        setLoading(false)
      })
      .catch((err) => {
        handleIpcError(err, "RoleBindings")
        setError(String(err))
        setLoading(false)
      })
  }, [selectedContext])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Role Bindings</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Age</TableHead>
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
                  <TableCell>{binding.name}</TableCell>
                  <TableCell>{binding.namespace}</TableCell>
                  <TableCell>{binding.roleRef.name}</TableCell>
                  <TableCell>{binding.subjectsCount}</TableCell>
                  <TableCell>{formatAge(binding.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem &&
        selectedItem.namespace !== undefined &&
        selectedItem.roleRef !== undefined && (
          <DetailPanel
            binding={selectedItem}
            onClose={() => setSelectedItem(null)}
            onDeleteSuccess={() => {
              setBindings((prev) =>
                prev.filter(
                  (b) =>
                    b.name !== selectedItem.name ||
                    b.namespace !== selectedItem.namespace,
                ),
              )
            }}
          />
        )}
    </div>
  )
}
