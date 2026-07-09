import { X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
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
import { K8sDeployment } from "../types/k8s"
import { ContainerCard } from "./ContainerCard"
import { DetailPanelLayout } from "./DetailPanelLayout"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

type DeploymentRevision = {
  revision: number
  changeCause: string
  images: string[]
  creationTimestamp: string
}

function DetailPanel({
  deployment,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  deployment: K8sDeployment
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
  const [history, setHistory] = useState<DeploymentRevision[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [rollbackRevision, setRollbackRevision] = useState<number | null>(null)
  const [rolling, setRolling] = useState(false)

  const matches = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kvMatches = (k: string, v: string): boolean => matches(k) || matches(v)

  const selectorEntries = Object.entries(deployment.selector).filter(([k, v]) =>
    kvMatches(k, v),
  )
  const labelEntries = Object.entries(deployment.labels ?? {}).filter(
    ([k, v]) => kvMatches(k, v),
  )
  const annotationEntries = Object.entries(deployment.annotations ?? {})
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kvMatches(k, v))
  const podLabelEntries = Object.entries(
    deployment.podTemplateLabels ?? {},
  ).filter(([k, v]) => kvMatches(k, v))

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const revisions = await window.api.k8s.getDeploymentHistory({
        contextName: selectedContext ?? undefined,
        namespace: deployment.namespace,
        name: deployment.name,
        selector: deployment.selector,
      })
      setHistory(revisions)
    } catch (e) {
      toast.error(`Failed to load rollout history: ${String(e)}`)
      useAppStore
        .getState()
        .addGlobalError(String(e), "Deployment: rollout history")
    } finally {
      setHistoryLoading(false)
    }
  }, [
    deployment.namespace,
    deployment.name,
    deployment.selector,
    selectedContext,
  ])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  async function handleRollback(): Promise<void> {
    if (rollbackRevision === null) return
    setRolling(true)
    try {
      await window.api.k8s.rollbackDeployment({
        contextName: selectedContext ?? undefined,
        namespace: deployment.namespace,
        name: deployment.name,
        revision: rollbackRevision,
      })
      toast.success(
        `Rolled back ${deployment.name} to revision ${rollbackRevision}`,
      )
      setRollbackRevision(null)
      await loadHistory()
    } catch (e) {
      toast.error(`Rollback failed: ${String(e)}`)
      useAppStore.getState().addGlobalError(String(e), "Deployment: rollback")
      setRollbackRevision(null)
    } finally {
      setRolling(false)
    }
  }

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    try {
      await window.api.k8s.deleteDeployment(
        deployment.namespace,
        deployment.name,
      )
      appendHistory({
        action: "delete",
        resourceKind: "Deployment",
        resourceName: deployment.name,
        namespace: deployment.namespace,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`Deployment ${deployment.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleted()
      onClose()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "Deployment",
        resourceName: deployment.name,
        namespace: deployment.namespace,
        context: selectedContext ?? "",
        success: false,
        error: String(e),
      })
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "Deployment: delete")
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
          <h2 className="font-semibold text-base mb-1">{deployment.name}</h2>
          <span className="text-xs text-muted-foreground">
            {deployment.namespace}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="Deployment"
            resourceName={deployment.name}
            namespace={deployment.namespace}
            buildYaml={() => ({
              apiVersion: "apps/v1",
              kind: "Deployment",
              metadata: {
                name: deployment.name,
                namespace: deployment.namespace,
              },
              spec: {
                replicas: deployment.replicas,
                selector: { matchLabels: deployment.selector },
                template: {
                  metadata: { labels: deployment.selector },
                  spec: {
                    containers: deployment.containers.map((c) => ({
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
            name={deployment.name}
            namespace={deployment.namespace}
            resourceKind="deployment"
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

      {/* Replicas & Strategy */}
      <div className="space-y-1">
        <SectionHeader title="Replicas" />
        <MetaEntry label="Desired" value={String(deployment.replicas)} />
        <MetaEntry label="Ready" value={String(deployment.readyReplicas)} />
        <MetaEntry
          label="Up-to-date"
          value={String(deployment.updatedReplicas)}
        />
        <MetaEntry
          label="Available"
          value={String(deployment.availableReplicas)}
        />
        <MetaEntry label="Strategy" value={deployment.strategy} />
        {deployment.rollingUpdate && (
          <>
            <MetaEntry
              label="Max Unavailable"
              value={deployment.rollingUpdate.maxUnavailable}
            />
            <MetaEntry
              label="Max Surge"
              value={deployment.rollingUpdate.maxSurge}
            />
          </>
        )}
        {deployment.minReadySeconds > 0 && (
          <MetaEntry
            label="Min Ready Seconds"
            value={String(deployment.minReadySeconds)}
          />
        )}
        <MetaEntry
          label="Created"
          value={new Date(deployment.creationTimestamp).toLocaleString()}
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

      {/* Pod Template */}
      {(podLabelEntries.length > 0 || deployment.serviceAccountName) && (
        <div className="space-y-1">
          <SectionHeader title="Pod Template" />
          {deployment.serviceAccountName &&
            matches(deployment.serviceAccountName) && (
              <MetaEntry
                label="Service Account"
                value={deployment.serviceAccountName}
              />
            )}
          {podLabelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={`label: ${k}`} value={v} />
          ))}
        </div>
      )}

      {/* Init Containers */}
      {deployment.initContainers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Init Containers" />
          {deployment.initContainers
            .filter((c) => matches(c.name) || matches(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Containers */}
      {deployment.containers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Containers" />
          {deployment.containers
            .filter((c) => matches(c.name) || matches(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Volumes */}
      {deployment.volumes.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Volumes" />
          {deployment.volumes
            .filter(
              (v) => matches(v.name) || matches(v.type) || matches(v.detail),
            )
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

      {/* Conditions */}
      {deployment.conditions.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Conditions" />
          {deployment.conditions.map((c) => (
            <div
              key={c.type}
              className="text-sm space-y-0.5 border rounded p-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.type}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs",
                    c.status === "True"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800",
                  )}
                >
                  {c.status}
                </span>
              </div>
              {c.reason && (
                <div className="text-xs text-muted-foreground">{c.reason}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Events */}
      <ResourceEventsSection
        namespace={deployment.namespace}
        name={deployment.name}
        kind="Deployment"
        search={sl}
      />

      {/* Rollout History */}
      <div className="space-y-1">
        <SectionHeader title="Rollout History" />
        {historyLoading && (
          <p className="text-xs text-muted-foreground">Loading...</p>
        )}
        {!historyLoading && history.length === 0 && (
          <p className="text-xs text-muted-foreground">No history found</p>
        )}
        {!historyLoading && history.length > 0 && (
          <div className="space-y-1">
            {history.map((rev) => (
              <div
                key={rev.revision}
                className="border rounded p-2 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium">#{rev.revision}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    onClick={() => setRollbackRevision(rev.revision)}
                  >
                    Rollback
                  </Button>
                </div>
                {rev.changeCause && (
                  <div className="text-muted-foreground">{rev.changeCause}</div>
                )}
                {rev.images.map((img) => (
                  <div key={img} className="text-muted-foreground break-all">
                    {img}
                  </div>
                ))}
                <div className="text-muted-foreground">
                  {new Date(rev.creationTimestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deployment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {deployment.namespace}/{deployment.name}
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

      <AlertDialog
        open={rollbackRevision !== null}
        onOpenChange={(open) => {
          if (!open) setRollbackRevision(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Deployment</AlertDialogTitle>
            <AlertDialogDescription>
              Roll back{" "}
              <strong>
                {deployment.namespace}/{deployment.name}
              </strong>{" "}
              to revision <strong>#{rollbackRevision}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setRollbackRevision(null)}
              disabled={rolling}
            >
              Cancel
            </Button>
            <Button onClick={handleRollback} disabled={rolling}>
              {rolling ? "Rolling back…" : "Rollback"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailPanelLayout>
  )
}

export function DeploymentsView(): JSX.Element {
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sDeployment | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: deployments,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listDeployments({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || deployments.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = deployments.find(
      (d) => d.name === item.name && d.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [deployments])

  const visibleDeployments = filterResources(
    deployments,
    nameFilter,
    selectedNamespace,
  )

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Deployments</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleDeployments.length === 0 && (
          <EmptyState message="No Deployments found" />
        )}
        {!loading && !error && visibleDeployments.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Ready</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Up-to-date
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Available</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleDeployments.map((d) => (
                  <TableRow
                    key={`${d.namespace}/${d.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === d.name &&
                        selectedItem?.namespace === d.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === d.name &&
                          selectedItem?.namespace === d.namespace
                          ? null
                          : d,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {d.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {d.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{`${d.readyReplicas}/${d.replicas}`}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {d.updatedReplicas}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {d.availableReplicas}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(d.creationTimestamp)}
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
          deployment={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleted={reload}
          onDeleteDialogChange={setDeleteDialogOpen}
        />
      )}
    </div>
  )
}
