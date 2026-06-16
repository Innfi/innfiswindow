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
import { K8sNamespace } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

function DetailPanel({
  ns,
  onClose,
}: {
  ns: K8sNamespace
  onClose: () => void
}): JSX.Element {
  const labelEntries = Object.entries(ns.labels)
  const annotationEntries = Object.entries(ns.annotations)

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{ns.name}</h2>
          <span
            className={cn(
              "inline-block rounded px-2 py-0.5 text-xs font-medium",
              ns.status === "Active"
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800",
            )}
          >
            {ns.status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <CopyResourceButton name={ns.name} resourceKind="namespace" />
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
          Metadata
        </h3>
        <MetaEntry
          label="Created"
          value={new Date(ns.creationTimestamp).toLocaleString()}
        />
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

export function NamespacesView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sNamespace | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: namespaces,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listNamespaces({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || namespaces.length === 0) return
    const item = selectedItem as { name: string }
    const fresh = namespaces.find((n) => n.name === item.name)
    if (fresh) setSelectedItem(fresh as object)
  }, [namespaces])

  const visibleNamespaces = filterResources(namespaces, nameFilter)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Namespaces</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleNamespaces.length === 0 && (
          <EmptyState message="No Namespaces found" />
        )}
        {!loading && !error && visibleNamespaces.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleNamespaces.map((ns) => (
                  <TableRow
                    key={ns.name}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === ns.name && "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === ns.name ? null : ns,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {ns.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ns.status}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(ns.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && (
        <DetailPanel ns={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
