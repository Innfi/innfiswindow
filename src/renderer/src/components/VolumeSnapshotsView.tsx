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
import { K8sVolumeSnapshot } from "../types/k8s"
import { MetaEntry } from "./MetaEntry"
import { SectionHeader } from "./SectionHeader"

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
}: {
  snap: K8sVolumeSnapshot
  onClose: () => void
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
    <DetailPanelLayout>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{snap.name}</h2>
          <span className="text-xs text-muted-foreground">
            {snap.namespace}
          </span>
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
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sVolumeSnapshot | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: snapshots,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listVolumeSnapshots({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || snapshots.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = snapshots.find(
      (s) => s.name === item.name && s.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [snapshots])

  const visible = filterResources(snapshots, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Volume Snapshots</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message="No VolumeSnapshots found" />
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Source PVC
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Snapshot Class
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Ready</TableHead>
                  <TableHead className="whitespace-nowrap">Size</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((snap) => (
                  <TableRow
                    key={`${snap.namespace}/${snap.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === snap.name &&
                        (selectedItem as K8sVolumeSnapshot)?.namespace ===
                          snap.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === snap.name &&
                          (selectedItem as K8sVolumeSnapshot)?.namespace ===
                            snap.namespace
                          ? null
                          : snap,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap font-medium">
                      {snap.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {snap.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {snap.sourcePVCName || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {snap.volumeSnapshotClassName || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <ReadyBadge ready={snap.readyToUse} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {snap.restoreSize || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(snap.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.sourcePVCName !== undefined && (
        <DetailPanel
          snap={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
