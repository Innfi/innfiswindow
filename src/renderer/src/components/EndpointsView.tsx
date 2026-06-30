import { X } from "lucide-react"
import { useEffect, useState } from "react"

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
import { K8sEndpoint } from "../types/k8s"
import { MetaEntry } from "./MetaEntry"

function DetailPanel({
  endpoint,
  onClose,
}: {
  endpoint: K8sEndpoint
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(endpoint.labels).filter(([k, v]) =>
    kv(k, v),
  )
  const annotationEntries = Object.entries(endpoint.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{endpoint.name}</h2>
          <span className="text-xs text-muted-foreground">
            {endpoint.namespace}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-1"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
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
          value={new Date(endpoint.creationTimestamp).toLocaleString()}
        />
        <MetaEntry label="Ready" value={String(endpoint.readyAddressCount)} />
        <MetaEntry
          label="Not Ready"
          value={String(endpoint.notReadyAddressCount)}
        />
        <MetaEntry label="Ports" value={endpoint.ports || "—"} />
      </div>

      {endpoint.subsets.map((subset, i) => (
        <div key={i} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Subset {endpoint.subsets.length > 1 ? i + 1 : ""}
          </h3>

          {subset.ports.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Ports</p>
              {subset.ports.map((p, pi) => (
                <MetaEntry
                  key={pi}
                  label={p.name || String(p.port)}
                  value={`${p.port}/${p.protocol}`}
                />
              ))}
            </div>
          )}

          {subset.readyAddresses.filter(
            (addr) =>
              !sl ||
              addr.ip.includes(sl) ||
              (addr.targetPodName ?? "").toLowerCase().includes(sl),
          ).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Ready Addresses
              </p>
              {subset.readyAddresses
                .filter(
                  (addr) =>
                    !sl ||
                    addr.ip.includes(sl) ||
                    (addr.targetPodName ?? "").toLowerCase().includes(sl),
                )
                .map((addr, ai) => (
                  <div key={ai} className="text-xs flex gap-2">
                    <span className="font-mono">{addr.ip}</span>
                    {addr.targetPodName && (
                      <span className="text-muted-foreground">
                        → {addr.targetPodNamespace}/{addr.targetPodName}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          )}

          {subset.notReadyAddresses.filter(
            (addr) =>
              !sl ||
              addr.ip.includes(sl) ||
              (addr.targetPodName ?? "").toLowerCase().includes(sl),
          ).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Not-Ready Addresses
              </p>
              {subset.notReadyAddresses
                .filter(
                  (addr) =>
                    !sl ||
                    addr.ip.includes(sl) ||
                    (addr.targetPodName ?? "").toLowerCase().includes(sl),
                )
                .map((addr, ai) => (
                  <div
                    key={ai}
                    className="text-xs flex gap-2 text-amber-600 dark:text-amber-400"
                  >
                    <span className="font-mono">{addr.ip}</span>
                    {addr.targetPodName && (
                      <span>
                        → {addr.targetPodNamespace}/{addr.targetPodName}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}

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

export function EndpointsView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sEndpoint | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: endpoints,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listEndpoints({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || endpoints.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = endpoints.find(
      (e) => e.name === item.name && e.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [endpoints])

  const visible = filterResources(endpoints, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Endpoints</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message="No Endpoints found" />
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Ready</TableHead>
                  <TableHead className="whitespace-nowrap">Not Ready</TableHead>
                  <TableHead className="whitespace-nowrap">Ports</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((ep) => (
                  <TableRow
                    key={`${ep.namespace}/${ep.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === ep.name &&
                        (selectedItem as K8sEndpoint)?.namespace ===
                          ep.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === ep.name &&
                          (selectedItem as K8sEndpoint)?.namespace ===
                            ep.namespace
                          ? null
                          : ep,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {ep.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ep.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ep.readyAddressCount}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap",
                        ep.notReadyAddressCount > 0 &&
                          "text-amber-600 dark:text-amber-400 font-semibold",
                      )}
                    >
                      {ep.notReadyAddressCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ep.ports || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(ep.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && (selectedItem as K8sEndpoint).subsets !== undefined && (
        <DetailPanel
          endpoint={selectedItem as K8sEndpoint}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
