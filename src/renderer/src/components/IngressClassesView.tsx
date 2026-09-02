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
import { K8sIngressClass, K8sIngressClassParametersRef } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

const DEFAULT_CLASS_ANNOTATION = "ingressclass.kubernetes.io/is-default-class"

function DefaultBadge(): JSX.Element {
  return (
    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900 dark:text-green-300">
      default
    </span>
  )
}

/** `<group>/<Kind>/<name>`, with the core group left off the way the API reads
 *  an unset apiGroup. */
function formatParametersRef(ref: K8sIngressClassParametersRef): string {
  const kind = ref.apiGroup ? `${ref.apiGroup}/${ref.kind}` : ref.kind
  return ref.scope === "Namespace" && ref.namespace
    ? `${kind}/${ref.namespace}/${ref.name}`
    : `${kind}/${ref.name}`
}

function DetailPanel({
  ic,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  ic: K8sIngressClass
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(ic.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(ic.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1 flex items-center gap-2">
                {ic.name}
                {ic.isDefault && <DefaultBadge />}
              </h2>
              <span className="text-xs text-muted-foreground">
                cluster-scoped
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="IngressClass"
                resourceName={ic.name}
                buildYaml={() => ({
                  apiVersion: "networking.k8s.io/v1",
                  kind: "IngressClass",
                  metadata: {
                    name: ic.name,
                    ...(Object.keys(ic.labels).length > 0 && {
                      labels: ic.labels,
                    }),
                    ...(ic.isDefault && {
                      annotations: { [DEFAULT_CLASS_ANNOTATION]: "true" },
                    }),
                  },
                  spec: {
                    controller: ic.controller,
                    ...(ic.parameters && {
                      parameters: {
                        ...(ic.parameters.apiGroup && {
                          apiGroup: ic.parameters.apiGroup,
                        }),
                        kind: ic.parameters.kind,
                        name: ic.parameters.name,
                        scope: ic.parameters.scope,
                        ...(ic.parameters.scope === "Namespace" &&
                          ic.parameters.namespace && {
                            namespace: ic.parameters.namespace,
                          }),
                      },
                    }),
                  },
                })}
              />
              <DeleteButton
                resourceKind="IngressClass"
                resourceName={ic.name}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
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
        </>
      }
    >
      <div className="space-y-1">
        <SectionHeader title="Spec" />
        <MetaEntry label="Controller" value={ic.controller || "—"} mono />
        <MetaEntry label="Default Class" value={ic.isDefault ? "Yes" : "No"} />
        <MetaEntry
          label="Created"
          value={new Date(ic.creationTimestamp).toLocaleString()}
        />
      </div>

      {ic.parameters && (
        <div className="space-y-1">
          <SectionHeader title="Parameters" />
          <MetaEntry
            label="API Group"
            value={ic.parameters.apiGroup || "core"}
            mono
          />
          <MetaEntry label="Kind" value={ic.parameters.kind || "—"} />
          <MetaEntry label="Name" value={ic.parameters.name || "—"} mono />
          <MetaEntry label="Scope" value={ic.parameters.scope} />
          {ic.parameters.scope === "Namespace" && (
            <MetaEntry
              label="Namespace"
              value={ic.parameters.namespace || "—"}
            />
          )}
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

      <ResourceEventsSection
        namespace=""
        name={ic.name}
        kind="IngressClass"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function IngressClassesView(): JSX.Element {
  return (
    <ResourceListView<K8sIngressClass>
      batch={{ resourceKind: "IngressClass" }}
      title="Ingress Classes"
      emptyMessage="No IngressClasses found"
      namespaced={false}
      list={(ctx) => window.api.k8s.listIngressClasses({ contextName: ctx })}
      detailGuard={(item) => (item as K8sIngressClass).controller !== undefined}
      columns={[
        {
          head: "Name",
          cell: (ic) => (
            <span className="flex items-center gap-2">
              {ic.name}
              {ic.isDefault && <DefaultBadge />}
            </span>
          ),
          className: "font-medium",
        },
        {
          head: "Controller",
          cell: (ic) => ic.controller || "—",
          className: "font-mono text-xs",
        },
        {
          head: "Parameters",
          cell: (ic) =>
            ic.parameters ? formatParametersRef(ic.parameters) : "—",
          className: "font-mono text-xs",
        },
        ageColumn<K8sIngressClass>(),
      ]}
      renderDetail={(ic, ctl: DetailController) => (
        <DetailPanel
          ic={ic}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
