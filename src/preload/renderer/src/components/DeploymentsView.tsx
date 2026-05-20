import { dump as yamlDump } from "js-yaml"
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
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

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
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [history, setHistory] = useState<DeploymentRevision[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [rollbackRevision, setRollbackRevision] = useState<number | null>(null)
  const [rolling, setRolling] = useState(false)
  const selectorEntries = Object.entries(deployment.selector)

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
      setRollbackRevision(null)
    } finally {
      setRolling(false)
    }
  }

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  function handleEdit(): void {
    const obj = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: deployment.name, namespace: deployment.namespace },
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
    }
    openDrawerTab({
      tabKey: `yaml-edit:Deployment:${deployment.namespace}/${deployment.name}`,
      type: "yaml-edit",
      resourceKind: "Deployment",
      resourceName: deployment.name,
      namespace: deployment.namespace,
      initialYaml: yamlDump(obj),
    })
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    try {
      await window.api.k8s.deleteDeployment(
        deployment.namespace,
        deployment.name,
      )
      toast.success(`Deployment ${deployment.name} deleted`)
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
          <h2 className="font-semibold text-base mb-1">{deployment.name}</h2>
          <span className="text-xs text-muted-foreground">
            {deployment.namespace}
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
            onClick={() => setDeleteOpenNotify(true)}
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

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Replicas
        </h3>
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
        <MetaEntry
          label="Created"
          value={new Date(deployment.creationTimestamp).toLocaleString()}
        />
      </div>

      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Selector
          </h3>
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {deployment.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {deployment.containers.map((c) => (
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

      {deployment.conditions.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Conditions
          </h3>
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

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Rollout History
        </h3>
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
    </div>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Up-to-date</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Age</TableHead>
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
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{d.namespace}</TableCell>
                  <TableCell>{`${d.readyReplicas}/${d.replicas}`}</TableCell>
                  <TableCell>{d.updatedReplicas}</TableCell>
                  <TableCell>{d.availableReplicas}</TableCell>
                  <TableCell>{formatAge(d.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
