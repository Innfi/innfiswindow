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
import { cn, filterResources, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sPVC } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

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
}: {
  pvc: K8sPVC
  onClose: () => void
}): JSX.Element {
  const labelEntries = Object.entries(pvc.labels)
  const annotationEntries = Object.entries(pvc.annotations)

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{pvc.name}</h2>
          <span className="text-xs text-muted-foreground">{pvc.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <CopyResourceButton
            name={pvc.name}
            namespace={pvc.namespace}
            resourceKind="persistentvolumeclaim"
          />
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Status
        </h3>
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
        <MetaEntry label="Volume" value={pvc.volumeName || "-"} />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Spec
        </h3>
        <MetaEntry label="Capacity" value={pvc.capacity || "-"} />
        <MetaEntry
          label="Access Modes"
          value={pvc.accessModes.join(", ") || "-"}
        />
        <MetaEntry label="Storage Class" value={pvc.storageClass || "-"} />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Metadata
        </h3>
        <MetaEntry label="Age" value={formatAge(pvc.creationTimestamp)} />
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

export function PVCsView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sPVC | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: pvcs,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listPVCs({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || pvcs.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = pvcs.find(
      (p) => p.name === item.name && p.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [pvcs])

  const visiblePVCs = filterResources(pvcs, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">PersistentVolumeClaims</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visiblePVCs.length === 0 && (
          <EmptyState message="No PersistentVolumeClaims found" />
        )}
        {!loading && !error && visiblePVCs.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Volume</TableHead>
                  <TableHead className="whitespace-nowrap">Capacity</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Access Modes
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    StorageClass
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePVCs.map((pvc) => (
                  <TableRow
                    key={`${pvc.namespace}/${pvc.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === pvc.name &&
                        selectedItem?.namespace === pvc.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === pvc.name &&
                          selectedItem?.namespace === pvc.namespace
                          ? null
                          : pvc,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {pvc.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {pvc.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs font-medium",
                          pvcStatusClass(pvc.status),
                        )}
                      >
                        {pvc.status}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {pvc.volumeName || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {pvc.capacity || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {pvc.accessModes.join(", ")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {pvc.storageClass || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(pvc.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.namespace !== undefined && (
        <DetailPanel pvc={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
