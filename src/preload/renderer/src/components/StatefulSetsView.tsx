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
import { K8sStatefulSet } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

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
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const appendHistory = useAppStore((s) => s.appendHistory)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const selectorEntries = Object.entries(ss.selector)

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  function handleEdit(): void {
    const obj = {
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
    }
    openDrawerTab({
      tabKey: `yaml-edit:StatefulSet:${ss.namespace}/${ss.name}`,
      type: "yaml-edit",
      resourceKind: "StatefulSet",
      resourceName: ss.name,
      namespace: ss.namespace,
      initialYaml: yamlDump(obj),
    })
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
      setDeleteOpenNotify(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{ss.name}</h2>
          <span className="text-xs text-muted-foreground">{ss.namespace}</span>
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

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Replicas
        </h3>
        <MetaEntry label="Desired" value={String(ss.replicas)} />
        <MetaEntry label="Ready" value={String(ss.readyReplicas)} />
        <MetaEntry
          label="Created"
          value={new Date(ss.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Configuration
        </h3>
        <MetaEntry label="Service Name" value={ss.serviceName} />
        <MetaEntry label="Update Strategy" value={ss.updateStrategy} />
      </div>

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

      {ss.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {ss.containers.map((c) => (
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

      {ss.volumeClaimTemplates.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Volume Claim Templates
          </h3>
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
    </div>
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
