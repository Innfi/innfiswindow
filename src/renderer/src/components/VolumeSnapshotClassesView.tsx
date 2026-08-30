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
import { K8sVolumeSnapshotClass } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

const DEFAULT_CLASS_ANNOTATION =
  "snapshot.storage.kubernetes.io/is-default-class"

function DefaultBadge(): JSX.Element {
  return (
    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900 dark:text-green-300">
      default
    </span>
  )
}

function DetailPanel({
  vsc,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  vsc: K8sVolumeSnapshotClass
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const paramEntries = Object.entries(vsc.parameters).filter(([k, v]) =>
    kv(k, v),
  )
  const labelEntries = Object.entries(vsc.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(vsc.annotations)
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
              <h2 className="font-semibold text-base mb-1 flex items-center gap-2">
                {vsc.name}
                {vsc.isDefault && <DefaultBadge />}
              </h2>
              <span className="text-xs text-muted-foreground">
                cluster-scoped
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="VolumeSnapshotClass"
                resourceName={vsc.name}
                buildYaml={() => ({
                  apiVersion: "snapshot.storage.k8s.io/v1",
                  kind: "VolumeSnapshotClass",
                  metadata: {
                    name: vsc.name,
                    ...(Object.keys(vsc.labels).length > 0 && {
                      labels: vsc.labels,
                    }),
                    ...(vsc.isDefault && {
                      annotations: { [DEFAULT_CLASS_ANNOTATION]: "true" },
                    }),
                  },
                  driver: vsc.driver,
                  deletionPolicy: vsc.deletionPolicy,
                  ...(Object.keys(vsc.parameters).length > 0 && {
                    parameters: vsc.parameters,
                  }),
                })}
              />
              <DeleteButton
                resourceKind="VolumeSnapshotClass"
                resourceName={vsc.name}
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
        <MetaEntry label="Driver" value={vsc.driver || "—"} mono />
        <MetaEntry label="Deletion Policy" value={vsc.deletionPolicy || "—"} />
        <MetaEntry label="Default Class" value={vsc.isDefault ? "Yes" : "No"} />
        <MetaEntry
          label="Created"
          value={new Date(vsc.creationTimestamp).toLocaleString()}
        />
      </div>

      {paramEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Parameters" />
          {paramEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} mono />
          ))}
        </div>
      )}

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

      <ResourceEventsSection
        namespace=""
        name={vsc.name}
        kind="VolumeSnapshotClass"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function VolumeSnapshotClassesView(): JSX.Element {
  return (
    <ResourceListView<K8sVolumeSnapshotClass>
      batch={{ resourceKind: "VolumeSnapshotClass" }}
      title="Volume Snapshot Classes"
      emptyMessage="No VolumeSnapshotClasses found"
      namespaced={false}
      list={(ctx) =>
        window.api.k8s.listVolumeSnapshotClasses({ contextName: ctx })
      }
      detailGuard={(item) =>
        (item as K8sVolumeSnapshotClass).driver !== undefined
      }
      columns={[
        {
          head: "Name",
          cell: (vsc) => (
            <span className="flex items-center gap-2">
              {vsc.name}
              {vsc.isDefault && <DefaultBadge />}
            </span>
          ),
          className: "font-medium",
        },
        {
          head: "Driver",
          cell: (vsc) => vsc.driver || "—",
          className: "font-mono text-xs",
        },
        { head: "Deletion Policy", cell: (vsc) => vsc.deletionPolicy || "—" },
        {
          head: "Parameters",
          cell: (vsc) => Object.keys(vsc.parameters).length || "—",
        },
        ageColumn<K8sVolumeSnapshotClass>(),
      ]}
      renderDetail={(vsc, ctl: DetailController) => (
        <DetailPanel
          vsc={vsc}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
