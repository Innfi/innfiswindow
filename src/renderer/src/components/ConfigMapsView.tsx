import { X } from "lucide-react"
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
import { K8sConfigMap } from "../types/k8s"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

function DetailPanel({
  cm,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  cm: K8sConfigMap
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const appendHistory = useAppStore((s) => s.appendHistory)
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const dataEntries = Object.entries(cm.data).filter(([k, v]) => kv(k, v))
  const binaryEntries = Object.entries(cm.binaryData).filter(([k]) => m(k))
  const labelEntries = Object.entries(cm.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(cm.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deleteConfigMap(cm.namespace, cm.name)
      appendHistory({
        action: "delete",
        resourceKind: "ConfigMap",
        resourceName: cm.name,
        namespace: cm.namespace,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`ConfigMap ${cm.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleted()
      onClose()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "ConfigMap",
        resourceName: cm.name,
        namespace: cm.namespace,
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
          <h2 className="font-semibold text-base mb-1">{cm.name}</h2>
          <span className="text-xs text-muted-foreground">{cm.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="ConfigMap"
            resourceName={cm.name}
            namespace={cm.namespace}
            buildYaml={() => ({
              apiVersion: "v1",
              kind: "ConfigMap",
              metadata: {
                name: cm.name,
                namespace: cm.namespace,
                ...(Object.keys(cm.labels).length > 0
                  ? { labels: cm.labels }
                  : {}),
                ...(Object.keys(cm.annotations).length > 0
                  ? { annotations: cm.annotations }
                  : {}),
              },
              ...(Object.keys(cm.data).length > 0 ? { data: cm.data } : {}),
              ...(Object.keys(cm.binaryData).length > 0
                ? { binaryData: cm.binaryData }
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
            name={cm.name}
            namespace={cm.namespace}
            resourceKind="configmap"
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
            <DialogTitle>Delete ConfigMap</DialogTitle>
            <DialogDescription>
              Delete <span className="font-mono">{cm.name}</span> from namespace{" "}
              <span className="font-mono">{cm.namespace}</span>? This cannot be
              undone.
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
        <MetaEntry label="Keys" value={cm.keys.join(", ") || "none"} />
        <MetaEntry
          label="Created"
          value={new Date(cm.creationTimestamp).toLocaleString()}
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
              <div className="font-mono font-bold text-sm">{key}</div>
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {value}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Binary Data */}
      {binaryEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Binary Data" />
          {binaryEntries.map(([key, size]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="font-mono font-bold">{key}</span>
              <span className="text-muted-foreground">{size} bytes</span>
            </div>
          ))}
        </div>
      )}

      {/* Events */}
      <ResourceEventsSection
        namespace={cm.namespace}
        name={cm.name}
        kind="ConfigMap"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function ConfigMapsView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sConfigMap | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: configMaps,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listConfigMaps({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || configMaps.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = configMaps.find(
      (c) => c.name === item.name && c.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [configMaps])

  const visibleConfigMaps = filterResources(
    configMaps,
    nameFilter,
    selectedNamespace,
  )

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">ConfigMaps</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleConfigMaps.length === 0 && (
          <EmptyState message="No ConfigMaps found" />
        )}
        {!loading && !error && visibleConfigMaps.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Keys</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleConfigMaps.map((cm) => (
                  <TableRow
                    key={`${cm.namespace}/${cm.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === cm.name &&
                        selectedItem?.namespace === cm.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === cm.name &&
                          selectedItem?.namespace === cm.namespace
                          ? null
                          : cm,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {cm.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {cm.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap max-w-xs truncate">
                      {cm.keys.join(", ") || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(cm.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.keys !== undefined && (
        <DetailPanel
          cm={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleted={reload}
          onDeleteDialogChange={setDeleteDialogOpen}
        />
      )}
    </div>
  )
}
