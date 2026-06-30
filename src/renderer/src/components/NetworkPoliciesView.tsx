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
import {
  K8sNetworkPolicy,
  K8sNetworkPolicyPeer,
  K8sNetworkPolicyRule,
} from "../types/k8s"
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
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(item.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(item.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md overflow-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-lg mb-1">{item.name}</h2>
          <p className="text-xs text-muted-foreground">{item.namespace}</p>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="NetworkPolicy"
            resourceName={item.name}
            namespace={item.namespace}
            buildYaml={() => ({
              apiVersion: "networking.k8s.io/v1",
              kind: "NetworkPolicy",
              metadata: { name: item.name, namespace: item.namespace },
              spec: { podSelector: {}, policyTypes: item.policyTypes },
            })}
          />
          <CopyResourceButton
            name={item.name}
            namespace={item.namespace}
            resourceKind="networkpolicy"
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
        <MetaEntry label="Pod Selector" value={item.podSelector} mono />
        <MetaEntry
          label="Policy Types"
          value={
            item.policyTypes.length > 0
              ? item.policyTypes.join(", ")
              : "None specified"
          }
        />
        <MetaEntry
          label="Created"
          value={new Date(item.creationTimestamp).toLocaleString()}
        />
      </div>

      <RuleSection title="Ingress Rules" rules={item.ingressRules} />
      <RuleSection title="Egress Rules" rules={item.egressRules} />

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
        namespace={item.namespace}
        name={item.name}
        kind="NetworkPolicy"
        search={sl}
      />
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Pod Selector
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Policy Types
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Ingress Rules
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Egress Rules
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
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
                    <TableCell className="whitespace-nowrap font-medium">
                      {np.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {np.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {np.podSelector}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {np.policyTypes.join(", ") || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {np.ingressRuleCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {np.egressRuleCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(np.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
