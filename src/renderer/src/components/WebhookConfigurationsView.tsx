import { ReactNode, useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
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
import { SectionHeader } from "../../components/ui/SectionHeader"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table"
import {
  K8sWebhook,
  K8sWebhookClientConfig,
  K8sWebhookConfiguration,
  K8sWebhookConfigurationSummary,
  K8sWebhookConfigurationType,
  K8sWebhookSelector,
} from "../types/k8s"
import { RelatedResourcesSection } from "./RelatedResourcesSection"
import { ResourceEventsSection } from "./ResourceEventsSection"

type WebhookKind =
  | "ValidatingWebhookConfiguration"
  | "MutatingWebhookConfiguration"

const KIND: Record<K8sWebhookConfigurationType, WebhookKind> = {
  Validating: "ValidatingWebhookConfiguration",
  Mutating: "MutatingWebhookConfiguration",
}

/** How the API server reaches the webhook: a Service in the cluster, or a URL
 *  it dials directly. */
function endpointLabel(config: K8sWebhookClientConfig): string {
  if (config.serviceName) {
    const port = config.servicePort === null ? "" : `:${config.servicePort}`
    return `${config.serviceNamespace ?? ""}/${config.serviceName}${port}${
      config.servicePath ?? ""
    }`
  }
  return config.url ?? "—"
}

function selectorLabel(selector: K8sWebhookSelector | null): string | null {
  if (!selector) return null
  const parts = [
    ...Object.entries(selector.matchLabels).map(([k, v]) => `${k}=${v}`),
    ...selector.matchExpressions.map((e) =>
      e.values.length > 0
        ? `${e.key} ${e.operator.toLowerCase()} (${e.values.join(",")})`
        : `${e.key} ${e.operator.toLowerCase()}`,
    ),
  ]
  // A selector that is present but empty matches everything, same as an absent
  // one — but it was written on purpose, so say so rather than showing blank.
  return parts.length > 0 ? parts.join(", ") : "(empty — matches everything)"
}

function ruleText(webhook: K8sWebhook): string {
  return webhook.rules
    .flatMap((r) => [...r.apiGroups, ...r.resources, ...r.operations])
    .join(" ")
}

function webhookText(webhook: K8sWebhook): string {
  return [
    webhook.name,
    endpointLabel(webhook.clientConfig),
    webhook.failurePolicy,
    ruleText(webhook),
  ].join(" ")
}

/** `Fail` is the API default, and it is the one that turns an unreachable
 *  webhook into a rejected create — worth a badge rather than plain text. */
function FailPolicyBadge(): JSX.Element {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
      Fail
    </span>
  )
}

function Chip({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {children}
    </span>
  )
}

