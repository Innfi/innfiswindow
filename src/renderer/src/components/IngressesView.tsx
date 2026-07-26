import { useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DeleteButton } from "../../components/ui/DeleteButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { EditButton } from "../../components/ui/EditButton"
import { MetaEntry } from "../../components/ui/MetaEntry"
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { K8sIngress, K8sIngressRule, K8sIngressTLS } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  item,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  item: K8sIngress
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{item.name}</h2>
          <span className="text-xs text-muted-foreground">
            {item.namespace}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="Ingress"
            resourceName={item.name}
            namespace={item.namespace}
            buildYaml={() => ({
              apiVersion: "networking.k8s.io/v1",
              kind: "Ingress",
              metadata: {
                name: item.name,
                namespace: item.namespace,
                ...(Object.keys(item.labels).length > 0
                  ? { labels: item.labels }
                  : {}),
                ...(Object.keys(item.annotations).length > 0
                  ? { annotations: item.annotations }
                  : {}),
              },
              spec: {
                ...(item.ingressClassName
                  ? { ingressClassName: item.ingressClassName }
                  : {}),
                rules: item.rules.map((r) => ({
                  host: r.host,
                  http: {
                    paths: r.paths.map((p) => ({
                      path: p.path,
                      pathType: p.pathType,
                      backend: {
                        service: {
                          name: p.serviceName,
                          port: {
                            number:
                              typeof p.servicePort === "number"
                                ? p.servicePort
                                : parseInt(String(p.servicePort), 10) || 80,
                          },
                        },
                      },
                    })),
                  },
                })),
                ...(item.tls.length > 0
                  ? {
                      tls: item.tls.map((t) => ({
                        hosts: t.hosts,
                        secretName: t.secretName,
                      })),
                    }
                  : {}),
              },
            })}
          />
          <DeleteButton
            resourceKind="Ingress"
            resourceName={item.name}
            namespace={item.namespace}
            onDeleted={onDeleted}
            onDeleteDialogChange={onDeleteDialogChange}
            onClose={onClose}
          />
          <CopyResourceButton
            name={item.name}
            namespace={item.namespace}
            resourceKind="ingress"
          />
          <ClosePanelButton onClose={onClose} className="ml-1" />
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
      />

      {/* Info */}
      <div className="space-y-1">
        <SectionHeader title="Info" />
        <MetaEntry
          label="Ingress Class"
          value={item.ingressClassName || "none"}
        />
        {item.address && m(item.address) && (
          <MetaEntry label="Address" value={item.address} mono />
        )}
        <MetaEntry
          label="Created"
          value={new Date(item.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* TLS */}
      {item.tls.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="TLS" />
          {item.tls.map((t: K8sIngressTLS, i: number) => {
            const secret = t.secretName || "none"
            const hosts = t.hosts.length > 0 ? t.hosts.join(", ") : "*"
            if (!m(secret) && !m(hosts)) return null
            return (
              <div key={i} className="rounded border p-2 text-xs space-y-0.5">
                <MetaEntry label="Secret" value={secret} mono />
                <MetaEntry label="Hosts" value={hosts} />
              </div>
            )
          })}
        </div>
      )}

      {/* Rules */}
      <div className="space-y-1">
        <SectionHeader title="Rules" />
        {item.rules.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No rules</p>
        ) : (
          <div className="space-y-2">
            {item.rules
              .filter((rule: K8sIngressRule) => {
                if (!sl) return true
                if (m(rule.host)) return true
                return rule.paths.some(
                  (p) =>
                    m(p.path) || m(p.serviceName) || m(String(p.servicePort)),
                )
              })
              .map((rule: K8sIngressRule, i: number) => (
                <div key={i} className="rounded border p-2">
                  <p className="font-mono text-sm font-medium mb-2">
                    {rule.host || "*"}
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left pb-1 font-medium">Path</th>
                        <th className="text-left pb-1 font-medium">Type</th>
                        <th className="text-left pb-1 font-medium">Service</th>
                        <th className="text-left pb-1 font-medium">Port</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rule.paths
                        .filter(
                          (p) =>
                            !sl ||
                            m(p.path) ||
                            m(p.serviceName) ||
                            m(String(p.servicePort)),
                        )
                        .map((p, j) => (
                          <tr key={j} className="border-t border-border/40">
                            <td className="font-mono py-0.5 pr-2">{p.path}</td>
                            <td className="py-0.5 pr-2">{p.pathType}</td>
                            <td className="py-0.5 pr-2">{p.serviceName}</td>
                            <td className="py-0.5">{String(p.servicePort)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        )}
      </div>

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
        kind="Ingress"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function IngressesView(): JSX.Element {
  return (
    <ResourceListView<K8sIngress>
      title="Ingresses"
      list={(ctx) => window.api.k8s.listIngresses({ contextName: ctx })}
      detailGuard={(item) => (item as K8sIngress).rules !== undefined}
      columns={[
        { head: "Name", cell: (ing) => ing.name, className: "font-medium" },
        { head: "Namespace", cell: (ing) => ing.namespace },
        { head: "Class", cell: (ing) => ing.ingressClassName || "-" },
        { head: "Hosts", cell: (ing) => ing.hosts },
        { head: "Address", cell: (ing) => ing.address || "-" },
        { head: "Ports", cell: (ing) => ing.ports },
        ageColumn<K8sIngress>(),
      ]}
      renderDetail={(ing, ctl: DetailController) => (
        <DetailPanel
          item={ing}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
