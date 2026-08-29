import { useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
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
import {
  K8sEndpointSlice,
  K8sEndpointSliceEndpoint,
  K8sEndpointSlicePort,
  K8sEndpointSliceSummary,
} from "../types/k8s"

/** The API tells consumers to read an unset `ready` as true. */
function isReady(endpoint: K8sEndpointSliceEndpoint): boolean {
  return endpoint.ready !== false
}

function portLabel(port: K8sEndpointSlicePort): string {
  const number = port.port === null ? "*" : String(port.port)
  const app = port.appProtocol ? ` (${port.appProtocol})` : ""
  return `${number}/${port.protocol}${app}`
}

/** Conditions the publisher actually set, in the order the API documents them.
 *  An endpoint that says nothing gets no chips rather than three guesses. */
function conditionLabels(endpoint: K8sEndpointSliceEndpoint): string[] {
  const labels: string[] = []
  if (endpoint.ready !== null) labels.push(`ready=${endpoint.ready}`)
  if (endpoint.serving !== null) labels.push(`serving=${endpoint.serving}`)
  if (endpoint.terminating !== null)
    labels.push(`terminating=${endpoint.terminating}`)
  return labels
}

function endpointText(endpoint: K8sEndpointSliceEndpoint): string {
  return [
    ...endpoint.addresses,
    endpoint.hostname ?? "",
    endpoint.nodeName ?? "",
    endpoint.zone ?? "",
    endpoint.targetName ?? "",
  ].join(" ")
}

function DetailPanel({
  slice,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  slice: K8sEndpointSlice
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(slice.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(slice.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))
  const endpoints = slice.endpoints.filter((e) => m(endpointText(e)))

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1">{slice.name}</h2>
              <span className="text-xs text-muted-foreground">
                {slice.namespace}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="EndpointSlice"
                resourceName={slice.name}
                namespace={slice.namespace}
                buildYaml={() => ({
                  apiVersion: "discovery.k8s.io/v1",
                  kind: "EndpointSlice",
                  metadata: {
                    name: slice.name,
                    namespace: slice.namespace,
                    ...(Object.keys(slice.labels).length > 0 && {
                      labels: slice.labels,
                    }),
                  },
                  addressType: slice.addressType,
                  ports: slice.endpointPorts.map((p) => ({
                    ...(p.name && { name: p.name }),
                    ...(p.port !== null && { port: p.port }),
                    protocol: p.protocol,
                    ...(p.appProtocol && { appProtocol: p.appProtocol }),
                  })),
                  endpoints: slice.endpoints.map((e) => {
                    // The three conditions are tri-state; a null is the
                    // publisher saying nothing, so it must stay absent rather
                    // than round-trip as false.
                    const conditions = {
                      ...(e.ready !== null && { ready: e.ready }),
                      ...(e.serving !== null && { serving: e.serving }),
                      ...(e.terminating !== null && {
                        terminating: e.terminating,
                      }),
                    }
                    return {
                      addresses: e.addresses,
                      ...(Object.keys(conditions).length > 0 && { conditions }),
                      ...(e.hostname && { hostname: e.hostname }),
                      ...(e.nodeName && { nodeName: e.nodeName }),
                      ...(e.zone && { zone: e.zone }),
                      ...(e.targetName && {
                        targetRef: {
                          ...(e.targetKind && { kind: e.targetKind }),
                          name: e.targetName,
                          ...(e.targetNamespace && {
                            namespace: e.targetNamespace,
                          }),
                        },
                      }),
                    }
                  }),
                })}
              />
              <DeleteButton
                resourceKind="EndpointSlice"
                resourceName={slice.name}
                namespace={slice.namespace}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
                warning={
                  slice.serviceName
                    ? "The EndpointSlice controller recreates this slice while its Service exists."
                    : undefined
                }
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
        </>
      }
    >
      <div className="space-y-1">
        <MetaEntry
          label="Created"
          value={new Date(slice.creationTimestamp).toLocaleString()}
        />
        <MetaEntry label="Service" value={slice.serviceName || "—"} />
        <MetaEntry label="Address Type" value={slice.addressType} />
        <MetaEntry
          label="Ready"
          value={`${slice.readyCount} / ${slice.endpointCount}`}
        />
      </div>

      {slice.endpointPorts.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Ports" />
          {slice.endpointPorts.map((p, i) => (
            <MetaEntry
              key={i}
              label={p.name || (p.port === null ? "all ports" : String(p.port))}
              value={portLabel(p)}
            />
          ))}
        </div>
      )}

      {endpoints.length > 0 && (
        <div className="space-y-2">
          <SectionHeader title="Endpoints" />
          {endpoints.map((endpoint, i) => (
            <div
              key={i}
              className={`space-y-1 rounded border px-2 py-1.5 ${
                isReady(endpoint)
                  ? ""
                  : "border-amber-500/50 text-amber-600 dark:text-amber-400"
              }`}
            >
              <div className="text-xs font-mono">
                {endpoint.addresses.join(", ") || "—"}
              </div>
              {conditionLabels(endpoint).length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {conditionLabels(endpoint).join(" · ")}
                </div>
              )}
              {endpoint.targetName && (
                <div className="text-xs text-muted-foreground">
                  → {endpoint.targetKind ?? "Pod"}{" "}
                  {endpoint.targetNamespace
                    ? `${endpoint.targetNamespace}/${endpoint.targetName}`
                    : endpoint.targetName}
                </div>
              )}
              {(endpoint.nodeName || endpoint.zone || endpoint.hostname) && (
                <div className="text-xs text-muted-foreground">
                  {[
                    endpoint.hostname && `hostname ${endpoint.hostname}`,
                    endpoint.nodeName && `node ${endpoint.nodeName}`,
                    endpoint.zone && `zone ${endpoint.zone}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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

export function EndpointSlicesView(): JSX.Element {
  return (
    <ResourceListView<K8sEndpointSliceSummary, K8sEndpointSlice>
      batch={{ resourceKind: "EndpointSlice" }}
      title="EndpointSlices"
      list={(ctx, ns) =>
        window.api.k8s.listEndpointSlices({ contextName: ctx, namespace: ns })
      }
      getDetail={(ctx, namespace, name) =>
        window.api.k8s.getEndpointSlice({ contextName: ctx, namespace, name })
      }
      detailGuard={(item) =>
        (item as K8sEndpointSliceSummary).addressType !== undefined
      }
      columns={[
        { head: "Name", cell: (s) => s.name },
        { head: "Namespace", cell: (s) => s.namespace },
        { head: "Service", cell: (s) => s.serviceName || "—" },
        { head: "Address Type", cell: (s) => s.addressType },
        {
          head: "Ready",
          cell: (s) => `${s.readyCount} / ${s.endpointCount}`,
          className: (s) =>
            s.readyCount < s.endpointCount
              ? "text-amber-600 dark:text-amber-400 font-semibold"
              : undefined,
        },
        { head: "Ports", cell: (s) => s.ports || "—" },
        ageColumn<K8sEndpointSliceSummary>(),
      ]}
      renderDetail={(slice, ctl: DetailController) => (
        <DetailPanel
          slice={slice}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
