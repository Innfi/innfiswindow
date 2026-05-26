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
import { K8sJob } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"

function DetailPanel({
  job,
  onClose,
}: {
  job: K8sJob
  onClose: () => void
}): JSX.Element {
  const labelEntries = Object.entries(job.labels)
  const annotationEntries = Object.entries(job.annotations)

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{job.name}</h2>
          <span className="text-xs text-muted-foreground">{job.namespace}</span>
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
          Status
        </h3>
        <MetaEntry
          label="Completions"
          value={
            job.completions !== null
              ? `${job.succeeded}/${job.completions}`
              : String(job.succeeded)
          }
        />
        <MetaEntry label="Succeeded" value={String(job.succeeded)} />
        <MetaEntry label="Failed" value={String(job.failed)} />
        <MetaEntry label="Active" value={String(job.active)} />
        {job.duration && <MetaEntry label="Duration" value={job.duration} />}
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Timing
        </h3>
        {job.startTime && (
          <MetaEntry label="Start Time" value={job.startTime} />
        )}
        {job.completionTime && (
          <MetaEntry label="Completion Time" value={job.completionTime} />
        )}
      </div>

      {job.conditions.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Conditions
          </h3>
          {job.conditions.map((c, i) => (
            <div key={i} className="text-xs">
              <span className="font-medium">{c.type}</span>
              {": "}
              <span>{c.status}</span>
              {c.reason && (
                <span className="text-muted-foreground"> ({c.reason})</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Metadata
        </h3>
        <MetaEntry label="Age" value={formatAge(job.creationTimestamp)} />
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

export function JobsView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sJob | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: jobs,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listJobs({ contextName: ctx }),
    selectedContext,
  )

  useEffect(() => {
    if (!selectedItem || jobs.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = jobs.find(
      (j) => j.name === item.name && j.namespace === item.namespace,
    )
    if (fresh) setSelectedItem(fresh as object)
  }, [jobs])

  const visibleJobs = filterResources(jobs, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Jobs</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleJobs.length === 0 && (
          <EmptyState message="No Jobs found" />
        )}
        {!loading && !error && visibleJobs.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Completions</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleJobs.map((job) => (
                <TableRow
                  key={`${job.namespace}/${job.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === job.name &&
                      (selectedItem as K8sJob).namespace === job.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === job.name &&
                        (selectedItem as K8sJob).namespace === job.namespace
                        ? null
                        : job,
                    )
                  }
                >
                  <TableCell>{job.name}</TableCell>
                  <TableCell>{job.namespace}</TableCell>
                  <TableCell>
                    {job.completions !== null
                      ? `${job.succeeded}/${job.completions}`
                      : String(job.succeeded)}
                  </TableCell>
                  <TableCell>{job.active}</TableCell>
                  <TableCell>{job.failed}</TableCell>
                  <TableCell>{job.duration || "-"}</TableCell>
                  <TableCell>{formatAge(job.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && "active" in selectedItem && (
        <DetailPanel
          job={selectedItem as K8sJob}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
