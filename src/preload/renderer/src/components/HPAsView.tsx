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
import { K8sHPA } from "../types/k8s"
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

function DetailPanel({
  hpa,
  onClose,
}: {
  hpa: K8sHPA
  onClose: () => void
}): JSX.Element {
  const labelEntries = Object.entries(hpa.labels)
  const annotationEntries = Object.entries(hpa.annotations)

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{hpa.name}</h2>
          <span className="text-xs text-muted-foreground">{hpa.namespace}</span>
        </div>
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
          Scale Target
        </h3>
        <MetaEntry label="Kind" value={hpa.targetRef.kind} />
        <MetaEntry label="Name" value={hpa.targetRef.name} />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Replicas
        </h3>
        <MetaEntry label="Min" value={String(hpa.minReplicas)} />
        <MetaEntry label="Max" value={String(hpa.maxReplicas)} />
        <MetaEntry label="Current" value={String(hpa.currentReplicas)} />
        <MetaEntry label="Desired" value={String(hpa.desiredReplicas)} />
        <MetaEntry
          label="Created"
          value={new Date(hpa.creationTimestamp).toLocaleString()}
        />
      </div>

      {hpa.metrics.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Metrics
          </h3>
          {hpa.metrics.map((m, i) => (
            <div key={i} className="text-sm border rounded p-2 space-y-0.5">
              <div className="font-medium">{m.type}</div>
              {m.target && (
                <div className="text-xs text-muted-foreground">
                  Target: {m.target}
                </div>
              )}
              {m.current && (
                <div className="text-xs text-muted-foreground">
                  Current: {m.current}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hpa.conditions.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Conditions
          </h3>
          {hpa.conditions.map((c) => (
            <div
              key={c.type}
              className="text-sm space-y-0.5 border rounded p-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.type}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs",
                    c.status === "True"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800",
                  )}
                >
                  {c.status}
                </span>
              </div>
              {c.reason && (
                <div className="text-xs text-muted-foreground">{c.reason}</div>
              )}
              {c.message && (
                <div className="text-xs text-muted-foreground">{c.message}</div>
              )}
            </div>
          ))}
        </div>
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
    </div>
  )
}

export function HPAsView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sHPA | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: hpas,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listHPAs({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || hpas.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = hpas.find(
      (h) => h.name === item.name && h.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [hpas])

  const visibleHPAs = filterResources(hpas, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">HorizontalPodAutoscalers</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleHPAs.length === 0 && (
          <EmptyState message="No HorizontalPodAutoscalers found" />
        )}
        {!loading && !error && visibleHPAs.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Min</TableHead>
                <TableHead>Max</TableHead>
                <TableHead>Replicas</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleHPAs.map((h) => (
                <TableRow
                  key={`${h.namespace}/${h.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === h.name &&
                      selectedItem?.namespace === h.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === h.name &&
                        selectedItem?.namespace === h.namespace
                        ? null
                        : h,
                    )
                  }
                >
                  <TableCell>{h.name}</TableCell>
                  <TableCell>{h.namespace}</TableCell>
                  <TableCell>
                    {h.targetRef.kind}/{h.targetRef.name}
                  </TableCell>
                  <TableCell>{h.minReplicas}</TableCell>
                  <TableCell>{h.maxReplicas}</TableCell>
                  <TableCell>{`${h.currentReplicas}/${h.desiredReplicas}`}</TableCell>
                  <TableCell>{formatAge(h.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.namespace !== undefined && (
        <DetailPanel hpa={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
