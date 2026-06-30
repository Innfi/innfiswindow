import { X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "../../components/ui/button"
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
import { K8sLimitRange } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  limitRange,
  onClose,
}: {
  limitRange: K8sLimitRange
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(limitRange.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(limitRange.annotations)
    .filter(([k]) => !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"))
    .filter(([k, v]) => kv(k, v))

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{limitRange.name}</h2>
          <span className="text-xs text-muted-foreground">
            {limitRange.namespace}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton resourceKind="LimitRange" resourceName={limitRange.name} namespace={limitRange.namespace} buildYaml={() => ({ apiVersion: "v1", kind: "LimitRange", metadata: { name: limitRange.name, namespace: limitRange.namespace }, spec: { limits: limitRange.limits } })} />
          <CopyResourceButton
            name={limitRange.name}
            namespace={limitRange.namespace}
            resourceKind="limitrange"
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

      <div className="space-y-1">
        <MetaEntry
          label="Created"
          value={new Date(limitRange.creationTimestamp).toLocaleString()}
        />
      </div>

      {limitRange.limits.map((limit, idx) => {
        const resources = Array.from(
          new Set([
            ...Object.keys(limit.max),
            ...Object.keys(limit.min),
            ...Object.keys(limit.default),
            ...Object.keys(limit.defaultRequest),
          ]),
        )

        return (
          <div key={idx} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              {limit.type}
            </h3>
            {resources.length > 0 ? (
              <div className="border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-2 py-1.5 font-medium">
                        Resource
                      </th>
                      <th className="text-left px-2 py-1.5 font-medium">Max</th>
                      <th className="text-left px-2 py-1.5 font-medium">Min</th>
                      <th className="text-left px-2 py-1.5 font-medium">
                        Default
                      </th>
                      <th className="text-left px-2 py-1.5 font-medium">
                        Req Default
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((res) => (
                      <tr key={res} className="border-t">
                        <td className="px-2 py-1.5 font-medium">{res}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {limit.max[res] ?? "-"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {limit.min[res] ?? "-"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {limit.default[res] ?? "-"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {limit.defaultRequest[res] ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No constraints defined
              </p>
            )}
          </div>
        )
      })}

      {limitRange.limits.length === 0 && (
        <p className="text-sm text-muted-foreground">No limit types defined</p>
      )}

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

      <ResourceEventsSection namespace={limitRange.namespace} name={limitRange.name} kind="LimitRange" search={sl} />
    </div>
  )
}

export function LimitRangesView(): JSX.Element {
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sLimitRange | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: limitRanges,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listLimitRanges({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || limitRanges.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = limitRanges.find(
      (lr) => lr.name === item.name && lr.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [limitRanges])

  const visible = filterResources(limitRanges, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">LimitRanges</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message="No LimitRanges found" />
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Types</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((lr) => {
                  const types = Array.from(
                    new Set(lr.limits.map((l) => l.type).filter(Boolean)),
                  ).join(", ")

                  return (
                    <TableRow
                      key={`${lr.namespace}/${lr.name}`}
                      className={cn(
                        "cursor-pointer",
                        selectedItem?.name === lr.name &&
                          (selectedItem as K8sLimitRange)?.namespace ===
                            lr.namespace &&
                          "bg-muted",
                      )}
                      onClick={() =>
                        setSelectedItem(
                          selectedItem?.name === lr.name &&
                            (selectedItem as K8sLimitRange)?.namespace ===
                              lr.namespace
                            ? null
                            : lr,
                        )
                      }
                    >
                      <TableCell className="whitespace-nowrap">
                        {lr.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {lr.namespace}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {types || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatAge(lr.creationTimestamp)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && (selectedItem as K8sLimitRange).limits !== undefined && (
        <DetailPanel
          limitRange={selectedItem as K8sLimitRange}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
