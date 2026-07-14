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
import { cn } from "../../lib/utils"
import { K8sNamespace } from "../types/k8s"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

function DetailPanel({
  ns,
  onClose,
}: {
  ns: K8sNamespace
  onClose: () => void
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
    <DetailPanelLayout>
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

      <div className="space-y-1">
        <SectionHeader title="Metadata" />
        <MetaEntry
          label="Created"
          value={new Date(ns.creationTimestamp).toLocaleString()}
        />
      </div>

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

      {/* Namespaces are cluster-scoped; events live across namespaces */}
      <ResourceEventsSection
        namespace=""
        name={ns.name}
        kind="Namespace"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function NamespacesView(): JSX.Element {
  return (
    <ResourceListView<K8sNamespace>
      title="Namespaces"
      namespaced={false}
      list={(ctx) => window.api.k8s.listNamespaces({ contextName: ctx })}
      detailGuard={() => true}
      columns={[
        { head: "Name", cell: (ns) => ns.name },
        { head: "Status", cell: (ns) => ns.status },
        ageColumn<K8sNamespace>(),
      ]}
      renderDetail={(ns, ctl: DetailController) => (
        <DetailPanel ns={ns} onClose={ctl.onClose} />
      )}
    />
  )
}
