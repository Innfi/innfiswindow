import { Eye, EyeOff } from "lucide-react"
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
import { useAppStore } from "../../store/app.store"
import { K8sSecret } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

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
          <ClosePanelButton onClose={onClose} className="ml-1" />
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
  return (
    <ResourceListView<K8sSecret>
      title="Secrets"
      list={(ctx) => window.api.k8s.listSecrets({ contextName: ctx })}
      detailGuard={(item) => (item as K8sSecret).type !== undefined}
      columns={[
        { head: "Name", cell: (s) => s.name },
        { head: "Namespace", cell: (s) => s.namespace },
        { head: "Type", cell: (s) => s.type, className: "text-xs" },
        {
          head: "Keys",
          cell: (s) => s.keys.join(", ") || "-",
          className: "max-w-xs truncate",
        },
        ageColumn<K8sSecret>(),
      ]}
      renderDetail={(secret, ctl: DetailController) => (
        <DetailPanel secret={secret} {...ctl} />
      )}
    />
  )
}
