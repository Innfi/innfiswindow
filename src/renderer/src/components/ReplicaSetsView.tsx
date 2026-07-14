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
import { K8sReplicaSet } from "../types/k8s"
import { ContainerCard } from "./ContainerCard"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

function DetailPanel({
  rs,
  onClose,
}: {
  rs: K8sReplicaSet
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const selectorEntries = Object.entries(rs.selector).filter(([k, v]) =>
    kv(k, v),
  )
  const podTemplateEntries = Object.entries(rs.podTemplateLabels).filter(
    ([k, v]) => kv(k, v),
  )
  const labelEntries = Object.entries(rs.labels ?? {}).filter(([k, v]) =>
    kv(k, v),
  )
  const annotationEntries = Object.entries(rs.annotations ?? {})
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
          <h2 className="font-semibold text-base mb-1">{rs.name}</h2>
          <span className="text-xs text-muted-foreground">{rs.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="ReplicaSet"
            resourceName={rs.name}
            namespace={rs.namespace}
            buildYaml={() => ({
              apiVersion: "apps/v1",
              kind: "ReplicaSet",
              metadata: { name: rs.name, namespace: rs.namespace },
              spec: {
                replicas: rs.desiredReplicas,
                selector: { matchLabels: rs.selector },
                template: {
                  metadata: { labels: rs.podTemplateLabels },
                  spec: {
                    containers: rs.containers.map((c) => ({
                      name: c.name,
                      image: c.image,
                    })),
                  },
                },
              },
            })}
          />
          <CopyResourceButton
            name={rs.name}
            namespace={rs.namespace}
            resourceKind="replicaset"
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

      {/* Replicas */}
      <div className="space-y-1">
        <SectionHeader title="Replicas" />
        <MetaEntry label="Desired" value={String(rs.desiredReplicas)} />
        <MetaEntry label="Current" value={String(rs.currentReplicas)} />
        <MetaEntry label="Ready" value={String(rs.readyReplicas)} />
        {rs.serviceAccountName && m(rs.serviceAccountName) && (
          <MetaEntry label="Service Account" value={rs.serviceAccountName} />
        )}
        <MetaEntry
          label="Created"
          value={new Date(rs.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Owner References */}
      {rs.ownerReferences.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Owner References" />
          {rs.ownerReferences.map((o, i) => (
            <div key={i} className="text-sm border rounded p-2 space-y-0.5">
              <div className="font-medium">{o.name}</div>
              <div className="text-xs text-muted-foreground">{o.kind}</div>
            </div>
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

      {/* Selector */}
      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Selector" />
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Pod Template Labels */}
      {podTemplateEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Pod Template" />
          {podTemplateEntries.map(([k, v]) => (
            <MetaEntry key={k} label={`label: ${k}`} value={v} />
          ))}
        </div>
      )}

      {/* Init Containers */}
      {rs.initContainers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Init Containers" />
          {rs.initContainers
            .filter((c) => m(c.name) || m(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Containers */}
      {rs.containers.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Containers" />
          {rs.containers
            .filter((c) => m(c.name) || m(c.image))
            .map((c) => (
              <ContainerCard key={c.name} container={c} search={sl} />
            ))}
        </div>
      )}

      {/* Volumes */}
      {rs.volumes.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Volumes" />
          {rs.volumes
            .filter((v) => m(v.name) || m(v.type) || m(v.detail))
            .map((v) => (
              <div
                key={v.name}
                className="text-xs border rounded p-2 space-y-0.5"
              >
                <div className="font-medium">{v.name}</div>
                <div className="text-muted-foreground">
                  {v.type}
                  {v.detail ? `: ${v.detail}` : ""}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Events */}
      <ResourceEventsSection
        namespace={rs.namespace}
        name={rs.name}
        kind="ReplicaSet"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function ReplicaSetsView(): JSX.Element {
  return (
    <ResourceListView<K8sReplicaSet>
      title="ReplicaSets"
      emptyMessage="No Replica Sets found"
      list={(ctx) => window.api.k8s.listReplicaSets({ contextName: ctx })}
      detailGuard={(item) => {
        const rs = item as K8sReplicaSet
        return rs.namespace !== undefined && rs.desiredReplicas !== undefined
      }}
      columns={[
        { head: "Name", cell: (rs) => rs.name },
        { head: "Namespace", cell: (rs) => rs.namespace },
        { head: "Desired", cell: (rs) => rs.desiredReplicas },
        { head: "Current", cell: (rs) => rs.currentReplicas },
        { head: "Ready", cell: (rs) => rs.readyReplicas },
        ageColumn<K8sReplicaSet>(),
      ]}
      renderDetail={(rs, ctl: DetailController) => (
        <DetailPanel rs={rs} onClose={ctl.onClose} />
      )}
    />
  )
}
