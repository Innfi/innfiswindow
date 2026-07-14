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
import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { EditButton } from "../../components/ui/EditButton"
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { K8sDeployment } from "../types/k8s"
import { ContainerCard } from "./ContainerCard"
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
          <ClosePanelButton onClose={onClose} className="ml-1" />
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
  return (
    <ResourceListView<K8sDeployment>
      title="Deployments"
      list={(ctx) => window.api.k8s.listDeployments({ contextName: ctx })}
      detailGuard={(item) => (item as K8sDeployment).namespace !== undefined}
      columns={[
        { head: "Name", cell: (d) => d.name },
        { head: "Namespace", cell: (d) => d.namespace },
        { head: "Ready", cell: (d) => `${d.readyReplicas}/${d.replicas}` },
        { head: "Up-to-date", cell: (d) => d.updatedReplicas },
        { head: "Available", cell: (d) => d.availableReplicas },
        ageColumn<K8sDeployment>(),
      ]}
      renderDetail={(deployment, ctl: DetailController) => (
        <DetailPanel
          deployment={deployment}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
