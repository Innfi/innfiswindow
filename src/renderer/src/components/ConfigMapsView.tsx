import { useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/Button"
import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/Dialog"
import { EditButton } from "../../components/ui/EditButton"
import { MetaEntry } from "../../components/ui/MetaEntry"
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { useRecordHistory } from "../hooks/useRecordHistory"
import { K8sConfigMap } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

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
  const recordHistory = useRecordHistory()
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
    const target = {
      action: "delete",
      resourceKind: "ConfigMap",
      resourceName: cm.name,
      namespace: cm.namespace,
    } as const
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.api.k8s.deleteConfigMap(cm.namespace, cm.name)
      recordHistory(target, { success: true })
      toast.success(`ConfigMap ${cm.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleted()
      onClose()
    } catch (e) {
      recordHistory(target, { success: false, error: String(e) })
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
          <ClosePanelButton onClose={onClose} className="ml-1" />
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
  return (
    <ResourceListView<K8sConfigMap>
      title="ConfigMaps"
      list={(ctx) => window.api.k8s.listConfigMaps({ contextName: ctx })}
      detailGuard={(item) => (item as K8sConfigMap).keys !== undefined}
      columns={[
        { head: "Name", cell: (cm) => cm.name },
        { head: "Namespace", cell: (cm) => cm.namespace },
        {
          head: "Keys",
          cell: (cm) => cm.keys.join(", ") || "-",
          className: "max-w-xs truncate",
        },
        ageColumn<K8sConfigMap>(),
      ]}
      renderDetail={(cm, ctl: DetailController) => (
        <DetailPanel cm={cm} {...ctl} />
      )}
    />
  )
}
