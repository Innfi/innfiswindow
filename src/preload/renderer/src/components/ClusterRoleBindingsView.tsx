import { dump as yamlDump, load as yamlLoad } from "js-yaml"
import { Pencil, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
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

interface BindingSubject {
  kind: string
  name: string
  namespace: string
}

interface RoleRef {
  kind: string
  name: string
}

interface K8sClusterRoleBinding {
  name: string
  roleRef: RoleRef
  subjects: BindingSubject[]
  subjectsCount: number
  creationTimestamp: string
}

interface EditSubjectsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  binding: K8sClusterRoleBinding
  onSaved: (updatedSubjects: BindingSubject[]) => void
}

function EditSubjectsDialog({
  open,
  onOpenChange,
  binding,
  onSaved,
}: EditSubjectsDialogProps): JSX.Element {
  const [yaml, setYaml] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setYaml(yamlDump(binding.subjects))
      setError(null)
    }
  }, [open, binding.subjects])

  async function handleSave(): Promise<void> {
    let parsed: unknown
    try {
      parsed = yamlLoad(yaml)
    } catch (e) {
      setError(`YAML syntax error: ${String(e)}`)
      return
    }
    if (!Array.isArray(parsed)) {
      setError("Subjects must be a YAML array")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const result = await window.api.k8s.updateClusterRoleBinding(
        binding.name,
        parsed as BindingSubject[],
      )
      onSaved(result.subjects)
      onOpenChange(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(`Failed to update ClusterRoleBinding: ${msg}`)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-full flex flex-col p-0 overflow-hidden"
        style={{ height: "70vh" }}
        onClose={() => onOpenChange(false)}
      >
        <div className="p-6 pb-3 bg-card text-card-foreground border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle>Edit Subjects — {binding.name}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium">Role Ref (read-only):</span>{" "}
            {binding.roleRef.kind}/{binding.roleRef.name}
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            className="w-full h-full resize-none p-4 font-mono text-sm bg-muted text-foreground border-border focus:outline-none focus:ring-1 focus:ring-ring"
            spellCheck={false}
          />
        </div>
        <div className="p-6 pt-3 space-y-3 bg-card text-card-foreground border-t border-border">
          {error && (
            <p className="text-sm text-destructive font-mono whitespace-pre-wrap">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DetailPanel({
  binding,
  onClose,
  onSubjectsUpdated,
}: {
  binding: K8sClusterRoleBinding
  onClose: () => void
  onSubjectsUpdated: (subjects: BindingSubject[]) => void
}): JSX.Element {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="w-[480px] shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{binding.name}</h2>
          <span className="text-xs text-muted-foreground">
            ClusterRoleBinding
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3 w-3 mr-1" />
            Edit
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

      <EditSubjectsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        binding={binding}
        onSaved={onSubjectsUpdated}
      />
    </div>
  )
}

export function ClusterRoleBindingsView(): JSX.Element {
  const [bindings, setBindings] = useState<K8sClusterRoleBinding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sClusterRoleBinding | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const visible = nameFilter
    ? bindings.filter((b) =>
        b.name.toLowerCase().includes(nameFilter.toLowerCase()),
      )
    : bindings

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listClusterRoleBindings({ contextName: selectedContext ?? undefined })
      .then((data) => {
        setBindings(data)
        setLoading(false)
      })
      .catch((err) => {
        handleIpcError(err, "ClusterRoleBindings")
        setError(String(err))
        setLoading(false)
      })
  }, [selectedContext])

  function handleSubjectsUpdated(updatedSubjects: BindingSubject[]): void {
    if (!selectedItem) return
    const updated = {
      ...selectedItem,
      subjects: updatedSubjects,
      subjectsCount: updatedSubjects.length,
    }
    setBindings((prev) =>
      prev.map((b) => (b.name === updated.name ? updated : b)),
    )
    setSelectedItem(updated)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Cluster Role Bindings</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Age</TableHead>
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
                  <TableCell>{binding.name}</TableCell>
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
        selectedItem.roleRef !== undefined &&
        !("namespace" in selectedItem) && (
          <DetailPanel
            binding={selectedItem}
            onClose={() => setSelectedItem(null)}
            onSubjectsUpdated={handleSubjectsUpdated}
          />
        )}
    </div>
  )
}
