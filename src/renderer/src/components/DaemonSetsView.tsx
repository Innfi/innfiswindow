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
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
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
import { K8sDaemonSet } from "../types/k8s"
import { ContainerCard } from "./ContainerCard"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

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
  const selectedContext = useAppStore((s) => s.selectedContext)
  const appendHistory = useAppStore((s) => s.appendHistory)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const selectorEntries = Object.entries(ds.selector).filter(([k, v]) =>
    kv(k, v),
  )
  const nodeSelectorEntries = Object.entries(ds.nodeSelector).filter(([k, v]) =>
    kv(k, v),
  )
  const labelEntries = Object.entries(ds.labels ?? {}).filter(([k, v]) =>
    kv(k, v),
  )
  const annotationEntries = Object.entries(ds.annotations ?? {})
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))
  const podLabelEntries = Object.entries(ds.podTemplateLabels ?? {}).filter(
    ([k, v]) => kv(k, v),
  )

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    try {
      await window.api.k8s.deleteDaemonSet(ds.namespace, ds.name)
      appendHistory({
        action: "delete",
        resourceKind: "DaemonSet",
        resourceName: ds.name,
        namespace: ds.namespace,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`DaemonSet ${ds.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleted()
      onClose()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "DaemonSet",
        resourceName: ds.name,
        namespace: ds.namespace,
        context: selectedContext ?? "",
        success: false,
        error: String(e),
      })
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "DaemonSet: delete")
      setDeleteOpenNotify(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DetailPanelLayout>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{ds.name}</h2>
          <span className="text-xs text-muted-foreground">{ds.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="DaemonSet"
            resourceName={ds.name}
            namespace={ds.namespace}
            buildYaml={() => ({
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
                    ...(ds.tolerations.length
                      ? { tolerations: ds.tolerations }
                      : {}),
                  },
                },
              },
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

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
      />

      {/* Scheduling */}
      <div className="space-y-1">
        <SectionHeader title="Scheduling" />
        <MetaEntry label="Desired" value={String(ds.desiredNumberScheduled)} />
        <MetaEntry label="Current" value={String(ds.currentNumberScheduled)} />
        <MetaEntry label="Ready" value={String(ds.numberReady)} />
        <MetaEntry
          label="Up-to-date"
          value={String(ds.updatedNumberScheduled)}
        />
        <MetaEntry label="Available" value={String(ds.numberAvailable)} />
        <MetaEntry label="Update Strategy" value={ds.updateStrategy} />
        {ds.serviceAccountName && m(ds.serviceAccountName) && (
          <MetaEntry label="Service Account" value={ds.serviceAccountName} />
        )}
        <MetaEntry
          label="Created"
          value={new Date(ds.creationTimestamp).toLocaleString()}
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

      {/* Node Selector */}
      {nodeSelectorEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Node Selector" />
          {nodeSelectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Selector */}
      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Selector" />
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Pod Template Labels */}
      {podLabelEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Pod Template" />
          {podLabelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={`label: ${k}`} value={v} />
          ))}
        </div>
      )}

      {/* Init Containers */}
      {ds.initContainers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Init Containers" />
          {ds.initContainers
            .filter((c) => m(c.name) || m(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Containers */}
      {ds.containers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Containers" />
          {ds.containers
            .filter((c) => m(c.name) || m(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Volumes */}
      {ds.volumes.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Volumes" />
          {ds.volumes
            .filter((v) => m(v.name) || m(v.type) || m(v.detail))
            .map((v) => (
              <div
                key={v.name}
                className="text-xs border rounded p-2 space-y-0.5"
              >
                <div className="font-medium">{v.name}</div>
                <div className="text-muted-foreground">
                  {v.type}
                  {v.detail ? `: ${v.detail}` : ""}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Tolerations */}
      {ds.tolerations.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Tolerations" />
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

      {/* Events */}
      <ResourceEventsSection
        namespace={ds.namespace}
        name={ds.name}
        kind="DaemonSet"
        search={sl}
      />

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
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailPanelLayout>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Desired</TableHead>
                  <TableHead className="whitespace-nowrap">Current</TableHead>
                  <TableHead className="whitespace-nowrap">Ready</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Up-to-date
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Available</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
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
                    <TableCell className="whitespace-nowrap">
                      {ds.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ds.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ds.desiredNumberScheduled}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ds.currentNumberScheduled}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ds.numberReady}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ds.updatedNumberScheduled}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ds.numberAvailable}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(ds.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
