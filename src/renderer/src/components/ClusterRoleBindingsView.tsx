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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table"
import { K8sClusterRoleBinding } from "../types/k8s"

function DetailPanel({
  binding,
  onClose,
  onDeleteSuccess,
  onDeleteDialogChange,
}: {
  binding: K8sClusterRoleBinding
  onClose: () => void
  onDeleteSuccess: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()
  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1">{binding.name}</h2>
              <span className="text-xs text-muted-foreground">
                ClusterRoleBinding
              </span>
            </div>
            <div className="flex items-center gap-2">
              <EditButton
                resourceKind="ClusterRoleBinding"
                resourceName={binding.name}
                buildYaml={() => ({
                  apiVersion: "rbac.authorization.k8s.io/v1",
                  kind: "ClusterRoleBinding",
                  metadata: {
                    name: binding.name,
                    ...(Object.keys(binding.labels).length > 0 && {
                      labels: binding.labels,
                    }),
                    ...(Object.keys(binding.annotations).length > 0 && {
                      annotations: binding.annotations,
                    }),
                  },
                  roleRef: {
                    apiGroup: "rbac.authorization.k8s.io",
                    kind: binding.roleRef.kind,
                    name: binding.roleRef.name,
                  },
                  subjects: binding.subjects,
                })}
              />
              <DeleteButton
                resourceKind="ClusterRoleBinding"
                resourceName={binding.name}
                onDeleted={onDeleteSuccess}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
              />
              <CopyResourceButton
                name={binding.name}
                resourceKind="clusterrolebinding"
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
        <SectionHeader title="Metadata" />
        <MetaEntry
          label="Created"
          value={new Date(binding.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <SectionHeader title="Role Ref" />
        <div className="text-sm">
          <span className="font-medium">{binding.roleRef.kind}:</span>{" "}
          {binding.roleRef.name}
        </div>
      </div>

      <div className="space-y-1">
        <SectionHeader title={`Subjects (${binding.subjects.length})`} />
        {binding.subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subjects</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Kind</TableHead>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {binding.subjects
                  .filter(
                    (s) =>
                      !sl ||
                      s.kind.toLowerCase().includes(sl) ||
                      s.name.toLowerCase().includes(sl) ||
                      (s.namespace ?? "").toLowerCase().includes(sl),
                  )
                  .map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {s.kind}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-mono">
                        {s.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {s.namespace}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {Object.keys(binding.labels).length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          {Object.entries(binding.labels)
            .filter(([k, v]) => kv(k, v))
            .map(([k, v]) => (
              <MetaEntry key={k} label={k} value={v} />
            ))}
        </div>
      )}

      {Object.keys(binding.annotations).length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {Object.entries(binding.annotations)
            .filter(
              ([k]) =>
                !k.startsWith(
                  "kubectl.kubernetes.io/last-applied-configuration",
                ),
            )
            .filter(([k, v]) => kv(k, v))
            .map(([k, v]) => (
              <MetaEntry key={k} label={k} value={v} />
            ))}
        </div>
      )}
    </DetailPanelLayout>
  )
}

export function ClusterRoleBindingsView(): JSX.Element {
  return (
    <ResourceListView<K8sClusterRoleBinding>
      title="Cluster Role Bindings"
      emptyMessage="No Cluster Role Bindings found"
      namespaced={false}
      list={(ctx) =>
        window.api.k8s.listClusterRoleBindings({ contextName: ctx })
      }
      detailGuard={(item) =>
        (item as K8sClusterRoleBinding).roleRef !== undefined &&
        !("namespace" in item)
      }
      columns={[
        { head: "Name", cell: (b) => b.name },
        { head: "Role", cell: (b) => b.roleRef.name },
        { head: "Subjects", cell: (b) => b.subjectsCount },
        ageColumn<K8sClusterRoleBinding>(),
      ]}
      renderDetail={(binding, ctl: DetailController) => (
        <DetailPanel
          binding={binding}
          onClose={ctl.onClose}
          onDeleteSuccess={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
