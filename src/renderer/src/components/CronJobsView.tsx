import { X } from "lucide-react"
import { useEffect, useState } from "react"

import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { EmptyState } from "../../components/ui/EmptyState"
import { RefreshBar } from "../../components/ui/RefreshBar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { cn, filterResources, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sCronJob } from "../types/k8s"
import { DetailPanelLayout } from "./DetailPanelLayout"
import { EditButton } from "./EditButton"
import { MetaEntry } from "./MetaEntry"
import { ResourceEventsSection } from "./ResourceEventsSection"
import { SectionHeader } from "./SectionHeader"

function DetailPanel({
  cronJob,
  onClose,
}: {
  cronJob: K8sCronJob
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

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
    <DetailPanelLayout>
      {/* Header */}
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
          <CopyResourceButton
            name={cronJob.name}
            namespace={cronJob.namespace}
            resourceKind="cronjob"
          />
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
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
    </DetailPanelLayout>
  )
}

export function CronJobsView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sCronJob | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: cronJobs,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listCronJobs({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || cronJobs.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = cronJobs.find(
      (c) => c.name === item.name && c.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [cronJobs])

  const visibleCronJobs = filterResources(
    cronJobs,
    nameFilter,
    selectedNamespace,
  )

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">CronJobs</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleCronJobs.length === 0 && (
          <EmptyState message="No CronJobs found" />
        )}
        {!loading && !error && visibleCronJobs.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Schedule</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Last Schedule
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Active</TableHead>
                  <TableHead className="whitespace-nowrap">Suspended</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCronJobs.map((cj) => (
                  <TableRow
                    key={`${cj.namespace}/${cj.name}`}
                    className={cn(
                      "cursor-pointer",
                      selectedItem?.name === cj.name &&
                        (selectedItem as K8sCronJob).namespace ===
                          cj.namespace &&
                        "bg-muted",
                    )}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.name === cj.name &&
                          (selectedItem as K8sCronJob).namespace ===
                            cj.namespace
                          ? null
                          : cj,
                      )
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {cj.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {cj.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {cj.schedule}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {cj.lastScheduleTime
                        ? formatAge(cj.lastScheduleTime)
                        : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {cj.activeCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {cj.suspend ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAge(cj.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && "schedule" in selectedItem && (
        <DetailPanel
          cronJob={selectedItem as K8sCronJob}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
