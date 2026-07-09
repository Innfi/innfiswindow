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
import { K8sNamespace } from "../types/k8s"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

function DetailPanel({
  ns,
  onClose,
}: {
  ns: K8sNamespace
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const kv = (k: string, v: string): boolean =>
    !sl || k.toLowerCase().includes(sl) || v.toLowerCase().includes(sl)

  const labelEntries = Object.entries(ns.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(ns.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  return (
    <DetailPanelLayout>
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
          <EditButton
            resourceKind="Namespace"
            resourceName={ns.name}
            buildYaml={() => ({
              apiVersion: "v1",
              kind: "Namespace",
              metadata: {
                name: ns.name,
                labels: ns.labels,
                annotations: ns.annotations,
              },
            })}
          />
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

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
      />

      <div className="space-y-1">
        <SectionHeader title="Metadata" />
        <MetaEntry
          label="Created"
          value={new Date(ns.creationTimestamp).toLocaleString()}
        />
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

      {/* Namespaces are cluster-scoped; events live across namespaces */}
      <ResourceEventsSection
        namespace=""
        name={ns.name}
        kind="Namespace"
        search={sl}
      />
    </DetailPanelLayout>
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
