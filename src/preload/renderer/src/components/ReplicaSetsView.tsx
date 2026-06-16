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
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sReplicaSet } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

function DetailPanel({
  rs,
  onClose,
}: {
  rs: K8sReplicaSet
  onClose: () => void
}): JSX.Element {
  const selectorEntries = Object.entries(rs.selector)
  const podTemplateEntries = Object.entries(rs.podTemplateLabels)

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{rs.name}</h2>
          <span className="text-xs text-muted-foreground">{rs.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <CopyResourceButton
            name={rs.name}
            namespace={rs.namespace}
            resourceKind="replicaset"
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
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Replicas
        </h3>
        <MetaEntry label="Desired" value={String(rs.desiredReplicas)} />
        <MetaEntry label="Current" value={String(rs.currentReplicas)} />
        <MetaEntry label="Ready" value={String(rs.readyReplicas)} />
        <MetaEntry
          label="Created"
          value={new Date(rs.creationTimestamp).toLocaleString()}
        />
      </div>

      {rs.ownerReferences.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Owner References
          </h3>
          {rs.ownerReferences.map((o, i) => (
            <div key={i} className="text-sm border rounded p-2 space-y-0.5">
              <div className="font-medium">{o.name}</div>
              <div className="text-xs text-muted-foreground">{o.kind}</div>
            </div>
          ))}
        </div>
      )}

      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Selector Labels
          </h3>
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {rs.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {rs.containers.map((c) => (
            <div
              key={c.name}
              className="text-sm border rounded p-2 space-y-0.5"
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground break-all">
                {c.image}
              </div>
            </div>
          ))}
        </div>
      )}

      {podTemplateEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Pod Template Labels
          </h3>
          {podTemplateEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ReplicaSetsView(): JSX.Element {
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sReplicaSet | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: replicaSets,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listReplicaSets({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || replicaSets.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = replicaSets.find(
      (rs) => rs.name === item.name && rs.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [replicaSets])

  const visibleReplicaSets = replicaSets
    .filter((rs) => !selectedNamespace || rs.namespace === selectedNamespace)
    .filter(
      (rs) =>
        !nameFilter || rs.name.toLowerCase().includes(nameFilter.toLowerCase()),
    )

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">ReplicaSets</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleReplicaSets.length === 0 && (
          <EmptyState message="No Replica Sets found" />
        )}
        {!loading && !error && visibleReplicaSets.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Desired</TableHead>
                  <TableHead className="whitespace-nowrap">Current</TableHead>
                  <TableHead className="whitespace-nowrap">Ready</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleReplicaSets.map((rs) => (
                  <TableRow
                    key={`${rs.namespace}/${rs.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === rs.name &&
                        selectedItem?.namespace === rs.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === rs.name &&
                          selectedItem?.namespace === rs.namespace
                          ? null
                          : rs,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {rs.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {rs.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {rs.desiredReplicas}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {rs.currentReplicas}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {rs.readyReplicas}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(rs.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem &&
        selectedItem.namespace !== undefined &&
        selectedItem.desiredReplicas !== undefined && (
          <DetailPanel
            rs={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
    </div>
  )
}
