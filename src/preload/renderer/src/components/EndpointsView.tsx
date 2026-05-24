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
import { K8sEndpoint } from "../types/k8s"
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

function DetailPanel({
  endpoint,
  onClose,
}: {
  endpoint: K8sEndpoint
  onClose: () => void
}): JSX.Element {
  return (
    <div className="w-96 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
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

          {subset.readyAddresses.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Ready Addresses
              </p>
              {subset.readyAddresses.map((addr, ai) => (
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

          {subset.notReadyAddresses.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Not-Ready Addresses
              </p>
              {subset.notReadyAddresses.map((addr, ai) => (
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Not Ready</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead>Age</TableHead>
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
                  <TableCell>{ep.name}</TableCell>
                  <TableCell>{ep.namespace}</TableCell>
                  <TableCell>{ep.readyAddressCount}</TableCell>
                  <TableCell
                    className={cn(
                      ep.notReadyAddressCount > 0 &&
                        "text-amber-600 dark:text-amber-400 font-semibold",
                    )}
                  >
                    {ep.notReadyAddressCount}
                  </TableCell>
                  <TableCell>{ep.ports || "—"}</TableCell>
                  <TableCell>{formatAge(ep.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
