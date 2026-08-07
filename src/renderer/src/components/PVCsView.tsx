import { useState } from "react"

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
import { cn } from "../../lib/utils"
import { K8sPVC } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function pvcStatusClass(status: string): string {
  if (status === "Bound")
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
  if (status === "Pending")
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
  if (status === "Lost")
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
  return "bg-muted text-muted-foreground"
}

function DetailPanel({
  pvc,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  pvc: K8sPVC
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(pvc.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(pvc.annotations)
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
              <h2 className="font-semibold text-base mb-1">{pvc.name}</h2>
              <span className="text-xs text-muted-foreground">
                {pvc.namespace}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="PersistentVolumeClaim"
                resourceName={pvc.name}
                namespace={pvc.namespace}
                buildYaml={() => ({
                  apiVersion: "v1",
                  kind: "PersistentVolumeClaim",
                  metadata: {
                    name: pvc.name,
                    namespace: pvc.namespace,
                    labels: pvc.labels,
                    annotations: pvc.annotations,
                  },
                  spec: {
                    accessModes: pvc.accessModes,
                    storageClassName: pvc.storageClass,
                    resources: { requests: { storage: pvc.capacity } },
                  },
                })}
              />
              <DeleteButton
                resourceKind="PersistentVolumeClaim"
                resourceName={pvc.name}
                namespace={pvc.namespace}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
              />
              <CopyResourceButton
                name={pvc.name}
                namespace={pvc.namespace}
                resourceKind="persistentvolumeclaim"
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
      {/* Status */}
      <div className="space-y-1">
        <SectionHeader title="Status" />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium",
              pvcStatusClass(pvc.status),
            )}
          >
            {pvc.status || "-"}
          </span>
        </div>
        {pvc.volumeName && m(pvc.volumeName) && (
          <MetaEntry label="Volume" value={pvc.volumeName} />
        )}
      </div>

      {/* Spec */}
      <div className="space-y-1">
        <SectionHeader title="Spec" />
        <MetaEntry label="Capacity" value={pvc.capacity || "-"} />
        <MetaEntry
          label="Access Modes"
          value={pvc.accessModes.join(", ") || "-"}
        />
        <MetaEntry label="Storage Class" value={pvc.storageClass || "-"} />
        {pvc.volumeMode && m(pvc.volumeMode) && (
          <MetaEntry label="Volume Mode" value={pvc.volumeMode} />
        )}
        <MetaEntry
          label="Created"
          value={new Date(pvc.creationTimestamp).toLocaleString()}
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

      {/* Events */}
      <ResourceEventsSection
        namespace={pvc.namespace}
        name={pvc.name}
        kind="PersistentVolumeClaim"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function PVCsView(): JSX.Element {
  return (
    <ResourceListView<K8sPVC>
      title="PersistentVolumeClaims"
      list={(ctx, ns) =>
        window.api.k8s.listPVCs({ contextName: ctx, namespace: ns })
      }
      detailGuard={(item) => (item as K8sPVC).namespace !== undefined}
      columns={[
        { head: "Name", cell: (pvc) => pvc.name },
        { head: "Namespace", cell: (pvc) => pvc.namespace },
        {
          head: "Status",
          cell: (pvc) => (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium",
                pvcStatusClass(pvc.status),
              )}
            >
              {pvc.status}
            </span>
          ),
        },
        { head: "Volume", cell: (pvc) => pvc.volumeName || "-" },
        { head: "Capacity", cell: (pvc) => pvc.capacity || "-" },
        { head: "Access Modes", cell: (pvc) => pvc.accessModes.join(", ") },
        { head: "StorageClass", cell: (pvc) => pvc.storageClass || "-" },
        ageColumn<K8sPVC>(),
      ]}
      renderDetail={(pvc, ctl: DetailController) => (
        <DetailPanel
          pvc={pvc}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
