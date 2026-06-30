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
import { K8sRole } from "../types/k8s"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"

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
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
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
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Metadata
        </h3>
        <MetaEntry
          label="Created"
          value={new Date(role.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Rules ({role.rules.length})
        </h3>
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
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Labels
          </h3>
          {Object.entries(role.labels)
            .filter(([k, v]) => kv(k, v))
            .map(([k, v]) => (
              <MetaEntry key={k} label={k} value={v} />
            ))}
        </div>
      )}

      {Object.keys(role.annotations).length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Annotations
          </h3>
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
    </div>
  )
}

export function RolesView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sRole | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: roles,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listRoles({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || roles.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = roles.find(
      (r) => r.name === item.name && r.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [roles])

  const visible = filterResources(roles, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Roles</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message="No Roles found" />
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Rules</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
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
                    <TableCell className="whitespace-nowrap">
                      {role.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {role.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {role.rulesCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(role.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.namespace !== undefined && (
        <DetailPanel
          role={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleteSuccess={reload}
          onDeleteDialogChange={setDeleteDialogOpen}
        />
      )}
    </div>
  )
}
