import { Eye, EyeOff, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
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
import { K8sSecret } from "../types/k8s"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

function DetailPanel({
  secret,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  secret: K8sSecret
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const appendHistory = useAppStore((s) => s.appendHistory)
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const dataEntries = Object.entries(secret.data).filter(([k]) => m(k))
  const labelEntries = Object.entries(secret.labels).filter(([k, v]) =>
    kv(k, v),
  )
  const annotationEntries = Object.entries(secret.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  function toggleReveal(key: string): void {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deleteSecret(secret.namespace, secret.name)
      appendHistory({
        action: "delete",
        resourceKind: "Secret",
        resourceName: secret.name,
        namespace: secret.namespace,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`Secret ${secret.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleted()
      onClose()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "Secret",
        resourceName: secret.name,
        namespace: secret.namespace,
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{secret.name}</h2>
          <span className="text-xs text-muted-foreground">
            {secret.namespace}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="Secret"
            resourceName={secret.name}
            namespace={secret.namespace}
            buildYaml={() => ({
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
              ...(Object.keys(secret.data).length > 0
                ? { data: secret.data }
                : {}),
            })}
          />
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            onClick={() => setDeleteOpenNotify(true)}
          >
            Delete
          </Button>
          <CopyResourceButton
            name={secret.name}
            namespace={secret.namespace}
            resourceKind="secret"
          />
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-1"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpenNotify}>
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
              {deleting ? "Deleting…" : "Delete"}
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

      {/* Info */}
      <div className="space-y-1">
        <SectionHeader title="Info" />
        <MetaEntry label="Type" value={secret.type} mono />
        <MetaEntry label="Keys" value={secret.keys.join(", ") || "none"} />
        <MetaEntry
          label="Created"
          value={new Date(secret.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Labels */}
      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          {labelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Annotations */}
      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Data */}
      {dataEntries.length > 0 && (
        <div className="space-y-2">
          <SectionHeader title="Data" />
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

      {/* Events */}
      <ResourceEventsSection
        namespace={secret.namespace}
        name={secret.name}
        kind="Secret"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function SecretsView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sSecret | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: secrets,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listSecrets({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || secrets.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = secrets.find(
      (s) => s.name === item.name && s.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [secrets])

  const visibleSecrets = filterResources(secrets, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Secrets</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleSecrets.length === 0 && (
          <EmptyState message="No Secrets found" />
        )}
        {!loading && !error && visibleSecrets.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="whitespace-nowrap">Keys</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
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
                    <TableCell className="whitespace-nowrap">
                      {secret.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {secret.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {secret.type}
                    </TableCell>
                    <TableCell className="whitespace-nowrap max-w-xs truncate">
                      {secret.keys.join(", ") || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(secret.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.type !== undefined && (
        <DetailPanel
          secret={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleted={reload}
          onDeleteDialogChange={setDeleteDialogOpen}
        />
      )}
    </div>
  )
}
