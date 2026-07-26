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
import { K8sServiceAccount } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function DetailPanel({
  sa,
  onClose,
  onDeleteSuccess,
  onDeleteDialogChange,
}: {
  sa: K8sServiceAccount
  onClose: () => void
  onDeleteSuccess: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()
  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(sa.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(sa.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  return (
    <DetailPanelLayout>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{sa.name}</h2>
          <span className="text-xs text-muted-foreground">{sa.namespace}</span>
        </div>
        <div className="flex items-center gap-2">
          <EditButton
            resourceKind="ServiceAccount"
            resourceName={sa.name}
            namespace={sa.namespace}
            buildYaml={() => ({
              apiVersion: "v1",
              kind: "ServiceAccount",
              metadata: {
                name: sa.name,
                namespace: sa.namespace,
                ...(Object.keys(sa.labels).length > 0 && { labels: sa.labels }),
                ...(Object.keys(sa.annotations).length > 0 && {
                  annotations: sa.annotations,
                }),
              },
            })}
          />
          <DeleteButton
            resourceKind="ServiceAccount"
            resourceName={sa.name}
            namespace={sa.namespace}
            onDeleted={onDeleteSuccess}
            onDeleteDialogChange={onDeleteDialogChange}
            onClose={onClose}
          />
          <CopyResourceButton
            name={sa.name}
            namespace={sa.namespace}
            resourceKind="serviceaccount"
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

      {/* Metadata */}
      <div className="space-y-1">
        <SectionHeader title="Metadata" />
        <MetaEntry
          label="Created"
          value={new Date(sa.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Secrets */}
      <div className="space-y-1">
        <SectionHeader title={`Secrets (${sa.secrets.length})`} />
        {sa.secrets.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          sa.secrets
            .filter((s) => m(s))
            .map((s) => (
              <div key={s} className="text-xs font-mono">
                {s}
              </div>
            ))
        )}
      </div>

      {/* Image Pull Secrets */}
      <div className="space-y-1">
        <SectionHeader
          title={`Image Pull Secrets (${sa.imagePullSecrets.length})`}
        />
        {sa.imagePullSecrets.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          sa.imagePullSecrets
            .filter((s) => m(s))
            .map((s) => (
              <div key={s} className="text-xs font-mono">
                {s}
              </div>
            ))
        )}
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

      {/* Events */}
      <ResourceEventsSection
        namespace={sa.namespace}
        name={sa.name}
        kind="ServiceAccount"
        search={sl}
      />
    </DetailPanelLayout>
  )
}

export function ServiceAccountsView(): JSX.Element {
  return (
    <ResourceListView<K8sServiceAccount>
      title="Service Accounts"
      emptyMessage="No Service Accounts found"
      list={(ctx) => window.api.k8s.listServiceAccounts({ contextName: ctx })}
      detailGuard={(item) => (item as K8sServiceAccount).secrets !== undefined}
      columns={[
        { head: "Name", cell: (sa) => sa.name },
        { head: "Namespace", cell: (sa) => sa.namespace },
        { head: "Secrets", cell: (sa) => sa.secrets.length },
        ageColumn<K8sServiceAccount>(),
      ]}
      renderDetail={(sa, ctl: DetailController) => (
        <DetailPanel
          sa={sa}
          onClose={ctl.onClose}
          onDeleteSuccess={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
