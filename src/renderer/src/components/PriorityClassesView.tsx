import { useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
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
import { K8sPriorityClass } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

/** Classes the control plane ships for its own pods. They are recreated by the
 *  API server if deleted, and no user workload should name one. */
const SYSTEM_CLASS_PREFIX = "system-"

function GlobalDefaultBadge(): JSX.Element {
  return (
    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900 dark:text-green-300">
      global default
    </span>
  )
}

function SystemBadge(): JSX.Element {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
      system
    </span>
  )
}

function DetailPanel({
  pc,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  pc: K8sPriorityClass
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(pc.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(pc.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  const isSystem = pc.name.startsWith(SYSTEM_CLASS_PREFIX)

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1 flex items-center gap-2">
                {pc.name}
                {pc.globalDefault && <GlobalDefaultBadge />}
                {isSystem && <SystemBadge />}
              </h2>
              <span className="text-xs text-muted-foreground">
                cluster-scoped
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="PriorityClass"
                resourceName={pc.name}
                buildYaml={() => ({
                  apiVersion: "scheduling.k8s.io/v1",
                  kind: "PriorityClass",
                  metadata: {
                    name: pc.name,
                    ...(Object.keys(pc.labels).length > 0 && {
                      labels: pc.labels,
                    }),
                  },
                  value: pc.value,
                  globalDefault: pc.globalDefault,
                  preemptionPolicy: pc.preemptionPolicy,
                  ...(pc.description && { description: pc.description }),
                })}
              />
              <DeleteButton
                resourceKind="PriorityClass"
                resourceName={pc.name}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
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
        <SectionHeader title="Spec" />
        <MetaEntry label="Value" value={pc.value.toLocaleString()} mono />
        <MetaEntry
          label="Global Default"
          value={pc.globalDefault ? "Yes" : "No"}
        />
        <MetaEntry label="Preemption Policy" value={pc.preemptionPolicy} />
        <MetaEntry label="Description" value={pc.description || "—"} />
        <MetaEntry
          label="Created"
          value={new Date(pc.creationTimestamp).toLocaleString()}
        />
      </div>

      {pc.preemptionPolicy === "Never" && (
        <p className="text-xs text-muted-foreground">
          Pods in this class queue ahead of lower-priority pods but never evict
          them.
        </p>
      )}

      {isSystem && (
        <p className="text-xs text-muted-foreground">
          A built-in class for control-plane pods. The API server recreates it
          if deleted.
        </p>
      )}

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
        namespace=""
        name={pc.name}
        kind="PriorityClass"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function PriorityClassesView(): JSX.Element {
  return (
    <ResourceListView<K8sPriorityClass>
      batch={{ resourceKind: "PriorityClass" }}
      title="Priority Classes"
      emptyMessage="No PriorityClasses found"
      namespaced={false}
      list={(ctx) => window.api.k8s.listPriorityClasses({ contextName: ctx })}
      detailGuard={(item) => (item as K8sPriorityClass).value !== undefined}
      sortOptions={[
        {
          label: "Value (high first)",
          compare: (a, b) => b.value - a.value || a.name.localeCompare(b.name),
        },
        { label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
        {
          label: "Newest",
          compare: (a, b) =>
            b.creationTimestamp.localeCompare(a.creationTimestamp),
        },
      ]}
      columns={[
        {
          head: "Name",
          cell: (pc) => (
            <span className="flex items-center gap-2">
              {pc.name}
              {pc.globalDefault && <GlobalDefaultBadge />}
            </span>
          ),
          className: "font-medium",
        },
        {
          head: "Value",
          cell: (pc) => pc.value.toLocaleString(),
          className: "font-mono text-xs",
        },
        {
          head: "Preemption",
          cell: (pc) => pc.preemptionPolicy,
        },
        {
          head: "Description",
          cell: (pc) => pc.description || "—",
          className: "text-xs text-muted-foreground",
        },
        ageColumn<K8sPriorityClass>(),
      ]}
      renderDetail={(pc, ctl: DetailController) => (
        <DetailPanel
          pc={pc}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
