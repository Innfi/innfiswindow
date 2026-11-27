import { Pause, Play, PlayCircle } from "lucide-react"
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
import { filterAnnotations, filterEntries, formatAge } from "../../lib/utils"
import { K8sCronJob } from "../types/k8s"
import { RelatedResourcesSection } from "./RelatedResourcesSection"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  cronJob,
  onClose,
  onReloaded,
  onDeleted,
  onDeleteDialogChange,
}: {
  cronJob: K8sCronJob
  onClose: () => void
  onReloaded: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)

  const labelEntries = filterEntries(cronJob.labels, sl)
  const annotationEntries = filterAnnotations(cronJob.annotations, sl)
  const activeNames = cronJob.activeJobNames.filter((n) => m(n))

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <ResourceTitle name={cronJob.name} />
              <span className="text-xs text-muted-foreground">
                {cronJob.namespace}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="CronJob"
                resourceName={cronJob.name}
                namespace={cronJob.namespace}
                buildYaml={() => ({
                  apiVersion: "batch/v1",
                  kind: "CronJob",
                  metadata: {
                    name: cronJob.name,
                    namespace: cronJob.namespace,
                    labels: cronJob.labels,
                    annotations: cronJob.annotations,
                  },
                  spec: {
                    schedule: cronJob.schedule,
                    concurrencyPolicy: cronJob.concurrencyPolicy || "Allow",
                    suspend: cronJob.suspend,
                    jobTemplate: {
                      spec: { template: { spec: { containers: [] } } },
                    },
                  },
                })}
              />
              <SuspendButton
                resourceKind="CronJob"
                resourceName={cronJob.name}
                namespace={cronJob.namespace}
                suspended={cronJob.suspend}
                onChanged={onReloaded}
                onDialogChange={onDeleteDialogChange}
              />
              <RestartButton
                resourceKind="CronJob"
                resourceName={cronJob.name}
                namespace={cronJob.namespace}
                onRestarted={onReloaded}
                onDialogChange={onDeleteDialogChange}
              />
              <DeleteButton
                resourceKind="CronJob"
                resourceName={cronJob.name}
                namespace={cronJob.namespace}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
              />
              <CopyResourceButton
                name={cronJob.name}
                namespace={cronJob.namespace}
                resourceKind="cronjob"
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
      <CollapsibleSection id="cronJob.spec" title="Spec">
        <MetaEntry label="Schedule" value={cronJob.schedule} mono />
        <MetaEntry
          label="Concurrency Policy"
          value={cronJob.concurrencyPolicy || "-"}
        />
        <MetaEntry label="Suspended" value={cronJob.suspend ? "Yes" : "No"} />
        {cronJob.successfulJobsHistoryLimit !== null && (
          <MetaEntry
            label="Successful History"
            value={String(cronJob.successfulJobsHistoryLimit)}
          />
        )}
        {cronJob.failedJobsHistoryLimit !== null && (
          <MetaEntry
            label="Failed History"
            value={String(cronJob.failedJobsHistoryLimit)}
          />
        )}
        {cronJob.startingDeadlineSeconds !== null && (
          <MetaEntry
            label="Starting Deadline"
            value={`${cronJob.startingDeadlineSeconds}s`}
          />
        )}
        <MetaEntry
          label="Created"
          value={new Date(cronJob.creationTimestamp).toLocaleString()}
        />
      </CollapsibleSection>

      {/* Status */}
      <CollapsibleSection id="cronJob.status" title="Status">
        <MetaEntry label="Active Jobs" value={String(cronJob.activeCount)} />
        {cronJob.lastScheduleTime && m(cronJob.lastScheduleTime) && (
          <MetaEntry
            label="Last Scheduled"
            value={new Date(cronJob.lastScheduleTime).toLocaleString()}
          />
        )}
      </CollapsibleSection>

      {/* Active Jobs */}
      {activeNames.length > 0 && (
        <CollapsibleSection
          id="cronJob.activeJobNames"
          title="Active Job Names"
        >
          {activeNames.map((name) => (
            <div key={name} className="text-xs font-mono truncate">
              {name}
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Labels */}
      {labelEntries.length > 0 && (
        <CollapsibleSection id="cronJob.labels" title="Labels">
          <LabelEntries entries={labelEntries} />
        </CollapsibleSection>
      )}

      {/* Annotations */}
      {annotationEntries.length > 0 && (
        <CollapsibleSection id="cronJob.annotations" title="Annotations">
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </CollapsibleSection>
      )}

      {/* Events */}
      <ResourceEventsSection
        namespace={cronJob.namespace}
        name={cronJob.name}
        kind="CronJob"
        search={sl}
        collapsibleId="cronJob.events"
      />

      <RelatedResourcesSection
        resourceKind="CronJob"
        namespace={cronJob.namespace}
        name={cronJob.name}
        search={sl}
        collapsibleId="cronJob.related"
      />
    </DetailPanelLayout>
  )
}

export function CronJobsView(): JSX.Element {
  return (
    <ResourceListView<K8sCronJob>
      title="CronJobs"
      watch="cronjobs"
      batch={{
        resourceKind: "CronJob",
        actions: [
          {
            label: "Trigger",
            runningLabel: "Triggering",
            action: "create",
            icon: PlayCircle,
            warning:
              "Each selected CronJob gets a Job created from its template now, on top of its schedule.",
            run: (cj, ctx) =>
              window.api.k8s.restartCronJob({
                contextName: ctx,
                namespace: cj.namespace,
                name: cj.name,
              }),
          },
          {
            label: "Suspend",
            runningLabel: "Suspending",
            action: "suspend",
            icon: Pause,
            run: (cj, ctx) =>
              window.api.k8s.setCronJobSuspend({
                contextName: ctx,
                namespace: cj.namespace,
                name: cj.name,
                suspend: true,
              }),
          },
          {
            label: "Resume",
            runningLabel: "Resuming",
            action: "resume",
            icon: Play,
            run: (cj, ctx) =>
              window.api.k8s.setCronJobSuspend({
                contextName: ctx,
                namespace: cj.namespace,
                name: cj.name,
                suspend: false,
              }),
          },
        ],
      }}
      list={(ctx, ns, sel) =>
        window.api.k8s.listCronJobs({
          contextName: ctx,
          namespace: ns,
          labelSelector: sel,
        })
      }
      detailGuard={(item) => "schedule" in item}
      columns={[
        { head: "Name", cell: (cj) => cj.name },
        { head: "Namespace", cell: (cj) => cj.namespace },
        {
          head: "Schedule",
          cell: (cj) => cj.schedule,
          className: "font-mono text-xs",
        },
        {
          head: "Last Schedule",
          cell: (cj) =>
            cj.lastScheduleTime ? formatAge(cj.lastScheduleTime) : "-",
        },
        { head: "Active", cell: (cj) => cj.activeCount },
        { head: "Suspended", cell: (cj) => (cj.suspend ? "Yes" : "No") },
        ageColumn<K8sCronJob>(),
      ]}
      renderDetail={(cronJob, ctl: DetailController) => (
        <DetailPanel
          cronJob={cronJob}
          onClose={ctl.onClose}
          onReloaded={ctl.onDeleted}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
