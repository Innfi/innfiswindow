import { useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
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
import { K8sVolumeSnapshot } from "../types/k8s"

function ReadyBadge({ ready }: { ready: boolean | null }): JSX.Element {
  if (ready === null) {
    return <span className="text-muted-foreground">Unknown</span>
  }
  return ready ? (
    <span className="text-green-600 dark:text-green-400 font-semibold">
      Ready
    </span>
  ) : (
    <span className="text-amber-600 dark:text-amber-400 font-semibold">
      Not Ready
    </span>
  )
}

function DetailPanel({
  snap,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  snap: K8sVolumeSnapshot
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(snap.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(snap.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1">{snap.name}</h2>
              <span className="text-xs text-muted-foreground">
                {snap.namespace}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="VolumeSnapshot"
                resourceName={snap.name}
                namespace={snap.namespace}
                buildYaml={() => ({
                  apiVersion: "snapshot.storage.k8s.io/v1",
                  kind: "VolumeSnapshot",
                  metadata: {
                    name: snap.name,
                    namespace: snap.namespace,
                    ...(Object.keys(snap.labels).length > 0 && {
                      labels: snap.labels,
                    }),
                  },
                  spec: {
                    ...(snap.volumeSnapshotClassName && {
                      volumeSnapshotClassName: snap.volumeSnapshotClassName,
                    }),
                    source: { persistentVolumeClaimName: snap.sourcePVCName },
                  },
                })}
              />
              <DeleteButton
                resourceKind="VolumeSnapshot"
                resourceName={snap.name}
                namespace={snap.namespace}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
              />
              <ClosePanelButton onClose={onClose} />
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
      <div className="space-y-1">
        <SectionHeader title="Spec" />
        <MetaEntry label="Source PVC" value={snap.sourcePVCName || "—"} mono />
        <MetaEntry
          label="Snapshot Class"
          value={snap.volumeSnapshotClassName || "—"}
        />
        <MetaEntry
          label="Created"
          value={new Date(snap.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <SectionHeader title="Status" />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground text-xs w-28 shrink-0">
            Ready
          </span>
          <ReadyBadge ready={snap.readyToUse} />
        </div>
        <MetaEntry label="Restore Size" value={snap.restoreSize || "—"} />
      </div>

      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          {labelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}
    </DetailPanelLayout>
  )
}

export function VolumeSnapshotsView(): JSX.Element {
  return (
    <ResourceListView<K8sVolumeSnapshot>
      batch={{ resourceKind: "VolumeSnapshot" }}
      title="Volume Snapshots"
      emptyMessage="No VolumeSnapshots found"
      list={(ctx, ns) =>
        window.api.k8s.listVolumeSnapshots({ contextName: ctx, namespace: ns })
      }
      detailGuard={(item) =>
        (item as K8sVolumeSnapshot).sourcePVCName !== undefined
      }
      columns={[
        { head: "Name", cell: (snap) => snap.name, className: "font-medium" },
        { head: "Namespace", cell: (snap) => snap.namespace },
        {
          head: "Source PVC",
          cell: (snap) => snap.sourcePVCName || "—",
          className: "font-mono text-xs",
        },
        {
          head: "Snapshot Class",
          cell: (snap) => snap.volumeSnapshotClassName || "—",
        },
        {
          head: "Ready",
          cell: (snap) => <ReadyBadge ready={snap.readyToUse} />,
        },
        { head: "Size", cell: (snap) => snap.restoreSize || "—" },
        ageColumn<K8sVolumeSnapshot>(),
      ]}
      renderDetail={(snap, ctl: DetailController) => (
        <DetailPanel
          snap={snap}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
