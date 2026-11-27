import { Pause, Play, RotateCw } from "lucide-react"
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
import { ResourceTitle } from "../../components/ui/ResourceTitle"
import { RestartButton } from "../../components/ui/RestartButton"
import { SuspendButton } from "../../components/ui/SuspendButton"
import { cn, filterAnnotations, filterEntries } from "../../lib/utils"
import { K8sJob } from "../types/k8s"
import { RelatedResourcesSection } from "./RelatedResourcesSection"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  job,
  onClose,
  onReloaded,
  onDeleted,
  onDeleteDialogChange,
}: {
  job: K8sJob
  onClose: () => void
  onReloaded: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()
  // A Job that has already finished ignores spec.suspend, so the button that
  // sets it is hidden rather than shown as a no-op.
  const finished = job.conditions.some(
    (c) =>
      (c.type === "Complete" || c.type === "Failed") && c.status === "True",
  )

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)

  const labelEntries = filterEntries(job.labels, sl)
  const annotationEntries = filterAnnotations(job.annotations, sl)
  const selectorEntries = filterEntries(job.selector, sl)

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <ResourceTitle name={job.name} />
              <span className="text-xs text-muted-foreground">
                {job.namespace}
              </span>
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
                    template: {
                      spec: { containers: [], restartPolicy: "Never" },
                    },
                  },
                })}
              />
              {!finished && (
                <SuspendButton
                  resourceKind="Job"
                  resourceName={job.name}
                  namespace={job.namespace}
                  suspended={job.suspend}
                  onChanged={onReloaded}
                  onDialogChange={onDeleteDialogChange}
                />
              )}
              <RestartButton
                resourceKind="Job"
                resourceName={job.name}
                namespace={job.namespace}
                onRestarted={onReloaded}
                onDialogChange={onDeleteDialogChange}
              />
              <DeleteButton
                resourceKind="Job"
                resourceName={job.name}
                namespace={job.namespace}
                propagationPolicy="Background"
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
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
        </>
      }
    >
      {/* Spec */}
      <CollapsibleSection id="job.spec" title="Spec">
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
        <MetaEntry label="Suspended" value={job.suspend ? "Yes" : "No"} />
        <MetaEntry
          label="Created"
          value={new Date(job.creationTimestamp).toLocaleString()}
        />
      </CollapsibleSection>

      {/* Status */}
      <CollapsibleSection id="job.status" title="Status">
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
      </CollapsibleSection>

      {/* Timing */}
      {(job.startTime || job.completionTime) && (
        <CollapsibleSection id="job.timing" title="Timing">
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
        </CollapsibleSection>
      )}

      {/* Conditions */}
      {job.conditions.length > 0 && (
        <CollapsibleSection id="job.conditions" title="Conditions">
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
        </CollapsibleSection>
      )}

      {/* Selector */}
      {selectorEntries.length > 0 && (
        <CollapsibleSection id="job.selector" title="Selector">
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </CollapsibleSection>
      )}

      {/* Labels */}
      {labelEntries.length > 0 && (
        <CollapsibleSection id="job.labels" title="Labels">
          <LabelEntries entries={labelEntries} />
        </CollapsibleSection>
      )}

      {/* Annotations */}
      {annotationEntries.length > 0 && (
        <CollapsibleSection id="job.annotations" title="Annotations">
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </CollapsibleSection>
      )}

      {/* Events */}
      <ResourceEventsSection
        namespace={job.namespace}
        name={job.name}
        kind="Job"
        search={sl}
        collapsibleId="job.events"
      />

      <RelatedResourcesSection
        resourceKind="Job"
        namespace={job.namespace}
        name={job.name}
        search={sl}
        collapsibleId="job.related"
      />
    </DetailPanelLayout>
  )
}

export function JobsView(): JSX.Element {
  return (
    <ResourceListView<K8sJob>
      title="Jobs"
      watch="jobs"
      batch={{
        resourceKind: "Job",
        actions: [
          {
            label: "Restart",
            runningLabel: "Restarting",
            action: "restart",
            icon: RotateCw,
            destructive: true,
            warning:
              "Jobs are immutable: each selected Job is deleted and recreated from its spec. This cannot be undone.",
            run: (j, ctx) =>
              window.api.k8s.restartJob({
                contextName: ctx,
                namespace: j.namespace,
                name: j.name,
              }),
          },
          {
            label: "Suspend",
            runningLabel: "Suspending",
            action: "suspend",
            icon: Pause,
            run: (j, ctx) =>
              window.api.k8s.setJobSuspend({
                contextName: ctx,
                namespace: j.namespace,
                name: j.name,
                suspend: true,
              }),
          },
          {
            label: "Resume",
            runningLabel: "Resuming",
            action: "resume",
            icon: Play,
            run: (j, ctx) =>
              window.api.k8s.setJobSuspend({
                contextName: ctx,
                namespace: j.namespace,
                name: j.name,
                suspend: false,
              }),
          },
        ],
      }}
      list={(ctx, ns, sel) =>
        window.api.k8s.listJobs({
          contextName: ctx,
          namespace: ns,
          labelSelector: sel,
        })
      }
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
        { head: "Suspended", cell: (job) => (job.suspend ? "Yes" : "No") },
        ageColumn<K8sJob>(),
      ]}
      renderDetail={(job, ctl: DetailController) => (
        <DetailPanel
          job={job}
          onClose={ctl.onClose}
          onReloaded={ctl.onDeleted}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
