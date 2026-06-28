import { dump as yamlDump } from "js-yaml"
import { X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "../../components/ui/button"
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
import { ResourceEventsSection } from "./ResourceEventsSection"

function SectionHeader({ title }: { title: string }): JSX.Element {
  return (
    <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
      {title}
    </h3>
  )
}

function DetailPanel({
  job,
  onClose,
}: {
  job: K8sJob
  onClose: () => void
}): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(job.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(job.annotations)
    .filter(([k]) => !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"))
    .filter(([k, v]) => kv(k, v))
  const selectorEntries = Object.entries(job.selector).filter(([k, v]) => kv(k, v))

  function handleEdit(): void {
    openDrawerTab({
      tabKey: `yaml-edit:Job:${job.namespace}/${job.name}`,
      type: "yaml-edit",
      resourceKind: "Job",
      resourceName: job.name,
      namespace: job.namespace,
      initialYaml: yamlDump({
        apiVersion: "batch/v1",
        kind: "Job",
        metadata: {
          name: job.name,
          namespace: job.namespace,
          labels: job.labels,
          annotations: job.annotations,
        },
        spec: {
          ...(job.completions !== null ? { completions: job.completions } : {}),
          template: { spec: { containers: [], restartPolicy: "Never" } },
        },
      }),
    })
  }

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{job.name}</h2>
          <span className="text-xs text-muted-foreground">{job.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleEdit}>
            Edit
          </Button>
          <CopyResourceButton name={job.name} namespace={job.namespace} resourceKind="job" />
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
        <MetaEntry label="Created" value={new Date(job.creationTimestamp).toLocaleString()} />
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
                {c.reason && <div className="text-muted-foreground">{c.reason}</div>}
                {c.message && <div className="text-muted-foreground">{c.message}</div>}
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
      <ResourceEventsSection namespace={job.namespace} name={job.name} kind="Job" search={sl} />
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
    const fresh = jobs.find((j) => j.name === item.name && j.namespace === item.namespace)
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Completions</TableHead>
                  <TableHead className="whitespace-nowrap">Active</TableHead>
                  <TableHead className="whitespace-nowrap">Failed</TableHead>
                  <TableHead className="whitespace-nowrap">Duration</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
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
                    <TableCell className="whitespace-nowrap">{job.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{job.namespace}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {job.completions !== null
                        ? `${job.succeeded}/${job.completions}`
                        : String(job.succeeded)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{job.active}</TableCell>
                    <TableCell className="whitespace-nowrap">{job.failed}</TableCell>
                    <TableCell className="whitespace-nowrap">{job.duration || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatAge(job.creationTimestamp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && "active" in selectedItem && (
        <DetailPanel job={selectedItem as K8sJob} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
