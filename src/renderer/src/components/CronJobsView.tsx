import { Pause, Play, PlayCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/AlertDialog"
import { Button } from "../../components/ui/Button"
import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
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
import { SuspendButton } from "../../components/ui/SuspendButton"
import { formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useRecordHistory } from "../hooks/useRecordHistory"
import { K8sCronJob } from "../types/k8s"
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
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()
  const [restartOpen, setRestartOpen] = useState(false)
  const [restarting, setRestarting] = useState(false)

  async function handleRestart(): Promise<void> {
    const target = {
      action: "restart",
      resourceKind: "CronJob",
      resourceName: cronJob.name,
      namespace: cronJob.namespace,
    } as const
    setRestarting(true)
    try {
      await window.api.k8s.restartCronJob({
        contextName: selectedContext ?? undefined,
        namespace: cronJob.namespace,
        name: cronJob.name,
      })
      recordHistory(target, { success: true })
      toast.success(`Triggered a new job run for ${cronJob.name}`)
      setRestartOpen(false)
      onReloaded()
    } catch (e) {
      recordHistory(target, { success: false, error: String(e) })
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "CronJob: restart")
      setRestartOpen(false)
    } finally {
      setRestarting(false)
    }
  }

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(cronJob.labels).filter(([k, v]) =>
    kv(k, v),
  )
  const annotationEntries = Object.entries(cronJob.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))
  const activeNames = cronJob.activeJobNames.filter((n) => m(n))

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1">{cronJob.name}</h2>
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
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setRestartOpen(true)}
              >
                Restart
              </Button>
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
      <div className="space-y-1">
        <SectionHeader title="Spec" />
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
      </div>

      {/* Status */}
      <div className="space-y-1">
        <SectionHeader title="Status" />
        <MetaEntry label="Active Jobs" value={String(cronJob.activeCount)} />
        {cronJob.lastScheduleTime && m(cronJob.lastScheduleTime) && (
          <MetaEntry
            label="Last Scheduled"
            value={new Date(cronJob.lastScheduleTime).toLocaleString()}
          />
        )}
      </div>

      {/* Active Jobs */}
      {activeNames.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Active Job Names" />
          {activeNames.map((name) => (
            <div key={name} className="text-xs font-mono truncate">
              {name}
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
        namespace={cronJob.namespace}
        name={cronJob.name}
        kind="CronJob"
        search={sl}
      />

      <AlertDialog open={restartOpen} onOpenChange={setRestartOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restart CronJob</AlertDialogTitle>
            <AlertDialogDescription>
              CronJobs have no restart, so this manually triggers a new job run
              for{" "}
              <strong>
                {cronJob.namespace}/{cronJob.name}
              </strong>{" "}
              now, from its job template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestartOpen(false)}
              disabled={restarting}
            >
              Cancel
            </Button>
            <Button onClick={handleRestart} disabled={restarting}>
              {restarting ? "Triggering…" : "Restart"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailPanelLayout>
  )
}

export function CronJobsView(): JSX.Element {
  return (
    <ResourceListView<K8sCronJob>
      title="CronJobs"
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
      list={(ctx, ns) =>
        window.api.k8s.listCronJobs({ contextName: ctx, namespace: ns })
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
