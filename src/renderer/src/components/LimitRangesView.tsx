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
import { K8sLimitRange } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  limitRange,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  limitRange: K8sLimitRange
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(limitRange.labels).filter(([k, v]) =>
    kv(k, v),
  )
  const annotationEntries = Object.entries(limitRange.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  return (
    <DetailPanelLayout>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{limitRange.name}</h2>
          <span className="text-xs text-muted-foreground">
            {limitRange.namespace}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <EditButton
            resourceKind="LimitRange"
            resourceName={limitRange.name}
            namespace={limitRange.namespace}
            buildYaml={() => ({
              apiVersion: "v1",
              kind: "LimitRange",
              metadata: {
                name: limitRange.name,
                namespace: limitRange.namespace,
              },
              spec: { limits: limitRange.limits },
            })}
          />
          <DeleteButton
            resourceKind="LimitRange"
            resourceName={limitRange.name}
            namespace={limitRange.namespace}
            onDeleted={onDeleted}
            onDeleteDialogChange={onDeleteDialogChange}
            onClose={onClose}
          />
          <CopyResourceButton
            name={limitRange.name}
            namespace={limitRange.namespace}
            resourceKind="limitrange"
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

      <div className="space-y-1">
        <MetaEntry
          label="Created"
          value={new Date(limitRange.creationTimestamp).toLocaleString()}
        />
      </div>

      {limitRange.limits.map((limit, idx) => {
        const resources = Array.from(
          new Set([
            ...Object.keys(limit.max),
            ...Object.keys(limit.min),
            ...Object.keys(limit.default),
            ...Object.keys(limit.defaultRequest),
          ]),
        )

        return (
          <div key={idx} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              {limit.type}
            </h3>
            {resources.length > 0 ? (
              <div className="border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-2 py-1.5 font-medium">
                        Resource
                      </th>
                      <th className="text-left px-2 py-1.5 font-medium">Max</th>
                      <th className="text-left px-2 py-1.5 font-medium">Min</th>
                      <th className="text-left px-2 py-1.5 font-medium">
                        Default
                      </th>
                      <th className="text-left px-2 py-1.5 font-medium">
                        Req Default
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((res) => (
                      <tr key={res} className="border-t">
                        <td className="px-2 py-1.5 font-medium">{res}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {limit.max[res] ?? "-"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {limit.min[res] ?? "-"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {limit.default[res] ?? "-"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {limit.defaultRequest[res] ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No constraints defined
              </p>
            )}
          </div>
        )
      })}

      {limitRange.limits.length === 0 && (
        <p className="text-sm text-muted-foreground">No limit types defined</p>
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
        namespace={limitRange.namespace}
        name={limitRange.name}
        kind="LimitRange"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function LimitRangesView(): JSX.Element {
  return (
    <ResourceListView<K8sLimitRange>
      title="LimitRanges"
      list={(ctx) => window.api.k8s.listLimitRanges({ contextName: ctx })}
      detailGuard={(item) => (item as K8sLimitRange).limits !== undefined}
      columns={[
        { head: "Name", cell: (lr) => lr.name },
        { head: "Namespace", cell: (lr) => lr.namespace },
        {
          head: "Types",
          cell: (lr) =>
            Array.from(
              new Set(lr.limits.map((l) => l.type).filter(Boolean)),
            ).join(", ") || "-",
        },
        ageColumn<K8sLimitRange>(),
      ]}
      renderDetail={(limitRange, ctl: DetailController) => (
        <DetailPanel
          limitRange={limitRange}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
