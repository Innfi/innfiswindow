import { dump as yamlDump } from "js-yaml"
import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog"
import { Button } from "../../components/ui/button"
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
import { K8sDaemonSet } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

function DetailPanel({
  ds,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  ds: K8sDaemonSet
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }
  const selectorEntries = Object.entries(ds.selector)
  const nodeSelectorEntries = Object.entries(ds.nodeSelector)

  function handleEdit(): void {
    const obj = {
      apiVersion: "apps/v1",
      kind: "DaemonSet",
      metadata: { name: ds.name, namespace: ds.namespace },
      spec: {
        selector: { matchLabels: ds.selector },
        updateStrategy: { type: ds.updateStrategy },
        template: {
          metadata: { labels: ds.selector },
          spec: {
            containers: ds.containers.map((c) => ({
              name: c.name,
              image: c.image,
            })),
            ...(Object.keys(ds.nodeSelector).length
              ? { nodeSelector: ds.nodeSelector }
              : {}),
            ...(ds.tolerations.length ? { tolerations: ds.tolerations } : {}),
          },
        },
      },
    }
    openDrawerTab({
      tabKey: `yaml-edit:DaemonSet:${ds.namespace}/${ds.name}`,
      type: "yaml-edit",
      resourceKind: "DaemonSet",
      resourceName: ds.name,
      namespace: ds.namespace,
      initialYaml: yamlDump(obj),
    })
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    try {
      await window.api.k8s.deleteDaemonSet(ds.namespace, ds.name)
      toast.success(`DaemonSet ${ds.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleted()
      onClose()
    } catch (e) {
      toast.error(String(e))
      setDeleteOpenNotify(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{ds.name}</h2>
          <span className="text-xs text-muted-foreground">{ds.namespace}</span>
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
            onClick={() => setDeleteOpenNotify(true)}
          >
            Delete
          </Button>
          <CopyResourceButton
            name={ds.name}
            namespace={ds.namespace}
            resourceKind="daemonset"
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

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Scheduling
        </h3>
        <MetaEntry label="Desired" value={String(ds.desiredNumberScheduled)} />
        <MetaEntry label="Current" value={String(ds.currentNumberScheduled)} />
        <MetaEntry label="Ready" value={String(ds.numberReady)} />
        <MetaEntry
          label="Up-to-date"
          value={String(ds.updatedNumberScheduled)}
        />
        <MetaEntry label="Available" value={String(ds.numberAvailable)} />
        <MetaEntry
          label="Created"
          value={new Date(ds.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Update Strategy
        </h3>
        <MetaEntry label="Strategy" value={ds.updateStrategy} />
      </div>

      {nodeSelectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Node Selector
          </h3>
          {nodeSelectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Selector Labels
          </h3>
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {ds.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {ds.containers.map((c) => (
            <div
              key={c.name}
              className="text-sm border rounded p-2 space-y-0.5"
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground break-all">
                {c.image}
              </div>
            </div>
          ))}
        </div>
      )}

      {ds.tolerations.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Tolerations
          </h3>
          {ds.tolerations.map((t, i) => (
            <div key={i} className="text-sm border rounded p-2 space-y-0.5">
              {t.key && <div className="font-medium">{t.key}</div>}
              <div className="text-xs text-muted-foreground">
                {[t.operator, t.value, t.effect].filter(Boolean).join(" / ")}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete DaemonSet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {ds.namespace}/{ds.name}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
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
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function DaemonSetsView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sDaemonSet | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: daemonSets,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listDaemonSets({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || daemonSets.length === 0) return
    const fresh = daemonSets.find(
      (d) =>
        d.name === selectedItem.name && d.namespace === selectedItem.namespace,
    )
    if (fresh) setSelectedItem(fresh)
  }, [daemonSets])

  const visibleDaemonSets = filterResources(
    daemonSets,
    nameFilter,
    selectedNamespace,
  )

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">DaemonSets</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleDaemonSets.length === 0 && (
          <EmptyState message="No Daemon Sets found" />
        )}
        {!loading && !error && visibleDaemonSets.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Desired</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Up-to-date</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleDaemonSets.map((ds) => (
                <TableRow
                  key={`${ds.namespace}/${ds.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === ds.name &&
                      selectedItem?.namespace === ds.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === ds.name &&
                        selectedItem?.namespace === ds.namespace
                        ? null
                        : ds,
                    )
                  }
                >
                  <TableCell>{ds.name}</TableCell>
                  <TableCell>{ds.namespace}</TableCell>
                  <TableCell>{ds.desiredNumberScheduled}</TableCell>
                  <TableCell>{ds.currentNumberScheduled}</TableCell>
                  <TableCell>{ds.numberReady}</TableCell>
                  <TableCell>{ds.updatedNumberScheduled}</TableCell>
                  <TableCell>{ds.numberAvailable}</TableCell>
                  <TableCell>{formatAge(ds.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.desiredNumberScheduled !== undefined && (
        <DetailPanel
          ds={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleted={() => {
            reload()
            setSelectedItem(null)
          }}
          onDeleteDialogChange={setDeleteDialogOpen}
        />
      )}
    </div>
  )
}
