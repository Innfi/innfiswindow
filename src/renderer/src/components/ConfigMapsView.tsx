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
import { K8sConfigMap } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  cm,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  cm: K8sConfigMap
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const dataEntries = Object.entries(cm.data).filter(([k, v]) => kv(k, v))
  const binaryEntries = Object.entries(cm.binaryData).filter(([k]) => m(k))
  const labelEntries = Object.entries(cm.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(cm.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1">{cm.name}</h2>
              <span className="text-xs text-muted-foreground">
                {cm.namespace}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <EditButton
                resourceKind="ConfigMap"
                resourceName={cm.name}
                namespace={cm.namespace}
                buildYaml={() => ({
                  apiVersion: "v1",
                  kind: "ConfigMap",
                  metadata: {
                    name: cm.name,
                    namespace: cm.namespace,
                    ...(Object.keys(cm.labels).length > 0
                      ? { labels: cm.labels }
                      : {}),
                    ...(Object.keys(cm.annotations).length > 0
                      ? { annotations: cm.annotations }
                      : {}),
                  },
                  ...(Object.keys(cm.data).length > 0 ? { data: cm.data } : {}),
                  ...(Object.keys(cm.binaryData).length > 0
                    ? { binaryData: cm.binaryData }
                    : {}),
                })}
              />
              <DeleteButton
                resourceKind="ConfigMap"
                resourceName={cm.name}
                namespace={cm.namespace}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
              />
              <CopyResourceButton
                name={cm.name}
                namespace={cm.namespace}
                resourceKind="configmap"
              />
              <ClosePanelButton onClose={onClose} className="ml-1" />
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
      {/* Info */}
      <div className="space-y-1">
        <SectionHeader title="Info" />
        <MetaEntry label="Keys" value={cm.keys.join(", ") || "none"} />
        <MetaEntry
          label="Created"
          value={new Date(cm.creationTimestamp).toLocaleString()}
        />
      </div>

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

      {/* Data */}
      {dataEntries.length > 0 && (
        <div className="space-y-2">
          <SectionHeader title="Data" />
          {dataEntries.map(([key, value]) => (
            <div key={key} className="space-y-0.5">
              <div className="font-mono font-bold text-sm">{key}</div>
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {value}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Binary Data */}
      {binaryEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Binary Data" />
          {binaryEntries.map(([key, size]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="font-mono font-bold">{key}</span>
              <span className="text-muted-foreground">{size} bytes</span>
            </div>
          ))}
        </div>
      )}

      {/* Events */}
      <ResourceEventsSection
        namespace={cm.namespace}
        name={cm.name}
        kind="ConfigMap"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function ConfigMapsView(): JSX.Element {
  return (
    <ResourceListView<K8sConfigMap>
      title="ConfigMaps"
      list={(ctx) => window.api.k8s.listConfigMaps({ contextName: ctx })}
      detailGuard={(item) => (item as K8sConfigMap).keys !== undefined}
      columns={[
        { head: "Name", cell: (cm) => cm.name },
        { head: "Namespace", cell: (cm) => cm.namespace },
        {
          head: "Keys",
          cell: (cm) => cm.keys.join(", ") || "-",
          className: "max-w-xs truncate",
        },
        ageColumn<K8sConfigMap>(),
      ]}
      renderDetail={(cm, ctl: DetailController) => (
        <DetailPanel cm={cm} {...ctl} />
      )}
    />
  )
}
