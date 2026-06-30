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
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sReplicaSet } from "../types/k8s"
import { ContainerCard } from "./ContainerCard"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"

function SectionHeader({ title }: { title: string }): JSX.Element {
  return (
    <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
      {title}
    </h3>
  )
}

function DetailPanel({
  rs,
  onClose,
}: {
  rs: K8sReplicaSet
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const selectorEntries = Object.entries(rs.selector).filter(([k, v]) =>
    kv(k, v),
  )
  const podTemplateEntries = Object.entries(rs.podTemplateLabels).filter(
    ([k, v]) => kv(k, v),
  )
  const labelEntries = Object.entries(rs.labels ?? {}).filter(([k, v]) =>
    kv(k, v),
  )
  const annotationEntries = Object.entries(rs.annotations ?? {})
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{rs.name}</h2>
          <span className="text-xs text-muted-foreground">{rs.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="ReplicaSet"
            resourceName={rs.name}
            namespace={rs.namespace}
            buildYaml={() => ({
              apiVersion: "apps/v1",
              kind: "ReplicaSet",
              metadata: { name: rs.name, namespace: rs.namespace },
              spec: {
                replicas: rs.desiredReplicas,
                selector: { matchLabels: rs.selector },
                template: {
                  metadata: { labels: rs.podTemplateLabels },
                  spec: {
                    containers: rs.containers.map((c) => ({
                      name: c.name,
                      image: c.image,
                    })),
                  },
                },
              },
            })}
          />
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

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
      />

      {/* Replicas */}
      <div className="space-y-1">
        <SectionHeader title="Replicas" />
        <MetaEntry label="Desired" value={String(rs.desiredReplicas)} />
        <MetaEntry label="Current" value={String(rs.currentReplicas)} />
        <MetaEntry label="Ready" value={String(rs.readyReplicas)} />
        {rs.serviceAccountName && m(rs.serviceAccountName) && (
          <MetaEntry label="Service Account" value={rs.serviceAccountName} />
        )}
        <MetaEntry
          label="Created"
          value={new Date(rs.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Owner References */}
      {rs.ownerReferences.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Owner References" />
          {rs.ownerReferences.map((o, i) => (
            <div key={i} className="text-sm border rounded p-2 space-y-0.5">
              <div className="font-medium">{o.name}</div>
              <div className="text-xs text-muted-foreground">{o.kind}</div>
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

      {/* Selector */}
      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Selector" />
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Pod Template Labels */}
      {podTemplateEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Pod Template" />
          {podTemplateEntries.map(([k, v]) => (
            <MetaEntry key={k} label={`label: ${k}`} value={v} />
          ))}
        </div>
      )}

      {/* Init Containers */}
      {rs.initContainers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Init Containers" />
          {rs.initContainers
            .filter((c) => m(c.name) || m(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Containers */}
      {rs.containers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Containers" />
          {rs.containers
            .filter((c) => m(c.name) || m(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Volumes */}
      {rs.volumes.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Volumes" />
          {rs.volumes
            .filter((v) => m(v.name) || m(v.type) || m(v.detail))
            .map((v) => (
              <div
                key={v.name}
                className="text-xs border rounded p-2 space-y-0.5"
              >
                <div className="font-medium">{v.name}</div>
                <div className="text-muted-foreground">
                  {v.type}
                  {v.detail ? `: ${v.detail}` : ""}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Events */}
      <ResourceEventsSection
        namespace={rs.namespace}
        name={rs.name}
        kind="ReplicaSet"
        search={sl}
      />
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
