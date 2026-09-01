import { Pause, Play, RotateCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/AlertDialog"
import { Button } from "../../components/ui/Button"
import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DeleteButton } from "../../components/ui/DeleteButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { EditButton } from "../../components/ui/EditButton"
import { MetaEntry } from "../../components/ui/MetaEntry"
import { PauseRolloutButton } from "../../components/ui/PauseRolloutButton"
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { ScaleButton } from "../../components/ui/ScaleButton"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useRecordHistory } from "../hooks/useRecordHistory"
import { K8sDeployment, K8sDeploymentSummary } from "../types/k8s"
import { ContainerCard } from "./ContainerCard"
import { ResourceEventsSection } from "./ResourceEventsSection"

type DeploymentRevision = {
  revision: number
  changeCause: string
  images: string[]
  creationTimestamp: string
}

function DetailPanel({
  deployment,
  onClose,
  onReloaded,
  onDeleted,
  onDeleteDialogChange,
}: {
  deployment: K8sDeployment
  onClose: () => void
  onReloaded: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()
  const [history, setHistory] = useState<DeploymentRevision[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [rollbackRevision, setRollbackRevision] = useState<number | null>(null)
  const [rolling, setRolling] = useState(false)
  const [restartOpen, setRestartOpen] = useState(false)
  const [restarting, setRestarting] = useState(false)

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

  async function handleRestart(): Promise<void> {
    const target = {
      action: "restart",
      resourceKind: "Deployment",
      resourceName: deployment.name,
      namespace: deployment.namespace,
    } as const
    setRestarting(true)
    try {
      await window.api.k8s.restartDeployment({
        contextName: selectedContext ?? undefined,
        namespace: deployment.namespace,
        name: deployment.name,
      })
      recordHistory(target, { success: true })
      toast.success(`Restarting ${deployment.name}`)
      setRestartOpen(false)
    } catch (e) {
      recordHistory(target, { success: false, error: String(e) })
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "Deployment: restart")
      setRestartOpen(false)
    } finally {
      setRestarting(false)
    }
  }

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1">
                {deployment.name}
              </h2>
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
              <ScaleButton
                resourceKind="Deployment"
                resourceName={deployment.name}
                namespace={deployment.namespace}
                currentReplicas={deployment.replicas}
                onScaled={onReloaded}
                onDialogChange={onDeleteDialogChange}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setRestartOpen(true)}
              >
                Restart
              </Button>
              <PauseRolloutButton
                resourceKind="Deployment"
                resourceName={deployment.name}
                namespace={deployment.namespace}
                paused={deployment.paused}
                onChanged={onReloaded}
                onDialogChange={onDeleteDialogChange}
              />
              <DeleteButton
                resourceKind="Deployment"
                resourceName={deployment.name}
                namespace={deployment.namespace}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
              />
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
        </>
      }
    >
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
        <MetaEntry label="Paused" value={deployment.paused ? "Yes" : "No"} />
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

      <AlertDialog open={restartOpen} onOpenChange={setRestartOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restart Deployment</AlertDialogTitle>
            <AlertDialogDescription>
              Trigger a rolling restart of{" "}
              <strong>
                {deployment.namespace}/{deployment.name}
              </strong>
              ? All pods will be recreated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestartOpen(false)}
              disabled={restarting}
            >
              Cancel
            </Button>
            <Button onClick={handleRestart} disabled={restarting}>
              {restarting ? "Restarting…" : "Restart"}
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
          {deployment.paused && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              This Deployment&apos;s rollout is paused: the old pod template is
              written now but no pods are replaced until it is resumed.
            </p>
          )}
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
    <ResourceListView<K8sDeploymentSummary, K8sDeployment>
      title="Deployments"
      batch={{
        resourceKind: "Deployment",
        actions: [
          {
            label: "Restart",
            runningLabel: "Restarting",
            action: "restart",
            icon: RotateCw,
            warning:
              "Every selected Deployment rolls its pods, one Deployment at a time.",
            run: (d, ctx) =>
              window.api.k8s.restartDeployment({
                contextName: ctx,
                namespace: d.namespace,
                name: d.name,
              }),
          },
          {
            label: "Pause",
            runningLabel: "Pausing",
            action: "pause",
            icon: Pause,
            warning:
              "Pods keep running, but no template change rolls out on a paused Deployment until it is resumed.",
            run: (d, ctx) =>
              window.api.k8s.setDeploymentPaused({
                contextName: ctx,
                namespace: d.namespace,
                name: d.name,
                paused: true,
              }),
          },
          {
            label: "Resume",
            runningLabel: "Resuming",
            action: "resume",
            icon: Play,
            run: (d, ctx) =>
              window.api.k8s.setDeploymentPaused({
                contextName: ctx,
                namespace: d.namespace,
                name: d.name,
                paused: false,
              }),
          },
        ],
      }}
      list={(ctx, ns) =>
        window.api.k8s.listDeployments({ contextName: ctx, namespace: ns })
      }
      getDetail={(ctx, namespace, name) =>
        window.api.k8s.getDeployment({ contextName: ctx, namespace, name })
      }
      detailGuard={(item) =>
        (item as K8sDeploymentSummary).updatedReplicas !== undefined
      }
      rowClassName={(d) =>
        d.readyReplicas < d.replicas
          ? "bg-red-50 dark:bg-red-950/30"
          : undefined
      }
      columns={[
        { head: "Name", cell: (d) => d.name },
        { head: "Namespace", cell: (d) => d.namespace },
        { head: "Ready", cell: (d) => `${d.readyReplicas}/${d.replicas}` },
        { head: "Up-to-date", cell: (d) => d.updatedReplicas },
        { head: "Available", cell: (d) => d.availableReplicas },
        { head: "Paused", cell: (d) => (d.paused ? "Yes" : "No") },
        ageColumn<K8sDeploymentSummary>(),
      ]}
      renderDetail={(deployment, ctl: DetailController) => (
        <DetailPanel
          deployment={deployment}
          onClose={ctl.onClose}
          onReloaded={ctl.onDeleted}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
