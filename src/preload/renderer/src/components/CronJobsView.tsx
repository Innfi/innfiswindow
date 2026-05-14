import { X } from "lucide-react"
import { useEffect } from "react"

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
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

function DetailPanel({
  cronJob,
  onClose,
}: {
  cronJob: K8sCronJob
  onClose: () => void
}): JSX.Element {
  const labelEntries = Object.entries(cronJob.labels)
  const annotationEntries = Object.entries(cronJob.annotations)

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{cronJob.name}</h2>
          <span className="text-xs text-muted-foreground">
            {cronJob.namespace}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-1"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Spec
        </h3>
        <MetaEntry label="Schedule" value={cronJob.schedule} />
        <MetaEntry
          label="Concurrency Policy"
          value={cronJob.concurrencyPolicy || "-"}
        />
        <MetaEntry label="Suspended" value={cronJob.suspend ? "Yes" : "No"} />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Status
        </h3>
        <MetaEntry label="Active Jobs" value={String(cronJob.activeCount)} />
        {cronJob.lastScheduleTime && (
          <MetaEntry label="Last Schedule" value={cronJob.lastScheduleTime} />
        )}
      </div>

      {cronJob.activeJobNames.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Active Job Names
          </h3>
          {cronJob.activeJobNames.map((name) => (
            <div key={name} className="text-xs font-mono truncate">
              {name}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Metadata
        </h3>
        <MetaEntry label="Age" value={formatAge(cronJob.creationTimestamp)} />
      </div>

      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Labels
          </h3>
          {labelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Annotations
          </h3>
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}
    </div>
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
    selectedNamespace,
    nameFilter,
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Last Schedule</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Suspended</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCronJobs.map((cj) => (
                <TableRow
                  key={`${cj.namespace}/${cj.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === cj.name &&
                      (selectedItem as K8sCronJob).namespace === cj.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === cj.name &&
                        (selectedItem as K8sCronJob).namespace === cj.namespace
                        ? null
                        : cj,
                    )
                  }
                >
                  <TableCell>{cj.name}</TableCell>
                  <TableCell>{cj.namespace}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {cj.schedule}
                  </TableCell>
                  <TableCell>
                    {cj.lastScheduleTime ? formatAge(cj.lastScheduleTime) : "-"}
                  </TableCell>
                  <TableCell>{cj.activeCount}</TableCell>
                  <TableCell>{cj.suspend ? "Yes" : "No"}</TableCell>
                  <TableCell>{formatAge(cj.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
