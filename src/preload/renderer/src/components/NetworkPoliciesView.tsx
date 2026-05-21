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
import { cn, filterResources } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import {
  K8sNetworkPolicy,
  K8sNetworkPolicyPeer,
  K8sNetworkPolicyRule,
} from "../types/k8s"
import { EmptyState } from "./EmptyState"
import { RefreshBar } from "./RefreshBar"

function formatAge(timestamp: string): string {
  if (!timestamp) return ""
  const diff = Date.now() - new Date(timestamp).getTime()
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d`
  const hours = Math.floor(diff / 3600000)
  if (hours > 0) return `${hours}h`
  const mins = Math.floor(diff / 60000)
  return `${mins}m`
}

function peerDescription(peer: K8sNetworkPolicyPeer): string {
  if (peer.ipBlock) {
    const excepts =
      peer.ipBlock.except.length > 0
        ? ` (except: ${peer.ipBlock.except.join(", ")})`
        : ""
    return `CIDR: ${peer.ipBlock.cidr}${excepts}`
  }
  const parts: string[] = []
  if (peer.namespaceSelector) {
    const labels = Object.entries(peer.namespaceSelector)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")
    parts.push(`ns: ${labels || "all"}`)
  }
  if (peer.podSelector) {
    const labels = Object.entries(peer.podSelector)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")
    parts.push(`pod: ${labels || "all"}`)
  }
  return parts.length > 0 ? parts.join(", ") : "all"
}

function RuleSection({
  title,
  rules,
}: {
  title: string
  rules: K8sNetworkPolicyRule[]
}): JSX.Element {
  if (rules.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
          {title}
        </p>
        <p className="text-sm text-muted-foreground italic">
          Deny all (no rules)
        </p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
        {title}
      </p>
      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div key={i} className="rounded border p-2 text-xs space-y-1">
            <div>
              <span className="text-muted-foreground font-medium">
                From/To:{" "}
              </span>
              {rule.peers.length === 0 ? (
                <span className="italic text-muted-foreground">
                  all sources
                </span>
              ) : (
                <ul className="list-disc list-inside">
                  {rule.peers.map((peer, j) => (
                    <li key={j} className="font-mono">
                      {peerDescription(peer)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {rule.ports.length > 0 && (
              <div>
                <span className="text-muted-foreground font-medium">
                  Ports:{" "}
                </span>
                {rule.ports
                  .map((p) => (p.port ? `${p.protocol}/${p.port}` : p.protocol))
                  .join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailPanel({
  item,
  onClose,
}: {
  item: K8sNetworkPolicy
  onClose: () => void
}): JSX.Element {
  return (
    <div className="w-96 shrink-0 bg-card text-card-foreground border border-border shadow-md overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-lg mb-1">{item.name}</h2>
          <p className="text-xs text-muted-foreground">{item.namespace}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-1"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
          Pod Selector
        </p>
        <p className="text-sm font-mono">{item.podSelector}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
          Policy Types
        </p>
        <p className="text-sm">
          {item.policyTypes.length > 0
            ? item.policyTypes.join(", ")
            : "None specified"}
        </p>
      </div>

      <RuleSection title="Ingress Rules" rules={item.ingressRules} />
      <RuleSection title="Egress Rules" rules={item.egressRules} />
    </div>
  )
}

export function NetworkPoliciesView(): JSX.Element {
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sNetworkPolicy | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: policies,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listNetworkPolicies({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || policies.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = policies.find(
      (p) => p.name === item.name && p.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [policies])

  const visible = filterResources(policies, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Network Policies</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message="No NetworkPolicies found" />
        )}
        {!loading && !error && visible.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Pod Selector</TableHead>
                <TableHead>Policy Types</TableHead>
                <TableHead>Ingress Rules</TableHead>
                <TableHead>Egress Rules</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((np) => (
                <TableRow
                  key={`${np.namespace}/${np.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === np.name &&
                      selectedItem?.namespace === np.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === np.name &&
                        selectedItem?.namespace === np.namespace
                        ? null
                        : np,
                    )
                  }
                >
                  <TableCell className="font-medium">{np.name}</TableCell>
                  <TableCell>{np.namespace}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {np.podSelector}
                  </TableCell>
                  <TableCell>{np.policyTypes.join(", ") || "-"}</TableCell>
                  <TableCell>{np.ingressRuleCount}</TableCell>
                  <TableCell>{np.egressRuleCount}</TableCell>
                  <TableCell>{formatAge(np.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.policyTypes !== undefined && (
        <DetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
