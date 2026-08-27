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
import { K8sStorageClass } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  sc,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  sc: K8sStorageClass
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const paramEntries = Object.entries(sc.parameters).filter(([k, v]) =>
    kv(k, v),
  )
  const labelEntries = Object.entries(sc.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(sc.annotations)
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
              <h2 className="font-semibold text-base mb-1">{sc.name}</h2>
              <span className="text-xs text-muted-foreground">
                cluster-scoped
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="StorageClass"
                resourceName={sc.name}
                buildYaml={() => ({
                  apiVersion: "storage.k8s.io/v1",
                  kind: "StorageClass",
                  metadata: {
                    name: sc.name,
                    ...(Object.keys(sc.labels).length > 0 && {
                      labels: sc.labels,
                    }),
                  },
                  provisioner: sc.provisioner,
                  reclaimPolicy: sc.reclaimPolicy,
                  volumeBindingMode: sc.volumeBindingMode,
                  allowVolumeExpansion: sc.allowVolumeExpansion,
                  ...(Object.keys(sc.parameters).length > 0 && {
                    parameters: sc.parameters,
                  }),
                })}
              />
              <DeleteButton
                resourceKind="StorageClass"
                resourceName={sc.name}
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
        <MetaEntry label="Provisioner" value={sc.provisioner} mono />
        <MetaEntry label="Reclaim Policy" value={sc.reclaimPolicy || "—"} />
        <MetaEntry
          label="Volume Binding Mode"
          value={sc.volumeBindingMode || "—"}
        />
        <MetaEntry
          label="Allow Volume Expansion"
          value={sc.allowVolumeExpansion ? "Yes" : "No"}
        />
        <MetaEntry
          label="Created"
          value={new Date(sc.creationTimestamp).toLocaleString()}
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
        name={sc.name}
        kind="StorageClass"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function StorageClassesView(): JSX.Element {
  return (
    <ResourceListView<K8sStorageClass>
      batch={{ resourceKind: "StorageClass" }}
      title="Storage Classes"
      emptyMessage="No StorageClasses found"
      namespaced={false}
      list={(ctx) => window.api.k8s.listStorageClasses({ contextName: ctx })}
      detailGuard={(item) =>
        (item as K8sStorageClass).provisioner !== undefined
      }
      columns={[
        { head: "Name", cell: (sc) => sc.name, className: "font-medium" },
        {
          head: "Provisioner",
          cell: (sc) => sc.provisioner,
          className: "font-mono text-xs",
        },
        { head: "Reclaim Policy", cell: (sc) => sc.reclaimPolicy || "—" },
        { head: "Binding Mode", cell: (sc) => sc.volumeBindingMode || "—" },
        {
          head: "Expandable",
          cell: (sc) => (sc.allowVolumeExpansion ? "Yes" : "No"),
        },
        ageColumn<K8sStorageClass>(),
      ]}
      renderDetail={(sc, ctl: DetailController) => (
        <DetailPanel
          sc={sc}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
