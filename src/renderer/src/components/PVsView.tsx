import { useState } from "react"

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
import { K8sPV } from "../types/k8s"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

function pvStatusClass(status: string): string {
  if (status === "Bound")
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
  if (status === "Pending")
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
  if (status === "Lost")
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
  return "bg-muted text-muted-foreground"
}

function DetailPanel({
  pv,
  onClose,
}: {
  pv: K8sPV
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(pv.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(pv.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  return (
    <DetailPanelLayout>
      {/* Header */}
      <div className="flex items-start justify-between">
        <h2 className="font-semibold text-base mb-1 flex-1 truncate pr-2">
          {pv.name}
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          <EditButton
            resourceKind="PersistentVolume"
            resourceName={pv.name}
            buildYaml={() => ({
              apiVersion: "v1",
              kind: "PersistentVolume",
              metadata: {
                name: pv.name,
                labels: pv.labels,
                annotations: pv.annotations,
              },
              spec: {
                capacity: { storage: pv.capacity },
                accessModes: pv.accessModes,
                persistentVolumeReclaimPolicy: pv.reclaimPolicy,
                volumeMode: pv.volumeMode,
                storageClassName: pv.storageClass,
              },
            })}
          />
          <CopyResourceButton name={pv.name} resourceKind="persistentvolume" />
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

      {/* Spec */}
      <div className="space-y-1">
        <SectionHeader title="Spec" />
        <MetaEntry label="Capacity" value={pv.capacity || "-"} />
        <MetaEntry
          label="Access Modes"
          value={pv.accessModes.join(", ") || "-"}
        />
        <MetaEntry label="Reclaim Policy" value={pv.reclaimPolicy || "-"} />
        <MetaEntry label="Volume Mode" value={pv.volumeMode || "-"} />
        <MetaEntry label="Storage Class" value={pv.storageClass || "-"} />
        <MetaEntry
          label="Created"
          value={new Date(pv.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Status */}
      <div className="space-y-1">
        <SectionHeader title="Status" />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium",
              pvStatusClass(pv.status),
            )}
          >
            {pv.status || "-"}
          </span>
        </div>
        {pv.claimRef && m(`${pv.claimRef.namespace}/${pv.claimRef.name}`) && (
          <MetaEntry
            label="Claim"
            value={`${pv.claimRef.namespace}/${pv.claimRef.name}`}
          />
        )}
      </div>

      {/* Source */}
      {pv.source && m(pv.source.type) && (
        <div className="space-y-1">
          <SectionHeader title="Source" />
          <MetaEntry label="Type" value={pv.source.type} />
          {pv.source.detail && m(pv.source.detail) && (
            <MetaEntry label="Detail" value={pv.source.detail} mono />
          )}
        </div>
      )}

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

      {/* Events — PVs are cluster-scoped */}
      <ResourceEventsSection
        namespace=""
        name={pv.name}
        kind="PersistentVolume"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function PVsView(): JSX.Element {
  return (
    <ResourceListView<K8sPV>
      title="PersistentVolumes"
      namespaced={false}
      list={(ctx) => window.api.k8s.listPVs({ contextName: ctx })}
      detailGuard={(item) => !("namespace" in item)}
      columns={[
        { head: "Name", cell: (pv) => pv.name },
        { head: "Capacity", cell: (pv) => pv.capacity },
        { head: "Access Modes", cell: (pv) => pv.accessModes.join(", ") },
        { head: "Reclaim Policy", cell: (pv) => pv.reclaimPolicy },
        {
          head: "Status",
          cell: (pv) => (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium",
                pvStatusClass(pv.status),
              )}
            >
              {pv.status}
            </span>
          ),
        },
        {
          head: "Claim",
          cell: (pv) =>
            pv.claimRef ? `${pv.claimRef.namespace}/${pv.claimRef.name}` : "-",
        },
        { head: "StorageClass", cell: (pv) => pv.storageClass || "-" },
        ageColumn<K8sPV>(),
      ]}
      renderDetail={(pv, ctl: DetailController) => (
        <DetailPanel pv={pv} onClose={ctl.onClose} />
      )}
    />
  )
}
