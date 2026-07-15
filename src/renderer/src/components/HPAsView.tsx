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
import { cn } from "../../lib/utils"
import { K8sHPA } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  hpa,
  onClose,
}: {
  hpa: K8sHPA
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(hpa.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(hpa.annotations)
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
          <h2 className="font-semibold text-base mb-1">{hpa.name}</h2>
          <span className="text-xs text-muted-foreground">{hpa.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="HPA"
            resourceName={hpa.name}
            namespace={hpa.namespace}
            buildYaml={() => ({
              apiVersion: "autoscaling/v2",
              kind: "HorizontalPodAutoscaler",
              metadata: {
                name: hpa.name,
                namespace: hpa.namespace,
                labels: hpa.labels,
                annotations: hpa.annotations,
              },
              spec: {
                scaleTargetRef: {
                  apiVersion: "apps/v1",
                  kind: hpa.targetRef.kind,
                  name: hpa.targetRef.name,
                },
                minReplicas: hpa.minReplicas,
                maxReplicas: hpa.maxReplicas,
              },
            })}
          />
          <CopyResourceButton
            name={hpa.name}
            namespace={hpa.namespace}
            resourceKind="horizontalpodautoscaler"
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

      {/* Scale Target */}
      <div className="space-y-1">
        <SectionHeader title="Scale Target" />
        <MetaEntry label="Kind" value={hpa.targetRef.kind} />
        <MetaEntry label="Name" value={hpa.targetRef.name} />
        <MetaEntry
          label="Created"
          value={new Date(hpa.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Replicas */}
      <div className="space-y-1">
        <SectionHeader title="Replicas" />
        <MetaEntry label="Min" value={String(hpa.minReplicas)} />
        <MetaEntry label="Max" value={String(hpa.maxReplicas)} />
        <MetaEntry label="Current" value={String(hpa.currentReplicas)} />
        <MetaEntry label="Desired" value={String(hpa.desiredReplicas)} />
      </div>

      {/* Metrics */}
      {hpa.metrics.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Metrics" />
          {hpa.metrics
            .filter((met) => m(met.type) || m(met.target) || m(met.current))
            .map((met, i) => (
              <div key={i} className="text-sm border rounded p-2 space-y-0.5">
                <div className="font-medium">{met.type}</div>
                {met.target && (
                  <div className="text-xs text-muted-foreground">
                    Target: {met.target}
                  </div>
                )}
                {met.current && (
                  <div className="text-xs text-muted-foreground">
                    Current: {met.current}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Conditions */}
      {hpa.conditions.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Conditions" />
          {hpa.conditions
            .filter((c) => m(c.type) || m(c.reason) || m(c.message))
            .map((c) => (
              <div
                key={c.type}
                className="text-sm space-y-0.5 border rounded p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.type}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs",
                      c.status === "True"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800",
                    )}
                  >
                    {c.status}
                  </span>
                </div>
                {c.reason && (
                  <div className="text-xs text-muted-foreground">
                    {c.reason}
                  </div>
                )}
                {c.message && (
                  <div className="text-xs text-muted-foreground">
                    {c.message}
                  </div>
                )}
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

      {/* Events */}
      <ResourceEventsSection
        namespace={hpa.namespace}
        name={hpa.name}
        kind="HorizontalPodAutoscaler"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function HPAsView(): JSX.Element {
  return (
    <ResourceListView<K8sHPA>
      title="HorizontalPodAutoscalers"
      list={(ctx) => window.api.k8s.listHPAs({ contextName: ctx })}
      detailGuard={(item) => (item as K8sHPA).namespace !== undefined}
      columns={[
        { head: "Name", cell: (h) => h.name },
        { head: "Namespace", cell: (h) => h.namespace },
        {
          head: "Target",
          cell: (h) => `${h.targetRef.kind}/${h.targetRef.name}`,
        },
        { head: "Min", cell: (h) => h.minReplicas },
        { head: "Max", cell: (h) => h.maxReplicas },
        {
          head: "Replicas",
          cell: (h) => `${h.currentReplicas}/${h.desiredReplicas}`,
        },
        ageColumn<K8sHPA>(),
      ]}
      renderDetail={(hpa, ctl: DetailController) => (
        <DetailPanel hpa={hpa} onClose={ctl.onClose} />
      )}
    />
  )
}
