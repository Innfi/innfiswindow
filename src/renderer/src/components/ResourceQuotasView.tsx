import { X } from "lucide-react"
import { useEffect, useState } from "react"

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
import {
  cn,
  filterResources,
  formatAge,
  parseResourceValue,
} from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sResourceQuota } from "../types/k8s"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"

function usagePercent(used: string, hard: string): number {
  const u = parseResourceValue(used)
  const h = parseResourceValue(hard)
  if (h === 0) return 0
  return Math.min((u / h) * 100, 100)
}

function DetailPanel({
  quota,
  onClose,
}: {
  quota: K8sResourceQuota
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(quota.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(quota.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  const resources = Object.keys(quota.hard).filter(
    (r) => !sl || r.toLowerCase().includes(sl),
  )

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{quota.name}</h2>
          <span className="text-xs text-muted-foreground">
            {quota.namespace}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="ResourceQuota"
            resourceName={quota.name}
            namespace={quota.namespace}
            buildYaml={() => ({
              apiVersion: "v1",
              kind: "ResourceQuota",
              metadata: { name: quota.name, namespace: quota.namespace },
              spec: { hard: quota.hard },
            })}
          />
          <CopyResourceButton
            name={quota.name}
            namespace={quota.namespace}
            resourceKind="resourcequota"
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
          value={new Date(quota.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Resource Usage
        </h3>
        {resources.map((resource) => {
          const hard = quota.hard[resource] ?? "0"
          const used = quota.used[resource] ?? "0"
          const pct = usagePercent(used, hard)
          const isRed = pct >= 100
          const isYellow = !isRed && pct > 80

          return (
            <div
              key={resource}
              className={cn(
                "rounded border p-2 space-y-1",
                isRed && "border-red-400 bg-red-50 dark:bg-red-950/20",
                isYellow &&
                  "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20",
              )}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate mr-2">{resource}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {used} / {hard}
                </span>
              </div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded transition-all",
                    isRed
                      ? "bg-red-500"
                      : isYellow
                        ? "bg-yellow-500"
                        : "bg-green-500",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
        {resources.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No resource limits defined
          </p>
        )}
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

      <ResourceEventsSection
        namespace={quota.namespace}
        name={quota.name}
        kind="ResourceQuota"
        search={sl}
      />
    </div>
  )
}

export function ResourceQuotasView(): JSX.Element {
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sResourceQuota | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: quotas,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listResourceQuotas({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || quotas.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = quotas.find(
      (q) => q.name === item.name && q.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [quotas])

  const visible = filterResources(quotas, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">ResourceQuotas</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message="No ResourceQuotas found" />
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Resources</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((q) => (
                  <TableRow
                    key={`${q.namespace}/${q.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === q.name &&
                        (selectedItem as K8sResourceQuota)?.namespace ===
                          q.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === q.name &&
                          (selectedItem as K8sResourceQuota)?.namespace ===
                            q.namespace
                          ? null
                          : q,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {q.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {q.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {Object.keys(q.hard).length}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(q.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem &&
        (selectedItem as K8sResourceQuota).hard !== undefined && (
          <DetailPanel
            quota={selectedItem as K8sResourceQuota}
            onClose={() => setSelectedItem(null)}
          />
        )}
    </div>
  )
}