function WebhookCard({
  webhook,
  type,
}: {
  webhook: K8sWebhook
  type: K8sWebhookConfigurationType
}): JSX.Element {
  const namespaceSelector = selectorLabel(webhook.namespaceSelector)
  const objectSelector = selectorLabel(webhook.objectSelector)

  return (
    <div className="space-y-2 rounded border px-2 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-medium break-all">
          {webhook.name}
        </span>
        {webhook.failurePolicy === "Fail" && <FailPolicyBadge />}
      </div>

      <div className="flex flex-wrap gap-1">
        <Chip>failurePolicy {webhook.failurePolicy}</Chip>
        <Chip>matchPolicy {webhook.matchPolicy}</Chip>
        <Chip>sideEffects {webhook.sideEffects}</Chip>
        <Chip>timeout {webhook.timeoutSeconds}s</Chip>
        {webhook.reinvocationPolicy && (
          <Chip>reinvocation {webhook.reinvocationPolicy}</Chip>
        )}
      </div>

      <div className="space-y-1">
        <MetaEntry
          label="Endpoint"
          value={endpointLabel(webhook.clientConfig)}
          mono
        />
        <MetaEntry
          label="CA Bundle"
          value={webhook.clientConfig.caBundle ? "present" : "none"}
        />
        <MetaEntry
          label="Review Versions"
          value={webhook.admissionReviewVersions.join(", ") || "—"}
        />
        {namespaceSelector !== null && (
          <MetaEntry label="Namespace Selector" value={namespaceSelector} />
        )}
        {objectSelector !== null && (
          <MetaEntry label="Object Selector" value={objectSelector} />
        )}
      </div>

      {webhook.rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No rules — this webhook is never called.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Operations</TableHead>
                <TableHead className="whitespace-nowrap">API Groups</TableHead>
                <TableHead className="whitespace-nowrap">Versions</TableHead>
                <TableHead className="whitespace-nowrap">Resources</TableHead>
                <TableHead className="whitespace-nowrap">Scope</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhook.rules.map((rule, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {rule.operations.join(", ") || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs font-mono">
                    {rule.apiGroups.map((g) => g || "core").join(", ") || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs font-mono">
                    {rule.apiVersions.join(", ") || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {rule.resources.join(", ") || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {rule.scope}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {webhook.matchConditions.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">
            Match conditions (CEL)
          </span>
          {webhook.matchConditions.map((c) => (
            <MetaEntry key={c.name} label={c.name} value={c.expression} mono />
          ))}
        </div>
      )}

      {webhook.failurePolicy === "Fail" && (
        <p className="text-xs text-muted-foreground">
          While this endpoint is unreachable the API server rejects every write
          the rules above match
          {type === "Mutating" ? ", before any mutation is applied" : ""}.
        </p>
      )}
    </div>
  )
}

/** The manifest the editor opens on. Everything the mapper carries is written
 *  back — the CA bundle included, since a Save without it leaves the API
 *  server unable to verify the webhook's certificate. */
function buildWebhookYaml(
  config: K8sWebhookConfiguration,
): Record<string, unknown> {
  const annotations = Object.fromEntries(
    Object.entries(config.annotations).filter(
      ([k]) => k !== "kubectl.kubernetes.io/last-applied-configuration",
    ),
  )
  return {
    apiVersion: "admissionregistration.k8s.io/v1",
    kind: KIND[config.type],
    metadata: {
      name: config.name,
      ...(Object.keys(config.labels).length > 0 && { labels: config.labels }),
      ...(Object.keys(annotations).length > 0 && { annotations }),
    },
    webhooks: config.webhooks.map((webhook) => ({
      name: webhook.name,
      clientConfig: {
        ...(webhook.clientConfig.url !== null && {
          url: webhook.clientConfig.url,
        }),
        ...(webhook.clientConfig.serviceName !== null && {
          service: {
            namespace: webhook.clientConfig.serviceNamespace ?? "",
            name: webhook.clientConfig.serviceName,
            ...(webhook.clientConfig.servicePath !== null && {
              path: webhook.clientConfig.servicePath,
            }),
            ...(webhook.clientConfig.servicePort !== null && {
              port: webhook.clientConfig.servicePort,
            }),
          },
        }),
        ...(webhook.clientConfig.caBundle && {
          caBundle: webhook.clientConfig.caBundle,
        }),
      },
      rules: webhook.rules.map((rule) => ({
        apiGroups: rule.apiGroups,
        apiVersions: rule.apiVersions,
        operations: rule.operations,
        resources: rule.resources,
        scope: rule.scope,
      })),
      failurePolicy: webhook.failurePolicy,
      matchPolicy: webhook.matchPolicy,
      sideEffects: webhook.sideEffects,
      timeoutSeconds: webhook.timeoutSeconds,
      admissionReviewVersions: webhook.admissionReviewVersions,
      ...(webhook.namespaceSelector && {
        namespaceSelector: {
          ...(Object.keys(webhook.namespaceSelector.matchLabels).length > 0 && {
            matchLabels: webhook.namespaceSelector.matchLabels,
          }),
          ...(webhook.namespaceSelector.matchExpressions.length > 0 && {
            matchExpressions: webhook.namespaceSelector.matchExpressions,
          }),
        },
      }),
      ...(webhook.objectSelector && {
        objectSelector: {
          ...(Object.keys(webhook.objectSelector.matchLabels).length > 0 && {
            matchLabels: webhook.objectSelector.matchLabels,
          }),
          ...(webhook.objectSelector.matchExpressions.length > 0 && {
            matchExpressions: webhook.objectSelector.matchExpressions,
          }),
        },
      }),
      ...(webhook.matchConditions.length > 0 && {
        matchConditions: webhook.matchConditions,
      }),
      ...(webhook.reinvocationPolicy !== null && {
        reinvocationPolicy: webhook.reinvocationPolicy,
      }),
    })),
  }
}

function DetailPanel({
  config,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  config: K8sWebhookConfiguration
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const kind = KIND[config.type]
  const labelEntries = Object.entries(config.labels).filter(([k, v]) =>
    kv(k, v),
  )
  const annotationEntries = Object.entries(config.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))
  const webhooks = config.webhooks.filter((w) => m(webhookText(w)))
  const failCount = config.webhooks.filter(
    (w) => w.failurePolicy === "Fail",
  ).length

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1 break-all">
                {config.name}
              </h2>
              <span className="text-xs text-muted-foreground">
                {kind} · cluster-scoped
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind={kind}
                resourceName={config.name}
                buildYaml={() => buildWebhookYaml(config)}
              />
              <DeleteButton
                resourceKind={kind}
                resourceName={config.name}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
                warning={
                  config.type === "Validating"
                    ? "The admission checks these webhooks enforce stop running as soon as this is deleted."
                    : "The defaults and injections these webhooks apply stop running as soon as this is deleted."
                }
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
      <div className="space-y-1">
        <SectionHeader title="Summary" />
        <MetaEntry label="Webhooks" value={String(config.webhookCount)} />
        <MetaEntry
          label="Failure Policies"
          value={config.failurePolicies.join(", ") || "—"}
        />
        <MetaEntry
          label="Endpoints"
          value={config.endpoints.join(", ") || "—"}
          mono
        />
        <MetaEntry
          label="Created"
          value={new Date(config.creationTimestamp).toLocaleString()}
        />
      </div>

      {failCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {failCount} of {config.webhookCount} webhook
          {config.webhookCount === 1 ? "" : "s"} fail closed: a request matching
          one is rejected while the webhook cannot be reached.
        </p>
      )}

      <div className="space-y-2">
        <SectionHeader title={`Webhooks (${config.webhookCount})`} />
        {config.webhookCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            No webhooks — this configuration admits everything.
          </p>
        ) : webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No webhooks match the search.
          </p>
        ) : (
          webhooks.map((webhook) => (
            <WebhookCard
              key={webhook.name}
              webhook={webhook}
              type={config.type}
            />
          ))
        )}
      </div>

      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          <LabelEntries entries={labelEntries} />
        </div>
      )}

      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      <ResourceEventsSection
        namespace=""
        name={config.name}
        kind={kind}
        search={sl}
      />

      <RelatedResourcesSection
        resourceKind={kind}
        namespace=""
        name={config.name}
        search={sl}
      />
    </DetailPanelLayout>
  )
}

