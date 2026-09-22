import { useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CollapsibleSection } from "../../components/ui/CollapsibleSection"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DeleteButton } from "../../components/ui/DeleteButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { EditButton } from "../../components/ui/EditButton"
import { LabelEntries } from "../../components/ui/LabelEntries"
import { MetaEntry } from "../../components/ui/MetaEntry"
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { cn } from "../../lib/utils"
import { K8sNamespace } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  ns,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  ns: K8sNamespace
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const kv = (k: string, v: string): boolean =>
    !sl || k.toLowerCase().includes(sl) || v.toLowerCase().includes(sl)

  const labelEntries = Object.entries(ns.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(ns.annotations)
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
              <h2 className="font-semibold text-base mb-1">{ns.name}</h2>
              <span
                className={cn(
                  "inline-block rounded px-2 py-0.5 text-xs font-medium",
                  ns.status === "Active"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800",
                )}
              >
                {ns.status}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="Namespace"
                resourceName={ns.name}
                buildYaml={() => ({
                  apiVersion: "v1",
                  kind: "Namespace",
                  metadata: {
                    name: ns.name,
                    labels: ns.labels,
                    annotations: ns.annotations,
                  },
                })}
              />
              <DeleteButton
                resourceKind="Namespace"
                resourceName={ns.name}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
                warning="Every resource in this namespace is deleted with it."
              />
              <CopyResourceButton name={ns.name} resourceKind="namespace" />
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
      <CollapsibleSection id="namespace.metadata" title="Metadata">
        <MetaEntry
          label="Created"
          value={new Date(ns.creationTimestamp).toLocaleString()}
        />
      </CollapsibleSection>

      {labelEntries.length > 0 && (
        <CollapsibleSection id="namespace.labels" title="Labels">
          <LabelEntries entries={labelEntries} />
        </CollapsibleSection>
      )}

      {annotationEntries.length > 0 && (
        <CollapsibleSection id="namespace.annotations" title="Annotations">
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </CollapsibleSection>
      )}

      {/* Namespaces are cluster-scoped; events live across namespaces */}
      <ResourceEventsSection
        namespace=""
        name={ns.name}
        kind="Namespace"
        search={sl}
        collapsibleId="namespace.events"
      />
    </DetailPanelLayout>
  )
}

export function NamespacesView(): JSX.Element {
  return (
    <ResourceListView<K8sNamespace>
      title="Namespaces"
      namespaced={false}
      list={(ctx, _ns, sel, fieldSel) =>
        window.api.k8s.listNamespaces({
          contextName: ctx,
          labelSelector: sel,
          fieldSelector: fieldSel,
        })
      }
      detailGuard={() => true}
      columns={[
        { head: "Name", cell: (ns) => ns.name },
        { head: "Status", cell: (ns) => ns.status },
        ageColumn<K8sNamespace>(),
      ]}
      renderDetail={(ns, ctl: DetailController) => (
        <DetailPanel
          ns={ns}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
