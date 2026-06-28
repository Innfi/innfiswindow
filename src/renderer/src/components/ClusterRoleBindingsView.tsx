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
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sClusterRoleBinding } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

function DetailPanel({
  binding,
  onClose,
  onDeleteSuccess,
  onDeleteDialogChange,
}: {
  binding: K8sClusterRoleBinding
  onClose: () => void
  onDeleteSuccess: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
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

  function handleEdit(): void {
    openDrawerTab({
      tabKey: `edit-resource:ClusterRoleBinding:${binding.name}`,
      type: "edit-resource",
      resourceKind: "ClusterRoleBinding",
      resourceName: binding.name,
      initialYaml: yamlDump(binding.subjects),
      roleRef: { kind: binding.roleRef.kind, name: binding.roleRef.name },
    })
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deleteClusterRoleBinding(binding.name)
      appendHistory({
        action: "delete",
        resourceKind: "ClusterRoleBinding",
        resourceName: binding.name,
        namespace: null,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`ClusterRoleBinding ${binding.name} deleted`)
      setDeleteOpenNotify(false)
      setSelectedItem(null)
      onDeleteSuccess()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "ClusterRoleBinding",
        resourceName: binding.name,
        namespace: null,
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
            ClusterRoleBinding
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
            resourceKind="clusterrolebinding"
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
            <DialogTitle>Delete ClusterRoleBinding</DialogTitle>
            <DialogDescription>
              Delete cluster role binding <strong>{binding.name}</strong>? This
              cannot be undone.
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
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Metadata
        </h3>
        <MetaEntry label="Created" value={new Date(binding.creationTimestamp).toLocaleString()} />
      </div>

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
                      <TableCell className="whitespace-nowrap text-xs">{s.kind}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-mono">{s.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{s.namespace}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {Object.keys(binding.labels).length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Labels
          </h3>
          {Object.entries(binding.labels)
            .filter(([k, v]) => kv(k, v))
            .map(([k, v]) => (
              <MetaEntry key={k} label={k} value={v} />
            ))}
        </div>
      )}

      {Object.keys(binding.annotations).length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Annotations
          </h3>
          {Object.entries(binding.annotations)
            .filter(([k]) => !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"))
            .filter(([k, v]) => kv(k, v))
            .map(([k, v]) => (
              <MetaEntry key={k} label={k} value={v} />
            ))}
        </div>
      )}
    </div>
  )
}

export function ClusterRoleBindingsView(): JSX.Element {
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sClusterRoleBinding | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
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
    (ctx) => window.api.k8s.listClusterRoleBindings({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || bindings.length === 0) return
    const fresh = bindings.find((b) => b.name === selectedItem.name)
    if (fresh) setSelectedItem(fresh as object)
  }, [bindings])

  const visible = nameFilter
    ? bindings.filter((b) =>
        b.name.toLowerCase().includes(nameFilter.toLowerCase()),
      )
    : bindings

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Cluster Role Bindings</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message="No Cluster Role Bindings found" />
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Role</TableHead>
                  <TableHead className="whitespace-nowrap">Subjects</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((binding) => (
                  <TableRow
                    key={binding.name}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === binding.name &&
                        !("namespace" in (selectedItem as object)) &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === binding.name &&
                          !("namespace" in (selectedItem as object))
                          ? null
                          : binding,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {binding.name}
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
        selectedItem.roleRef !== undefined &&
        !("namespace" in selectedItem) && (
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
