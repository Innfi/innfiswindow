import { X } from "lucide-react"
import { useEffect, useState } from "react"

import { DetailPanelLayout } from "../../components/DetailPanelLayout"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { EmptyState } from "../../components/ui/EmptyState"
import { RefreshBar } from "../../components/ui/RefreshBar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sPV } from "../types/k8s"
import { EditButton } from "./EditButton"
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
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
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
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sPV | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: pvs,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listPVs({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || pvs.length === 0) return
    const item = selectedItem as { name: string }
    const fresh = pvs.find((p) => p.name === item.name)
    if (fresh) setSelectedItem(fresh as object)
  }, [pvs])

  const visiblePVs = pvs.filter(
    (p) =>
      !nameFilter || p.name.toLowerCase().includes(nameFilter.toLowerCase()),
  )

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">PersistentVolumes</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visiblePVs.length === 0 && (
          <EmptyState message="No PersistentVolumes found" />
        )}
        {!loading && !error && visiblePVs.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Capacity</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Access Modes
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Reclaim Policy
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Claim</TableHead>
                  <TableHead className="whitespace-nowrap">
                    StorageClass
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePVs.map((pv) => (
                  <TableRow
                    key={pv.name}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === pv.name && "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === pv.name ? null : pv,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {pv.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {pv.capacity}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {pv.accessModes.join(", ")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {pv.reclaimPolicy}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs font-medium",
                          pvStatusClass(pv.status),
                        )}
                      >
                        {pv.status}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {pv.claimRef
                        ? `${pv.claimRef.namespace}/${pv.claimRef.name}`
                        : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {pv.storageClass || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(pv.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && !("namespace" in selectedItem) && (
        <DetailPanel pv={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
