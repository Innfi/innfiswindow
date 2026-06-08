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
import { K8sPDB } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

function DetailPanel({
  pdb,
  onClose,
}: {
  pdb: K8sPDB
  onClose: () => void
}): JSX.Element {
  const selectorEntries = Object.entries(pdb.selector)
  const labelEntries = Object.entries(pdb.labels)
  const annotationEntries = Object.entries(pdb.annotations)

  return (
    <div className="w-96 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{pdb.name}</h2>
          <span className="text-xs text-muted-foreground">{pdb.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
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

      <div className="space-y-1">
        <MetaEntry
          label="Created"
          value={new Date(pdb.creationTimestamp).toLocaleString()}
        />
        <MetaEntry label="Min Available" value={pdb.minAvailable ?? "—"} />
        <MetaEntry label="Max Unavailable" value={pdb.maxUnavailable ?? "—"} />
        <MetaEntry label="Current Healthy" value={String(pdb.currentHealthy)} />
        <MetaEntry label="Desired Healthy" value={String(pdb.desiredHealthy)} />
        <MetaEntry
          label="Disruptions Allowed"
          value={String(pdb.disruptionsAllowed)}
        />
        <MetaEntry label="Expected Pods" value={String(pdb.expectedPods)} />
      </div>

      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Selector
          </h3>
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
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
