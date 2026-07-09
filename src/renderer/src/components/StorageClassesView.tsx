import { X } from "lucide-react"
import { useEffect, useState } from "react"

import { DetailPanelLayout } from "../../components/DetailPanelLayout"
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
import { K8sStorageClass } from "../types/k8s"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

function DetailPanel({
  sc,
  onClose,
}: {
  sc: K8sStorageClass
  onClose: () => void
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
    <DetailPanelLayout>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{sc.name}</h2>
          <span className="text-xs text-muted-foreground">cluster-scoped</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
      />

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
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sStorageClass | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: storageClasses,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listStorageClasses({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || storageClasses.length === 0) return
    const fresh = storageClasses.find((sc) => sc.name === selectedItem.name)
    if (fresh) setSelectedItem(fresh as object)
  }, [storageClasses])

  const visible = filterResources(storageClasses, nameFilter, "")

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Storage Classes</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message="No StorageClasses found" />
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Provisioner
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Reclaim Policy
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Binding Mode
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Expandable
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((sc) => (
                  <TableRow
                    key={sc.name}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === sc.name && "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === sc.name ? null : sc,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap font-medium">
                      {sc.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {sc.provisioner}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {sc.reclaimPolicy || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {sc.volumeBindingMode || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {sc.allowVolumeExpansion ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(sc.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.provisioner !== undefined && (
        <DetailPanel sc={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
