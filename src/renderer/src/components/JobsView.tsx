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
import { K8sJob } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  job,
  onClose,
}: {
  job: K8sJob
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(job.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(job.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))
  const selectorEntries = Object.entries(job.selector).filter(([k, v]) =>
    kv(k, v),
  )

  return (
    <DetailPanelLayout>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{job.name}</h2>
          <span className="text-xs text-muted-foreground">{job.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="Job"
            resourceName={job.name}
            namespace={job.namespace}
            buildYaml={() => ({
              apiVersion: "batch/v1",
              kind: "Job",
              metadata: {
                name: job.name,
                namespace: job.namespace,
                labels: job.labels,
                annotations: job.annotations,
              },
              spec: {
                ...(job.completions !== null
                  ? { completions: job.completions }
                  : {}),
                template: { spec: { containers: [], restartPolicy: "Never" } },
              },
            })}
          />
          <CopyResourceButton
            name={job.name}
            namespace={job.namespace}
            resourceKind="job"
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
        <MetaEntry
          label="Completions"
          value={job.completions !== null ? String(job.completions) : "—"}
        />
        {job.parallelism !== null && (
          <MetaEntry label="Parallelism" value={String(job.parallelism)} />
        )}
        {job.backoffLimit !== null && (
          <MetaEntry label="Backoff Limit" value={String(job.backoffLimit)} />
        )}
        <MetaEntry
          label="Created"
          value={new Date(job.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Status */}
      <div className="space-y-1">
        <SectionHeader title="Status" />
        <MetaEntry
          label="Progress"
          value={
            job.completions !== null
              ? `${job.succeeded}/${job.completions}`
              : String(job.succeeded)
          }
        />
        <MetaEntry label="Succeeded" value={String(job.succeeded)} />
        <MetaEntry label="Failed" value={String(job.failed)} />
        <MetaEntry label="Active" value={String(job.active)} />
        {job.duration && m(job.duration) && (
          <MetaEntry label="Duration" value={job.duration} />
        )}
      </div>

      {/* Timing */}
      {(job.startTime || job.completionTime) && (
        <div className="space-y-1">
          <SectionHeader title="Timing" />
          {job.startTime && m(job.startTime) && (
            <MetaEntry
              label="Start"
              value={new Date(job.startTime).toLocaleString()}
            />
          )}
          {job.completionTime && m(job.completionTime) && (
            <MetaEntry
              label="Completed"
              value={new Date(job.completionTime).toLocaleString()}
            />
          )}
        </div>
      )}

      {/* Conditions */}
      {job.conditions.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Conditions" />
          {job.conditions
            .filter((c) => m(c.type) || m(c.reason) || m(c.message))
            .map((c, i) => (
              <div key={i} className="text-xs border rounded p-2 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.type}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5",
                      c.status === "True"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800",
                    )}
                  >
                    {c.status}
                  </span>
                </div>
                {c.reason && (
                  <div className="text-muted-foreground">{c.reason}</div>
                )}
                {c.message && (
                  <div className="text-muted-foreground">{c.message}</div>
                )}
              </div>
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
        namespace={job.namespace}
        name={job.name}
        kind="Job"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function JobsView(): JSX.Element {
  return (
    <ResourceListView<K8sJob>
      title="Jobs"
      list={(ctx) => window.api.k8s.listJobs({ contextName: ctx })}
      detailGuard={(item) => "active" in item}
      columns={[
        { head: "Name", cell: (job) => job.name },
        { head: "Namespace", cell: (job) => job.namespace },
        {
          head: "Completions",
          cell: (job) =>
            job.completions !== null
              ? `${job.succeeded}/${job.completions}`
              : String(job.succeeded),
        },
        { head: "Active", cell: (job) => job.active },
        { head: "Failed", cell: (job) => job.failed },
        { head: "Duration", cell: (job) => job.duration || "-" },
        ageColumn<K8sJob>(),
      ]}
      renderDetail={(job, ctl: DetailController) => (
        <DetailPanel job={job} onClose={ctl.onClose} />
      )}
    />
  )
}
