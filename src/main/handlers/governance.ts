import {
  AdmissionregistrationV1Api,
  AdmissionregistrationV1WebhookClientConfig,
  CoreV1Api,
  PolicyV1Api,
  SchedulingV1Api,
  V1LabelSelector,
  V1MutatingWebhook,
  V1MutatingWebhookConfiguration,
  V1RuleWithOperations,
  V1ValidatingWebhook,
  V1ValidatingWebhookConfiguration,
} from "@kubernetes/client-node"

import {
  LimitRangeInfo,
  PDBInfo,
  PriorityClassInfo,
  ResourceQuotaInfo,
  WebhookClientConfigInfo,
  WebhookConfigurationInfo,
  WebhookConfigurationSummary,
  WebhookConfigurationType,
  WebhookInfo,
  WebhookRule,
  WebhookSelectorInfo,
} from "./types"

export async function listResourceQuotas(
  api: CoreV1Api,
  namespace?: string,
  labelSelector?: string,
): Promise<ResourceQuotaInfo[]> {
  const res = namespace
    ? await api.listNamespacedResourceQuota({ namespace, labelSelector })
    : await api.listResourceQuotaForAllNamespaces({ labelSelector })
  return res.items.map((rq) => ({
    name: rq.metadata?.name ?? "",
    namespace: rq.metadata?.namespace ?? "",
    hard: Object.fromEntries(
      Object.entries(rq.spec?.hard ?? {}).map(([k, v]) => [k, String(v)]),
    ) as Record<string, string>,
    used: Object.fromEntries(
      Object.entries(rq.status?.used ?? {}).map(([k, v]) => [k, String(v)]),
    ) as Record<string, string>,
    creationTimestamp: rq.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: rq.metadata?.labels ?? {},
    annotations: rq.metadata?.annotations ?? {},
  }))
}