/** The two configurations are the same object in the same API group — one
 *  rejects a write, the other rewrites it — so they share a view and differ
 *  only in which pair of handlers they read. */
function WebhookConfigurationsView({
  type,
}: {
  type: K8sWebhookConfigurationType
}): JSX.Element {
  const kind = KIND[type]
  const validating = type === "Validating"

  return (
    <ResourceListView<K8sWebhookConfigurationSummary, K8sWebhookConfiguration>
      batch={{ resourceKind: kind }}
      title={validating ? "Validating Webhooks" : "Mutating Webhooks"}
      emptyMessage={`No ${kind}s found`}
      namespaced={false}
      list={(ctx, _ns, sel) =>
        validating
          ? window.api.k8s.listValidatingWebhookConfigurations({
              contextName: ctx,
              labelSelector: sel,
            })
          : window.api.k8s.listMutatingWebhookConfigurations({
              contextName: ctx,
              labelSelector: sel,
            })
      }
      getDetail={(ctx, _namespace, name) =>
        validating
          ? window.api.k8s.getValidatingWebhookConfiguration({
              contextName: ctx,
              name,
            })
          : window.api.k8s.getMutatingWebhookConfiguration({
              contextName: ctx,
              name,
            })
      }
      // The two lists share a summary shape, so the guard keys off the type
      // the handler stamped on the row rather than a field only one of them
      // has: a selection made in one view must not open in the other.
      detailGuard={(item) =>
        (item as K8sWebhookConfigurationSummary).type === type
      }
      sortOptions={[
        { label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
        {
          label: "Webhooks (most first)",
          compare: (a, b) =>
            b.webhookCount - a.webhookCount || a.name.localeCompare(b.name),
        },
        {
          label: "Newest",
          compare: (a, b) =>
            b.creationTimestamp.localeCompare(a.creationTimestamp),
        },
      ]}
      columns={[
        { head: "Name", cell: (c) => c.name, className: "font-medium" },
        { head: "Webhooks", cell: (c) => c.webhookCount },
        {
          head: "Failure Policy",
          cell: (c) =>
            c.failurePolicies.length === 0 ? (
              "—"
            ) : (
              <span className="flex items-center gap-1">
                {c.failurePolicies.map((policy) =>
                  policy === "Fail" ? (
                    <FailPolicyBadge key={policy} />
                  ) : (
                    <span key={policy} className="text-xs">
                      {policy}
                    </span>
                  ),
                )}
              </span>
            ),
        },
        {
          head: "Resources",
          cell: (c) => c.resources.join(", ") || "—",
          className: "text-xs",
        },
        {
          head: "Endpoints",
          cell: (c) => c.endpoints.join(", ") || "—",
          className: "font-mono text-xs",
        },
        ageColumn<K8sWebhookConfigurationSummary>(),
      ]}
      renderDetail={(config, ctl: DetailController) => (
        <DetailPanel
          config={config}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}

export function ValidatingWebhookConfigurationsView(): JSX.Element {
  return <WebhookConfigurationsView type="Validating" />
}

export function MutatingWebhookConfigurationsView(): JSX.Element {
  return <WebhookConfigurationsView type="Mutating" />
}
