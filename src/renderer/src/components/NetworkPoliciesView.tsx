import { useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { EditButton } from "../../components/ui/EditButton"
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import {
  K8sNetworkPolicy,
  K8sNetworkPolicyPeer,
  K8sNetworkPolicyRule,
} from "../types/k8s"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

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
    <DetailPanelLayout>
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
          <ClosePanelButton onClose={onClose} />
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
    </DetailPanelLayout>
  )
}

export function NetworkPoliciesView(): JSX.Element {
  return (
    <ResourceListView<K8sNetworkPolicy>
      title="Network Policies"
      emptyMessage="No NetworkPolicies found"
      list={(ctx) => window.api.k8s.listNetworkPolicies({ contextName: ctx })}
      detailGuard={(item) =>
        (item as K8sNetworkPolicy).policyTypes !== undefined
      }
      columns={[
        { head: "Name", cell: (np) => np.name, className: "font-medium" },
        { head: "Namespace", cell: (np) => np.namespace },
        {
          head: "Pod Selector",
          cell: (np) => np.podSelector,
          className: "font-mono text-xs",
        },
        {
          head: "Policy Types",
          cell: (np) => np.policyTypes.join(", ") || "-",
        },
        { head: "Ingress Rules", cell: (np) => np.ingressRuleCount },
        { head: "Egress Rules", cell: (np) => np.egressRuleCount },
        ageColumn<K8sNetworkPolicy>(),
      ]}
      renderDetail={(np, ctl: DetailController) => (
        <DetailPanel item={np} onClose={ctl.onClose} />
      )}
    />
  )
}
