import { dump as yamlDump } from "js-yaml"
import { Eye, EyeOff, X } from "lucide-react"
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
import { K8sSecret } from "../types/k8s"
import { EmptyState } from "./EmptyState"

function DetailPanel({
  secret,
  onClose,
  onDeleted,
}: {
  secret: K8sSecret
  onClose: () => void
  onDeleted: () => void
}): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const dataEntries = Object.entries(secret.data)
  const labelEntries = Object.entries(secret.labels)
  const annotationEntries = Object.entries(secret.annotations)

  function toggleReveal(key: string) {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function handleEdit(): void {
    const obj = {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: secret.name,
        namespace: secret.namespace,
        ...(Object.keys(secret.labels).length > 0
          ? { labels: secret.labels }
          : {}),
        ...(Object.keys(secret.annotations).length > 0
          ? { annotations: secret.annotations }
          : {}),
      },
      type: secret.type,
      ...(Object.keys(secret.data).length > 0 ? { data: secret.data } : {}),
    }
    openDrawerTab({
      tabKey: `yaml-edit:Secret:${secret.namespace}/${secret.name}`,
      type: "yaml-edit",
      resourceKind: "Secret",
      resourceName: secret.name,
      namespace: secret.namespace,
      initialYaml: yamlDump(obj),
    })
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deleteSecret(secret.namespace, secret.name)
      toast.success(`Secret ${secret.name} deleted`)
      setDeleteOpen(false)
      onDeleted()
      onClose()
    } catch (e) {
      setDeleteError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="w-96 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{secret.name}</h2>
          <span className="text-xs text-muted-foreground">
            {secret.namespace}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-1"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Secret</DialogTitle>
            <DialogDescription>
              Delete <span className="font-mono">{secret.name}</span> from
              namespace <span className="font-mono">{secret.namespace}</span>?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
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
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1">
          Type
        </h3>
        <span className="text-sm font-mono">{secret.type}</span>
      </div>

      {dataEntries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Data
          </h3>
          {dataEntries.map(([key, value]) => (
            <div key={key} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm flex-1">
                  {key}
                </span>
                <button
                  onClick={() => toggleReveal(key)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={
                    revealedKeys.has(key) ? "Hide value" : "Show value"
                  }
                >
                  {revealedKeys.has(key) ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {revealedKeys.has(key) ? (
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {value}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground tracking-widest">
                  ••••••••
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Labels
          </h3>
          {labelEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">
                {k}:
              </span>
              <span className="break-all">{v}</span>
            </div>
          ))}
        </div>
      )}

      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Annotations
          </h3>
          {annotationEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">
                {k}:
              </span>
              <span className="break-all">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SecretsView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sSecret | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: secrets,
    loading,
    error,
    reload,
  } = useK8sResource(
    (ctx) => window.api.k8s.listSecrets({ contextName: ctx }),
    selectedContext,
  )

  const visibleSecrets = filterResources(secrets, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Secrets</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleSecrets.length === 0 && (
          <EmptyState message="No Secrets found" />
        )}
        {!loading && !error && visibleSecrets.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Keys</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSecrets.map((secret) => (
                <TableRow
                  key={`${secret.namespace}/${secret.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === secret.name &&
                      selectedItem?.namespace === secret.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === secret.name &&
                        selectedItem?.namespace === secret.namespace
                        ? null
                        : secret,
                    )
                  }
                >
                  <TableCell>{secret.name}</TableCell>
                  <TableCell>{secret.namespace}</TableCell>
                  <TableCell className="text-xs">{secret.type}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {secret.keys.join(", ") || "-"}
                  </TableCell>
                  <TableCell>{formatAge(secret.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.type !== undefined && (
        <DetailPanel
          secret={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleted={reload}
        />
      )}
    </div>
  )
}
