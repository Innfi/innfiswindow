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
import { K8sStatefulSet } from "../types/k8s"
import { ContainerCard } from "./ContainerCard"
import { DetailPanelLayout } from "./DetailPanelLayout"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

function DetailPanel({
  ss,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  ss: K8sStatefulSet
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

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const selectorEntries = Object.entries(ss.selector).filter(([k, v]) =>
    kv(k, v),
  )
  const labelEntries = Object.entries(ss.labels ?? {}).filter(([k, v]) =>
    kv(k, v),
  )
  const annotationEntries = Object.entries(ss.annotations ?? {})
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))
  const podLabelEntries = Object.entries(ss.podTemplateLabels ?? {}).filter(
    ([k, v]) => kv(k, v),
  )

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    try {
      await window.api.k8s.deleteStatefulSet(ss.namespace, ss.name)
      appendHistory({
        action: "delete",
        resourceKind: "StatefulSet",
        resourceName: ss.name,
        namespace: ss.namespace,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`StatefulSet ${ss.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleted()
      onClose()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "StatefulSet",
        resourceName: ss.name,
        namespace: ss.namespace,
        context: selectedContext ?? "",
        success: false,
        error: String(e),
      })
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "StatefulSet: delete")
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
          <h2 className="font-semibold text-base mb-1">{ss.name}</h2>
          <span className="text-xs text-muted-foreground">{ss.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="StatefulSet"
            resourceName={ss.name}
            namespace={ss.namespace}
            buildYaml={() => ({
              apiVersion: "apps/v1",
              kind: "StatefulSet",
              metadata: { name: ss.name, namespace: ss.namespace },
              spec: {
                replicas: ss.replicas,
                serviceName: ss.serviceName,
                selector: { matchLabels: ss.selector },
                updateStrategy: { type: ss.updateStrategy },
                template: {
                  metadata: { labels: ss.selector },
                  spec: {
                    containers: ss.containers.map((c) => ({
                      name: c.name,
                      image: c.image,
                    })),
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
            name={ss.name}
            namespace={ss.namespace}
            resourceKind="statefulset"
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

      {/* Replicas */}
      <div className="space-y-1">
        <SectionHeader title="Replicas" />
        <MetaEntry label="Desired" value={String(ss.replicas)} />
        <MetaEntry label="Ready" value={String(ss.readyReplicas)} />
        <MetaEntry label="Service Name" value={ss.serviceName} />
        <MetaEntry label="Update Strategy" value={ss.updateStrategy} />
        {ss.serviceAccountName && m(ss.serviceAccountName) && (
          <MetaEntry label="Service Account" value={ss.serviceAccountName} />
        )}
        <MetaEntry
          label="Created"
          value={new Date(ss.creationTimestamp).toLocaleString()}
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
      {ss.initContainers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Init Containers" />
          {ss.initContainers
            .filter((c) => m(c.name) || m(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Containers */}
      {ss.containers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Containers" />
          {ss.containers
            .filter((c) => m(c.name) || m(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Volumes */}
      {ss.volumes.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Volumes" />
          {ss.volumes
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

      {/* Volume Claim Templates */}
      {ss.volumeClaimTemplates.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Volume Claim Templates" />
          {ss.volumeClaimTemplates.map((vct) => (
            <div
              key={vct.name}
              className="text-sm border rounded p-2 space-y-0.5"
            >
              <div className="font-medium">{vct.name}</div>
              <div className="text-xs text-muted-foreground">{vct.storage}</div>
            </div>
          ))}
        </div>
      )}

      {/* Events */}
      <ResourceEventsSection
        namespace={ss.namespace}
        name={ss.name}
        kind="StatefulSet"
        search={sl}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete StatefulSet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {ss.namespace}/{ss.name}
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

export function StatefulSetsView(): JSX.Element {
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sStatefulSet | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: statefulSets,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listStatefulSets({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || statefulSets.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = statefulSets.find(
      (ss) => ss.name === item.name && ss.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [statefulSets])

  const visibleStatefulSets = filterResources(
    statefulSets,
    nameFilter,
    selectedNamespace,
  )

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">StatefulSets</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleStatefulSets.length === 0 && (
          <EmptyState message="No Stateful Sets found" />
        )}
        {!loading && !error && visibleStatefulSets.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Ready</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                  <TableHead className="whitespace-nowrap">Service</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleStatefulSets.map((ss) => (
                  <TableRow
                    key={`${ss.namespace}/${ss.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === ss.name &&
                        selectedItem?.namespace === ss.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === ss.name &&
                          selectedItem?.namespace === ss.namespace
                          ? null
                          : ss,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {ss.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ss.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ss.readyReplicas}/{ss.replicas}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(ss.creationTimestamp)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ss.serviceName}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.serviceName !== undefined && (
        <DetailPanel
          ss={selectedItem}
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
