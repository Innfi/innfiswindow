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
import { K8sStatefulSet } from "../types/k8s"
import { ContainerCard } from "./ContainerCard"
import { ResourceEventsSection } from "./ResourceEventsSection"

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
  return (
    <ResourceListView<K8sStatefulSet>
      title="StatefulSets"
      emptyMessage="No Stateful Sets found"
      list={(ctx) => window.api.k8s.listStatefulSets({ contextName: ctx })}
      detailGuard={(item) => (item as K8sStatefulSet).serviceName !== undefined}
      columns={[
        { head: "Name", cell: (ss) => ss.name },
        { head: "Namespace", cell: (ss) => ss.namespace },
        { head: "Ready", cell: (ss) => `${ss.readyReplicas}/${ss.replicas}` },
        ageColumn<K8sStatefulSet>(),
        { head: "Service", cell: (ss) => ss.serviceName },
      ]}
      renderDetail={(ss, ctl: DetailController) => (
        <DetailPanel
          ss={ss}
          onClose={ctl.onClose}
          onDeleted={() => {
            ctl.onDeleted()
            ctl.onClose()
          }}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
