import { BatchV1Api, V1Job, V1JobSpec } from "@kubernetes/client-node"

import { CronJobInfo, JobInfo, MutationResult } from "./types"

// Labels the Job controller injects; must be stripped before recreating a Job
// so the new object generates its own selector.
const GENERATED_JOB_LABELS = [
  "controller-uid",
  "batch.kubernetes.io/controller-uid",
  "job-name",
  "batch.kubernetes.io/job-name",
]

function stripKeys(
  src: Record<string, string> | undefined,
  keys: string[],
): Record<string, string> {
  const out = { ...(src ?? {}) }
  for (const k of keys) delete out[k]
  return out
}

function isNotFound(err: unknown): boolean {
  const code =
    (err as { code?: unknown }).code ??
    (err as { statusCode?: unknown }).statusCode
  return code === 404 || /(^|\D)404(\D|$)|NotFound/.test(String(err))
}

/** Polls `read` until it 404s, so a recreate can't race a pending deletion. */
async function waitForGone(
  read: () => Promise<unknown>,
  timeoutMs = 15000,
): Promise<void> {
  const start = Date.now()
  for (;;) {
    try {
      await read()
    } catch (err) {
      if (isNotFound(err)) return
      throw err
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for job deletion to complete")
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

export async function listJobs(
  api: BatchV1Api,
  namespace?: string,
): Promise<JobInfo[]> {
  const res = namespace
    ? await api.listNamespacedJob({ namespace })
    : await api.listJobForAllNamespaces()
  return res.items.map((job) => {
    const startTime = job.status?.startTime?.toISOString() ?? ""
    const completionTime = job.status?.completionTime?.toISOString() ?? ""
    let duration = ""
    if (startTime && completionTime) {
      const ms =
        new Date(completionTime).getTime() - new Date(startTime).getTime()
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

export async function listCronJobs(
  api: BatchV1Api,
  namespace?: string,
): Promise<CronJobInfo[]> {
  const res = namespace
    ? await api.listNamespacedCronJob({ namespace })
    : await api.listCronJobForAllNamespaces()
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

/** Jobs are immutable, so "restart" deletes the Job and recreates it from its
 *  own (sanitized) spec — a fresh run. Waits for the old Job to be gone first. */
export async function restartJob(
  api: BatchV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  const existing = await api.readNamespacedJob({ name, namespace })
  const spec = existing.spec
  if (!spec) throw new Error(`Job ${name} has no spec to restart`)

  const cleanedSpec: V1JobSpec = { ...spec }
  delete cleanedSpec.selector
  delete cleanedSpec.manualSelector
  cleanedSpec.template = {
    ...spec.template,
    metadata: {
      ...spec.template?.metadata,
      creationTimestamp: undefined,
      labels: stripKeys(spec.template?.metadata?.labels, GENERATED_JOB_LABELS),
    },
  }

  const annotations = stripKeys(existing.metadata?.annotations, [
    "kubectl.kubernetes.io/last-applied-configuration",
    "batch.kubernetes.io/job-tracking",
  ])

  const body: V1Job = {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name,
      namespace,
      labels: stripKeys(existing.metadata?.labels, GENERATED_JOB_LABELS),
      annotations,
    },
    spec: cleanedSpec,
  }

  await api.deleteNamespacedJob({
    name,
    namespace,
    propagationPolicy: "Background",
  })
  await waitForGone(() => api.readNamespacedJob({ name, namespace }))
  await api.createNamespacedJob({ namespace, body })
  return { success: true, name, namespace }
}

/** CronJobs have no restart; the equivalent is manually instantiating a Job
 *  from the jobTemplate now — same as `kubectl create job --from=cronjob/x`. */
export async function triggerCronJob(
  api: BatchV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  const cj = await api.readNamespacedCronJob({ name, namespace })
  const jobSpec = cj.spec?.jobTemplate?.spec
  if (!jobSpec) throw new Error(`CronJob ${name} has no job template`)

  const jobName = `${name}-manual-${Date.now().toString().slice(-8)}`.slice(
    0,
    63,
  )
  const body: V1Job = {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name: jobName,
      namespace,
      annotations: { "cronjob.kubernetes.io/instantiate": "manual" },
      ownerReferences: [
        {
          apiVersion: "batch/v1",
          kind: "CronJob",
          name,
          uid: cj.metadata?.uid ?? "",
          controller: true,
          blockOwnerDeletion: true,
        },
      ],
    },
    spec: jobSpec,
  }
  await api.createNamespacedJob({ namespace, body })
  return { success: true, name: jobName, namespace }
}
