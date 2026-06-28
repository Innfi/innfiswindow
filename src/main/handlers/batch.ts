import { BatchV1Api } from "@kubernetes/client-node"

import { CronJobInfo, JobInfo } from "./types"

export async function listJobs(api: BatchV1Api): Promise<JobInfo[]> {
  const res = await api.listJobForAllNamespaces()
  return res.items.map((job) => {
    const startTime = job.status?.startTime?.toISOString() ?? ""
    const completionTime = job.status?.completionTime?.toISOString() ?? ""
    let duration = ""
    if (startTime && completionTime) {
      const ms = new Date(completionTime).getTime() - new Date(startTime).getTime()
      const totalSecs = Math.floor(ms / 1000)
      const mins = Math.floor(totalSecs / 60)
      const secs = totalSecs % 60
      duration = mins > 0 ? `${mins}m${secs}s` : `${secs}s`
    }
    return {
      name: job.metadata?.name ?? "",
      namespace: job.metadata?.namespace ?? "",
      completions: job.spec?.completions ?? null,
      parallelism: job.spec?.parallelism ?? null,
      backoffLimit: job.spec?.backoffLimit ?? null,
      succeeded: job.status?.succeeded ?? 0,
      failed: job.status?.failed ?? 0,
      active: job.status?.active ?? 0,
      startTime,
      completionTime,
      duration,
      conditions: (job.status?.conditions ?? []).map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason ?? "",
        message: c.message ?? "",
      })),
      selector: job.spec?.selector?.matchLabels ?? {},
      creationTimestamp: job.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: job.metadata?.labels ?? {},
      annotations: job.metadata?.annotations ?? {},
    }
  })
}

export async function listCronJobs(api: BatchV1Api): Promise<CronJobInfo[]> {
  const res = await api.listCronJobForAllNamespaces()
  return res.items.map((cj) => {
    const activeJobs = cj.status?.active ?? []
    return {
      name: cj.metadata?.name ?? "",
      namespace: cj.metadata?.namespace ?? "",
      schedule: cj.spec?.schedule ?? "",
      concurrencyPolicy: cj.spec?.concurrencyPolicy ?? "",
      suspend: cj.spec?.suspend ?? false,
      successfulJobsHistoryLimit: cj.spec?.successfulJobsHistoryLimit ?? null,
      failedJobsHistoryLimit: cj.spec?.failedJobsHistoryLimit ?? null,
      startingDeadlineSeconds: cj.spec?.startingDeadlineSeconds ?? null,
      lastScheduleTime: cj.status?.lastScheduleTime?.toISOString() ?? "",
      activeCount: activeJobs.length,
      activeJobNames: activeJobs.map((r) => r.name ?? ""),
      creationTimestamp: cj.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: cj.metadata?.labels ?? {},
      annotations: cj.metadata?.annotations ?? {},
    }
  })
}
