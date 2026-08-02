import { useState } from "react"
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
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { useAppStore } from "../../store/app.store"
import { useRecordHistory } from "../hooks/useRecordHistory"
import { K8sDaemonSet, K8sDaemonSetSummary } from "../types/k8s"
import { ContainerCard } from "./ContainerCard"
import { ResourceEventsSection } from "./ResourceEventsSection"

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
  const recordHistory = useRecordHistory()
  const [restartOpen, setRestartOpen] = useState(false)
  const [restarting, setRestarting] = useState(false)
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

  async function handleRestart(): Promise<void> {
    const target = {
      action: "restart",
      resourceKind: "DaemonSet",
      resourceName: ds.name,
      namespace: ds.namespace,
    } as const
    setRestarting(true)
    try {
      await window.api.k8s.restartDaemonSet({
        contextName: selectedContext ?? undefined,
        namespace: ds.namespace,
        name: ds.name,
      })
      recordHistory(target, { success: true })
      toast.success(`Restarting ${ds.name}`)
      setRestartOpen(false)
    } catch (e) {
      recordHistory(target, { success: false, error: String(e) })
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "DaemonSet: restart")
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
              <h2 className="font-semibold text-base mb-1">{ds.name}</h2>
              <span className="text-xs text-muted-foreground">
                {ds.namespace}
              </span>
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
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setRestartOpen(true)}
              >
                Restart
              </Button>
              <DeleteButton
                resourceKind="DaemonSet"
                resourceName={ds.name}
                namespace={ds.namespace}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
              />
              <CopyResourceButton
                name={ds.name}
                namespace={ds.namespace}
                resourceKind="daemonset"
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

      <AlertDialog open={restartOpen} onOpenChange={setRestartOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restart DaemonSet</AlertDialogTitle>
            <AlertDialogDescription>
              Trigger a rolling restart of{" "}
              <strong>
                {ds.namespace}/{ds.name}
              </strong>
              ? Pods will be recreated on every node.
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
    </DetailPanelLayout>
  )
}

export function DaemonSetsView(): JSX.Element {
  return (
    <ResourceListView<K8sDaemonSetSummary, K8sDaemonSet>
      title="DaemonSets"
      emptyMessage="No Daemon Sets found"
      list={(ctx, ns) =>
        window.api.k8s.listDaemonSets({ contextName: ctx, namespace: ns })
      }
      getDetail={(ctx, namespace, name) =>
        window.api.k8s.getDaemonSet({ contextName: ctx, namespace, name })
      }
      detailGuard={(item) =>
        (item as K8sDaemonSetSummary).desiredNumberScheduled !== undefined
      }
      columns={[
        { head: "Name", cell: (ds) => ds.name },
        { head: "Namespace", cell: (ds) => ds.namespace },
        { head: "Desired", cell: (ds) => ds.desiredNumberScheduled },
        { head: "Current", cell: (ds) => ds.currentNumberScheduled },
        { head: "Ready", cell: (ds) => ds.numberReady },
        { head: "Up-to-date", cell: (ds) => ds.updatedNumberScheduled },
        { head: "Available", cell: (ds) => ds.numberAvailable },
        ageColumn<K8sDaemonSetSummary>(),
      ]}
      renderDetail={(ds, ctl: DetailController) => (
        <DetailPanel
          ds={ds}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
