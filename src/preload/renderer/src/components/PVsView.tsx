import { X } from "lucide-react"
import { useEffect } from "react"

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
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

function pvStatusClass(status: string): string {
  if (status === "Bound") return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
  if (status === "Pending") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
  if (status === "Lost") return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
  return "bg-muted text-muted-foreground"
}

function DetailPanel({
  pv,
  onClose,
}: {
  pv: K8sPV
  onClose: () => void
}): JSX.Element {
  const labelEntries = Object.entries(pv.labels)
  const annotationEntries = Object.entries(pv.annotations)

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <h2 className="font-semibold text-base mb-1 flex-1 truncate">{pv.name}</h2>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-1"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Spec
        </h3>
        <MetaEntry label="Capacity" value={pv.capacity || "-"} />
        <MetaEntry label="Access Modes" value={pv.accessModes.join(", ") || "-"} />
        <MetaEntry label="Reclaim Policy" value={pv.reclaimPolicy || "-"} />
        <MetaEntry label="Volume Mode" value={pv.volumeMode || "-"} />
        <MetaEntry label="Storage Class" value={pv.storageClass || "-"} />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Status
        </h3>
        <div className="flex items-center gap-2">
          <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", pvStatusClass(pv.status))}>
            {pv.status || "-"}
          </span>
        </div>
        {pv.claimRef && (
          <MetaEntry label="Claim" value={`${pv.claimRef.namespace}/${pv.claimRef.name}`} />
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Metadata
        </h3>
        <MetaEntry label="Age" value={formatAge(pv.creationTimestamp)} />
      </div>

      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Labels
          </h3>
          {labelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Annotations
          </h3>
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}
    </div>
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
    (p) => !nameFilter || p.name.toLowerCase().includes(nameFilter.toLowerCase()),
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Access Modes</TableHead>
                <TableHead>Reclaim Policy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Claim</TableHead>
                <TableHead>StorageClass</TableHead>
                <TableHead>Age</TableHead>
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
                    setSelectedItem(selectedItem?.name === pv.name ? null : pv)
                  }
                >
                  <TableCell>{pv.name}</TableCell>
                  <TableCell>{pv.capacity}</TableCell>
                  <TableCell>{pv.accessModes.join(", ")}</TableCell>
                  <TableCell>{pv.reclaimPolicy}</TableCell>
                  <TableCell>
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", pvStatusClass(pv.status))}>
                      {pv.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {pv.claimRef
                      ? `${pv.claimRef.namespace}/${pv.claimRef.name}`
                      : "-"}
                  </TableCell>
                  <TableCell>{pv.storageClass || "-"}</TableCell>
                  <TableCell>{formatAge(pv.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && !("namespace" in selectedItem) && (
        <DetailPanel pv={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
