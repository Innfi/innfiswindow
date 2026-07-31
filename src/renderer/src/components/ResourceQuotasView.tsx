import { useState } from "react"

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
import { cn, parseResourceValue } from "../../lib/utils"
import { K8sResourceQuota } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function usagePercent(used: string, hard: string): number {
  const u = parseResourceValue(used)
  const h = parseResourceValue(hard)
  if (h === 0) return 0
  return Math.min((u / h) * 100, 100)
}

function DetailPanel({
  quota,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  quota: K8sResourceQuota
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(quota.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(quota.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  const resources = Object.keys(quota.hard).filter(
    (r) => !sl || r.toLowerCase().includes(sl),
  )

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1">{quota.name}</h2>
              <span className="text-xs text-muted-foreground">
                {quota.namespace}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="ResourceQuota"
                resourceName={quota.name}
                namespace={quota.namespace}
                buildYaml={() => ({
                  apiVersion: "v1",
                  kind: "ResourceQuota",
                  metadata: { name: quota.name, namespace: quota.namespace },
                  spec: { hard: quota.hard },
                })}
              />
              <DeleteButton
                resourceKind="ResourceQuota"
                resourceName={quota.name}
                namespace={quota.namespace}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
              />
              <CopyResourceButton
                name={quota.name}
                namespace={quota.namespace}
                resourceKind="resourcequota"
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
        <MetaEntry
          label="Created"
          value={new Date(quota.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-3">
        <SectionHeader title="Resource Usage" />
        {resources.map((resource) => {
          const hard = quota.hard[resource] ?? "0"
          const used = quota.used[resource] ?? "0"
          const pct = usagePercent(used, hard)
          const isRed = pct >= 100
          const isYellow = !isRed && pct > 80

          return (
            <div
              key={resource}
              className={cn(
                "rounded border p-2 space-y-1",
                isRed && "border-red-400 bg-red-50 dark:bg-red-950/20",
                isYellow &&
                  "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20",
              )}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate mr-2">{resource}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {used} / {hard}
                </span>
              </div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded transition-all",
                    isRed
                      ? "bg-red-500"
                      : isYellow
                        ? "bg-yellow-500"
                        : "bg-green-500",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
        {resources.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No resource limits defined
          </p>
        )}
      </div>

      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          {labelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
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
        namespace={quota.namespace}
        name={quota.name}
        kind="ResourceQuota"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function ResourceQuotasView(): JSX.Element {
  return (
    <ResourceListView<K8sResourceQuota>
      title="ResourceQuotas"
      list={(ctx, ns) =>
        window.api.k8s.listResourceQuotas({ contextName: ctx, namespace: ns })
      }
      detailGuard={(item) => (item as K8sResourceQuota).hard !== undefined}
      columns={[
        { head: "Name", cell: (q) => q.name },
        { head: "Namespace", cell: (q) => q.namespace },
        { head: "Resources", cell: (q) => Object.keys(q.hard).length },
        ageColumn<K8sResourceQuota>(),
      ]}
      renderDetail={(quota, ctl: DetailController) => (
        <DetailPanel
          quota={quota}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
