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
import { K8sPDB } from "../types/k8s"
import { DetailPanelLayout } from "./DetailPanelLayout"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

function DetailPanel({
  pdb,
  onClose,
}: {
  pdb: K8sPDB
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const selectorEntries = Object.entries(pdb.selector).filter(([k, v]) =>
    kv(k, v),
  )
  const labelEntries = Object.entries(pdb.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(pdb.annotations)
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
          <h2 className="font-semibold text-base mb-1">{pdb.name}</h2>
          <span className="text-xs text-muted-foreground">{pdb.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="PodDisruptionBudget"
            resourceName={pdb.name}
            namespace={pdb.namespace}
            buildYaml={() => ({
              apiVersion: "policy/v1",
              kind: "PodDisruptionBudget",
              metadata: {
                name: pdb.name,
                namespace: pdb.namespace,
                labels: pdb.labels,
                annotations: pdb.annotations,
              },
              spec: {
                ...(pdb.minAvailable != null
                  ? { minAvailable: pdb.minAvailable }
                  : {}),
                ...(pdb.maxUnavailable != null
                  ? { maxUnavailable: pdb.maxUnavailable }
                  : {}),
                selector: { matchLabels: pdb.selector },
              },
            })}
          />
          <CopyResourceButton
            name={pdb.name}
            namespace={pdb.namespace}
            resourceKind="poddisruptionbudget"
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

      {/* Spec */}
      <div className="space-y-1">
        <SectionHeader title="Spec" />
        {pdb.minAvailable != null && m(String(pdb.minAvailable)) && (
          <MetaEntry label="Min Available" value={pdb.minAvailable} />
        )}
        {pdb.maxUnavailable != null && m(String(pdb.maxUnavailable)) && (
          <MetaEntry label="Max Unavailable" value={pdb.maxUnavailable} />
        )}
        <MetaEntry
          label="Created"
          value={new Date(pdb.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Status */}
      <div className="space-y-1">
        <SectionHeader title="Status" />
        <MetaEntry label="Current Healthy" value={String(pdb.currentHealthy)} />
        <MetaEntry label="Desired Healthy" value={String(pdb.desiredHealthy)} />
        <MetaEntry
          label="Disruptions Allowed"
          value={String(pdb.disruptionsAllowed)}
        />
        <MetaEntry label="Expected Pods" value={String(pdb.expectedPods)} />
      </div>

      {/* Selector */}
      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Selector" />
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
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
        namespace={pdb.namespace}
        name={pdb.name}
        kind="PodDisruptionBudget"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function PDBsView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sPDB | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: pdbs,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listPDBs({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || pdbs.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = pdbs.find(
      (p) => p.name === item.name && p.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [pdbs])

  const visible = filterResources(pdbs, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">PodDisruptionBudgets</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message="No PodDisruptionBudgets found" />
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Min Available
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Max Unavailable
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Current Healthy
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Disruptions Allowed
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => (
                  <TableRow
                    key={`${p.namespace}/${p.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === p.name &&
                        (selectedItem as K8sPDB)?.namespace === p.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === p.name &&
                          (selectedItem as K8sPDB)?.namespace === p.namespace
                          ? null
                          : p,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {p.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.minAvailable ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.maxUnavailable ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.currentHealthy}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap",
                        p.disruptionsAllowed === 0 &&
                          "text-red-500 font-semibold",
                      )}
                    >
                      {p.disruptionsAllowed}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(p.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && (selectedItem as K8sPDB).selector !== undefined && (
        <DetailPanel
          pdb={selectedItem as K8sPDB}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
