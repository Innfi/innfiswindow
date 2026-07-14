import { useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { K8sEndpoint } from "../types/k8s"
import { MetaEntry } from "./MetaEntry"
import { SectionHeader } from "./SectionHeader"

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
    <DetailPanelLayout>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{endpoint.name}</h2>
          <span className="text-xs text-muted-foreground">
            {endpoint.namespace}
          </span>
        </div>
        <ClosePanelButton onClose={onClose} className="ml-1" />
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
          <SectionHeader
            title={`Subset ${endpoint.subsets.length > 1 ? i + 1 : ""}`}
          />

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
          <SectionHeader title="Labels" />
          {labelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}
    </DetailPanelLayout>
  )
}

export function EndpointsView(): JSX.Element {
  return (
    <ResourceListView<K8sEndpoint>
      title="Endpoints"
      list={(ctx) => window.api.k8s.listEndpoints({ contextName: ctx })}
      detailGuard={(item) => (item as K8sEndpoint).subsets !== undefined}
      columns={[
        { head: "Name", cell: (ep) => ep.name },
        { head: "Namespace", cell: (ep) => ep.namespace },
        { head: "Ready", cell: (ep) => ep.readyAddressCount },
        {
          head: "Not Ready",
          cell: (ep) => ep.notReadyAddressCount,
          className: (ep) =>
            ep.notReadyAddressCount > 0
              ? "text-amber-600 dark:text-amber-400 font-semibold"
              : undefined,
        },
        { head: "Ports", cell: (ep) => ep.ports || "—" },
        ageColumn<K8sEndpoint>(),
      ]}
      renderDetail={(endpoint, ctl: DetailController) => (
        <DetailPanel endpoint={endpoint} onClose={ctl.onClose} />
      )}
    />
  )
}
