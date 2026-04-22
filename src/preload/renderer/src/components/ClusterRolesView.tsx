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

interface K8sRoleRule {
  apiGroups: string[]
  resources: string[]
  verbs: string[]
}

interface K8sClusterRole {
  name: string
  rulesCount: number
  creationTimestamp: string
  rules: K8sRoleRule[]
}

interface EditRulesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: K8sClusterRole
  onSaved: (updatedRules: K8sRoleRule[]) => void
}

function EditRulesDialog({
  open,
  onOpenChange,
  role,
  onSaved,
}: EditRulesDialogProps): JSX.Element {
  const [yaml, setYaml] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setYaml(yamlDump(role.rules))
      setError(null)
    }
  }, [open, role.rules])

  async function handleSave(): Promise<void> {
    let parsed: unknown
    try {
      parsed = yamlLoad(yaml)
    } catch (e) {
      setError(`YAML syntax error: ${String(e)}`)
      return
    }
    if (!Array.isArray(parsed)) {
      setError("Rules must be a YAML array")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const result = await window.api.k8s.updateClusterRole(
        role.name,
        parsed as K8sRoleRule[],
      )
      onSaved(result.rules)
      onOpenChange(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(`Failed to update ClusterRole: ${msg}`)
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
            <DialogTitle>Edit Rules — {role.name}</DialogTitle>
          </DialogHeader>
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
  role,
  onClose,
  onRulesUpdated,
}: {
  role: K8sClusterRole
  onClose: () => void
  onRulesUpdated: (rules: K8sRoleRule[]) => void
}): JSX.Element {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="w-[480px] shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{role.name}</h2>
          <span className="text-xs text-muted-foreground">ClusterRole</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditOpen(true)}
          >
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

      <EditRulesDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        role={role}
        onSaved={onRulesUpdated}
      />
    </div>
  )
}

export function ClusterRolesView(): JSX.Element {
  const [clusterRoles, setClusterRoles] = useState<K8sClusterRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sClusterRole | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const visible = nameFilter
    ? clusterRoles.filter((r) =>
        r.name.toLowerCase().includes(nameFilter.toLowerCase()),
      )
    : clusterRoles

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listClusterRoles()
      .then((data) => {
        setClusterRoles(data)
        setLoading(false)
      })
      .catch((err) => {
        handleIpcError(err, "ClusterRoles")
        setError(String(err))
        setLoading(false)
      })
  }, [])

  function handleRulesUpdated(updatedRules: K8sRoleRule[]): void {
    if (!selectedItem) return
    const updated = { ...selectedItem, rules: updatedRules, rulesCount: updatedRules.length }
    setClusterRoles((prev) =>
      prev.map((r) => (r.name === updated.name ? updated : r)),
    )
    setSelectedItem(updated)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Cluster Roles</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((role) => (
                <TableRow
                  key={role.name}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === role.name && "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === role.name ? null : role,
                    )
                  }
                >
                  <TableCell>{role.name}</TableCell>
                  <TableCell>{role.rulesCount}</TableCell>
                  <TableCell>{formatAge(role.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem &&
        selectedItem.rulesCount !== undefined &&
        !("namespace" in selectedItem) && (
          <DetailPanel
            role={selectedItem}
            onClose={() => setSelectedItem(null)}
            onRulesUpdated={handleRulesUpdated}
          />
        )}
    </div>
  )
}
