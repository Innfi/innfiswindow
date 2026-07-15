import { useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { EditButton } from "../../components/ui/EditButton"
import { MetaEntry } from "../../components/ui/MetaEntry"
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { K8sPDB } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  pdb,
  onClose,
}: {
  pdb: K8sPDB
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const selectorEntries = Object.entries(pdb.selector).filter(([k, v]) =>
    kv(k, v),
  )
  const labelEntries = Object.entries(pdb.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(pdb.annotations)
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
          <h2 className="font-semibold text-base mb-1">{pdb.name}</h2>
          <span className="text-xs text-muted-foreground">{pdb.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="PodDisruptionBudget"
            resourceName={pdb.name}
            namespace={pdb.namespace}
            buildYaml={() => ({
              apiVersion: "policy/v1",
              kind: "PodDisruptionBudget",
              metadata: {
                name: pdb.name,
                namespace: pdb.namespace,
                labels: pdb.labels,
                annotations: pdb.annotations,
              },
              spec: {
                ...(pdb.minAvailable != null
                  ? { minAvailable: pdb.minAvailable }
                  : {}),
                ...(pdb.maxUnavailable != null
                  ? { maxUnavailable: pdb.maxUnavailable }
                  : {}),
                selector: { matchLabels: pdb.selector },
              },
            })}
          />
          <CopyResourceButton
            name={pdb.name}
            namespace={pdb.namespace}
            resourceKind="poddisruptionbudget"
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
        {pdb.minAvailable != null && m(String(pdb.minAvailable)) && (
          <MetaEntry label="Min Available" value={pdb.minAvailable} />
        )}
        {pdb.maxUnavailable != null && m(String(pdb.maxUnavailable)) && (
          <MetaEntry label="Max Unavailable" value={pdb.maxUnavailable} />
        )}
        <MetaEntry
          label="Created"
          value={new Date(pdb.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Status */}
      <div className="space-y-1">
        <SectionHeader title="Status" />
        <MetaEntry label="Current Healthy" value={String(pdb.currentHealthy)} />
        <MetaEntry label="Desired Healthy" value={String(pdb.desiredHealthy)} />
        <MetaEntry
          label="Disruptions Allowed"
          value={String(pdb.disruptionsAllowed)}
        />
        <MetaEntry label="Expected Pods" value={String(pdb.expectedPods)} />
      </div>

      {/* Selector */}
      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Selector" />
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

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
        namespace={pdb.namespace}
        name={pdb.name}
        kind="PodDisruptionBudget"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function PDBsView(): JSX.Element {
  return (
    <ResourceListView<K8sPDB>
      title="PodDisruptionBudgets"
      list={(ctx) => window.api.k8s.listPDBs({ contextName: ctx })}
      detailGuard={(item) => (item as K8sPDB).selector !== undefined}
      columns={[
        { head: "Name", cell: (p) => p.name },
        { head: "Namespace", cell: (p) => p.namespace },
        { head: "Min Available", cell: (p) => p.minAvailable ?? "—" },
        { head: "Max Unavailable", cell: (p) => p.maxUnavailable ?? "—" },
        { head: "Current Healthy", cell: (p) => p.currentHealthy },
        {
          head: "Disruptions Allowed",
          cell: (p) => p.disruptionsAllowed,
          className: (p) =>
            p.disruptionsAllowed === 0
              ? "text-red-500 font-semibold"
              : undefined,
        },
        ageColumn<K8sPDB>(),
      ]}
      renderDetail={(pdb, ctl: DetailController) => (
        <DetailPanel pdb={pdb} onClose={ctl.onClose} />
      )}
    />
  )
}
