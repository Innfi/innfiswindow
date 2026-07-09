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
import { cn, filterResources, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sHPA } from "../types/k8s"
import { DetailPanelLayout } from "./DetailPanelLayout"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

function DetailPanel({
  hpa,
  onClose,
}: {
  hpa: K8sHPA
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(hpa.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(hpa.annotations)
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
          <h2 className="font-semibold text-base mb-1">{hpa.name}</h2>
          <span className="text-xs text-muted-foreground">{hpa.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="HPA"
            resourceName={hpa.name}
            namespace={hpa.namespace}
            buildYaml={() => ({
              apiVersion: "autoscaling/v2",
              kind: "HorizontalPodAutoscaler",
              metadata: {
                name: hpa.name,
                namespace: hpa.namespace,
                labels: hpa.labels,
                annotations: hpa.annotations,
              },
              spec: {
                scaleTargetRef: {
                  apiVersion: "apps/v1",
                  kind: hpa.targetRef.kind,
                  name: hpa.targetRef.name,
                },
                minReplicas: hpa.minReplicas,
                maxReplicas: hpa.maxReplicas,
              },
            })}
          />
          <CopyResourceButton
            name={hpa.name}
            namespace={hpa.namespace}
            resourceKind="horizontalpodautoscaler"
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

      {/* Scale Target */}
      <div className="space-y-1">
        <SectionHeader title="Scale Target" />
        <MetaEntry label="Kind" value={hpa.targetRef.kind} />
        <MetaEntry label="Name" value={hpa.targetRef.name} />
        <MetaEntry
          label="Created"
          value={new Date(hpa.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Replicas */}
      <div className="space-y-1">
        <SectionHeader title="Replicas" />
        <MetaEntry label="Min" value={String(hpa.minReplicas)} />
        <MetaEntry label="Max" value={String(hpa.maxReplicas)} />
        <MetaEntry label="Current" value={String(hpa.currentReplicas)} />
        <MetaEntry label="Desired" value={String(hpa.desiredReplicas)} />
      </div>

      {/* Metrics */}
      {hpa.metrics.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Metrics" />
          {hpa.metrics
            .filter((met) => m(met.type) || m(met.target) || m(met.current))
            .map((met, i) => (
              <div key={i} className="text-sm border rounded p-2 space-y-0.5">
                <div className="font-medium">{met.type}</div>
                {met.target && (
                  <div className="text-xs text-muted-foreground">
                    Target: {met.target}
                  </div>
                )}
                {met.current && (
                  <div className="text-xs text-muted-foreground">
                    Current: {met.current}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Conditions */}
      {hpa.conditions.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Conditions" />
          {hpa.conditions
            .filter((c) => m(c.type) || m(c.reason) || m(c.message))
            .map((c) => (
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
                  <div className="text-xs text-muted-foreground">
                    {c.reason}
                  </div>
                )}
                {c.message && (
                  <div className="text-xs text-muted-foreground">
                    {c.message}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

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
        namespace={hpa.namespace}
        name={hpa.name}
        kind="HorizontalPodAutoscaler"
        search={sl}
      />
    </DetailPanelLayout>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Target</TableHead>
                  <TableHead className="whitespace-nowrap">Min</TableHead>
                  <TableHead className="whitespace-nowrap">Max</TableHead>
                  <TableHead className="whitespace-nowrap">Replicas</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
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
                    <TableCell className="whitespace-nowrap">
                      {h.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {h.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {h.targetRef.kind}/{h.targetRef.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {h.minReplicas}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {h.maxReplicas}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{`${h.currentReplicas}/${h.desiredReplicas}`}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(h.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.namespace !== undefined && (
        <DetailPanel hpa={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