export async function listLimitRanges(
  api: CoreV1Api,
  namespace?: string,
  labelSelector?: string,
): Promise<LimitRangeInfo[]> {
  const res = namespace
    ? await api.listNamespacedLimitRange({ namespace, labelSelector })
    : await api.listLimitRangeForAllNamespaces({ labelSelector })
  return res.items.map((lr) => ({
    name: lr.metadata?.name ?? "",
    namespace: lr.metadata?.namespace ?? "",
    limits: (lr.spec?.limits ?? []).map((l) => ({
      type: l.type ?? "",
      max: Object.fromEntries(
        Object.entries(l.max ?? {}).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
      min: Object.fromEntries(
        Object.entries(l.min ?? {}).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
      default: Object.fromEntries(
        Object.entries(l._default ?? {}).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
      defaultRequest: Object.fromEntries(
        Object.entries(l.defaultRequest ?? {}).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
    })),
    creationTimestamp: lr.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: lr.metadata?.labels ?? {},
    annotations: lr.metadata?.annotations ?? {},
  }))
}

export async function listPDBs(
  api: PolicyV1Api,
  namespace?: string,
  labelSelector?: string,
): Promise<PDBInfo[]> {
  try {
    const res = namespace
      ? await api.listNamespacedPodDisruptionBudget({
          namespace,
          labelSelector,
        })
      : await api.listPodDisruptionBudgetForAllNamespaces({ labelSelector })
    return res.items.map((pdb) => ({
      name: pdb.metadata?.name ?? "",
      namespace: pdb.metadata?.namespace ?? "",
      minAvailable:
        pdb.spec?.minAvailable !== undefined
          ? String(pdb.spec.minAvailable)
          : null,
      maxUnavailable:
        pdb.spec?.maxUnavailable !== undefined
          ? String(pdb.spec.maxUnavailable)
          : null,
      currentHealthy: pdb.status?.currentHealthy ?? 0,
      desiredHealthy: pdb.status?.desiredHealthy ?? 0,
      disruptionsAllowed: pdb.status?.disruptionsAllowed ?? 0,
      expectedPods: pdb.status?.expectedPods ?? 0,
      selector: pdb.spec?.selector?.matchLabels ?? {},
      creationTimestamp: pdb.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: (pdb.metadata?.labels as Record<string, string>) ?? {},
      annotations: (pdb.metadata?.annotations as Record<string, string>) ?? {},
    }))
  } catch (e: unknown) {
    const httpErr = e as {
      response?: { statusCode?: number }
      statusCode?: number
    }
    const code = httpErr.response?.statusCode ?? httpErr.statusCode
    if (code === 404 || code === 403) {
      return []
    }
    throw e
  }
}

/** PriorityClasses are cluster-scoped: the value a pod inherits from
 *  `spec.priorityClassName`, which the scheduler orders and preempts by. */
export async function listPriorityClasses(
  api: SchedulingV1Api,
  labelSelector?: string,
): Promise<PriorityClassInfo[]> {
  const res = await api.listPriorityClass({ labelSelector })
  return res.items.map((pc) => ({
    name: pc.metadata?.name ?? "",
    value: pc.value ?? 0,
    globalDefault: pc.globalDefault ?? false,
    description: pc.description ?? "",
    // An unset policy is PreemptLowerPriority, which is what the API server
    // defaults the field to — spell it out rather than showing a blank.
    preemptionPolicy: pc.preemptionPolicy ?? "PreemptLowerPriority",
    creationTimestamp: pc.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: pc.metadata?.labels ?? {},
    annotations: pc.metadata?.annotations ?? {},
  }))
}

// ---------------------------------------------------------------------------
// Admission webhook configurations
// ---------------------------------------------------------------------------

/** What the API server uses when a webhook leaves `timeoutSeconds` unset. */
const DEFAULT_WEBHOOK_TIMEOUT_SECONDS = 10

function mapWebhookRules(rules?: V1RuleWithOperations[]): WebhookRule[] {
  return (rules ?? []).map((r) => ({
    apiGroups: r.apiGroups ?? [],
    apiVersions: r.apiVersions ?? [],
    resources: r.resources ?? [],
    operations: r.operations ?? [],
    scope: r.scope ?? "*",
  }))
}

/** An unset selector is null rather than an empty one: both match everything,
 *  but only the empty one must be round-tripped by an Edit. */
function mapWebhookSelector(
  selector?: V1LabelSelector,
): WebhookSelectorInfo | null {
  if (!selector) return null
  return {
    matchLabels: selector.matchLabels ?? {},
    matchExpressions: (selector.matchExpressions ?? []).map((e) => ({
      key: e.key,
      operator: e.operator,
      values: e.values ?? [],
    })),
  }
}

function mapWebhookClientConfig(
  config: AdmissionregistrationV1WebhookClientConfig,
): WebhookClientConfigInfo {
  return {
    url: config.url ?? null,
    serviceNamespace: config.service?.namespace ?? null,
    serviceName: config.service?.name ?? null,
    servicePath: config.service?.path ?? null,
    servicePort: config.service?.port ?? null,
    caBundle: config.caBundle ?? "",
  }
}

/** `type` decides whether a reinvocation policy is reported at all: the field
 *  is simply absent from a mutating webhook that leaves it at the default, so
 *  the object itself cannot say which of the two kinds it came from. */
function mapWebhook(
  webhook: V1ValidatingWebhook | V1MutatingWebhook,
  type: WebhookConfigurationType,
): WebhookInfo {
  return {
    name: webhook.name,
    clientConfig: mapWebhookClientConfig(webhook.clientConfig),
    rules: mapWebhookRules(webhook.rules),
    // Both policies are spelled out at their API defaults rather than left
    // blank: whether an unreachable webhook blocks a write is the first thing
    // this view is opened to answer.
    failurePolicy: webhook.failurePolicy ?? "Fail",
    matchPolicy: webhook.matchPolicy ?? "Equivalent",
    sideEffects: webhook.sideEffects ?? "Unknown",
    timeoutSeconds: webhook.timeoutSeconds ?? DEFAULT_WEBHOOK_TIMEOUT_SECONDS,
    admissionReviewVersions: webhook.admissionReviewVersions ?? [],
    namespaceSelector: mapWebhookSelector(webhook.namespaceSelector),
    objectSelector: mapWebhookSelector(webhook.objectSelector),
    matchConditions: (webhook.matchConditions ?? []).map((c) => ({
      name: c.name,
      expression: c.expression,
    })),
    reinvocationPolicy:
      type === "Mutating"
        ? ((webhook as V1MutatingWebhook).reinvocationPolicy ?? "Never")
        : null,
  }
}

/** `<group>/<resource>` for every rule entry, with the core group's empty
 *  group written as `core` so a row reads as something. */
function ruleResourceLabels(webhooks: WebhookInfo[]): string[] {
  const out: string[] = []
  for (const webhook of webhooks) {
    for (const rule of webhook.rules) {
      for (const group of rule.apiGroups.length > 0 ? rule.apiGroups : [""]) {
        for (const resource of rule.resources) {
          out.push(`${group === "" ? "core" : group}/${resource}`)
        }
      }
    }
  }
  return [...new Set(out)]
}

function endpointLabels(webhooks: WebhookInfo[]): string[] {
  const out: string[] = []
  for (const { clientConfig } of webhooks) {
    if (clientConfig.serviceName) {
      out.push(
        `${clientConfig.serviceNamespace ?? ""}/${clientConfig.serviceName}`,
      )
    } else if (clientConfig.url) {
      out.push(clientConfig.url)
    }
  }
  return [...new Set(out)]
}

function mapWebhookConfiguration(
  type: WebhookConfigurationType,
  config: V1ValidatingWebhookConfiguration | V1MutatingWebhookConfiguration,
): WebhookConfigurationInfo {
  const webhooks = (config.webhooks ?? []).map((webhook) =>
    mapWebhook(webhook, type),
  )
  return {
    name: config.metadata?.name ?? "",
    type,
    webhookCount: webhooks.length,
    failurePolicies: [...new Set(webhooks.map((w) => w.failurePolicy))],
    resources: ruleResourceLabels(webhooks),
    endpoints: endpointLabels(webhooks),
    creationTimestamp: config.metadata?.creationTimestamp?.toISOString() ?? "",
    webhooks,
    labels: config.metadata?.labels ?? {},
    annotations: config.metadata?.annotations ?? {},
  }
}

/** The table's share of the mapping: a configuration's webhooks carry rules,
 *  selectors and a CA bundle each, none of which a row renders. */
function summarizeWebhookConfiguration(
  info: WebhookConfigurationInfo,
): WebhookConfigurationSummary {
  return {
    name: info.name,
    type: info.type,
    webhookCount: info.webhookCount,
    failurePolicies: info.failurePolicies,
    resources: info.resources,
    endpoints: info.endpoints,
    creationTimestamp: info.creationTimestamp,
  }
}

export async function listValidatingWebhookConfigurations(
  api: AdmissionregistrationV1Api,
  labelSelector?: string,
): Promise<WebhookConfigurationSummary[]> {
  const res = await api.listValidatingWebhookConfiguration({ labelSelector })
  return res.items.map((config) =>
    summarizeWebhookConfiguration(
      mapWebhookConfiguration("Validating", config),
    ),
  )
}

export async function getValidatingWebhookConfiguration(
  api: AdmissionregistrationV1Api,
  name: string,
): Promise<WebhookConfigurationInfo> {
  const config = await api.readValidatingWebhookConfiguration({ name })
  return mapWebhookConfiguration("Validating", config)
}

export async function listMutatingWebhookConfigurations(
  api: AdmissionregistrationV1Api,
  labelSelector?: string,
): Promise<WebhookConfigurationSummary[]> {
  const res = await api.listMutatingWebhookConfiguration({ labelSelector })
  return res.items.map((config) =>
    summarizeWebhookConfiguration(mapWebhookConfiguration("Mutating", config)),
  )
}

export async function getMutatingWebhookConfiguration(
  api: AdmissionregistrationV1Api,
  name: string,
): Promise<WebhookConfigurationInfo> {
  const config = await api.readMutatingWebhookConfiguration({ name })
  return mapWebhookConfiguration("Mutating", config)
}
