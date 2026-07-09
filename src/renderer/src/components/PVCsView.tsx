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
import { cn, filterResources, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sPVC } from "../types/k8s"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

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
    <DetailPanelLayout>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{pvc.name}</h2>
          <span className="text-xs text-muted-foreground">{pvc.namespace}</span>
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

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
      />

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
