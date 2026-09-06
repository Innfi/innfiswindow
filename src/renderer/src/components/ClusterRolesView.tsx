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
import { K8sClusterRole, K8sClusterRoleSummary } from "../types/k8s"
import { RoleSubjectsSection } from "./RoleSubjectsSection"

function DetailPanel({
  role,
  onClose,
  onDeleteSuccess,
  onDeleteDialogChange,
}: {
  role: K8sClusterRole
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
              <h2 className="font-semibold text-base mb-1">{role.name}</h2>
              <span className="text-xs text-muted-foreground">ClusterRole</span>
            </div>
            <div className="flex items-center gap-2">
              <EditButton
                resourceKind="ClusterRole"
                resourceName={role.name}
                buildYaml={() => ({
                  apiVersion: "rbac.authorization.k8s.io/v1",
                  kind: "ClusterRole",
                  metadata: {
                    name: role.name,
                    ...(Object.keys(role.labels).length > 0 && {
                      labels: role.labels,
                    }),
                    ...(Object.keys(role.annotations).length > 0 && {
                      annotations: role.annotations,
                    }),
                  },
                  rules: role.rules,
                })}
              />
              <DeleteButton
                resourceKind="ClusterRole"
                resourceName={role.name}
                onDeleted={onDeleteSuccess}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
              />
              <CopyResourceButton name={role.name} resourceKind="clusterrole" />
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
          value={new Date(role.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <SectionHeader title={`Rules (${role.rules.length})`} />
        {role.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">
                    API Groups
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Resources</TableHead>
                  <TableHead className="whitespace-nowrap">Verbs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {role.rules
                  .filter(
                    (rule) =>
                      !sl ||
                      rule.resources.some((r) =>
                        r.toLowerCase().includes(sl),
                      ) ||
                      rule.verbs.some((v) => v.toLowerCase().includes(sl)) ||
                      rule.apiGroups.some((g) => g.toLowerCase().includes(sl)),
                  )
                  .map((rule, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap text-xs font-mono">
                        {rule.apiGroups.join(", ") || '""'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {rule.resources.join(", ") || "*"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {rule.verbs.join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <RoleSubjectsSection kind="ClusterRole" name={role.name} search={sl} />

      {Object.keys(role.labels).length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          {Object.entries(role.labels)
            .filter(([k, v]) => kv(k, v))
            .map(([k, v]) => (
              <MetaEntry key={k} label={k} value={v} />
            ))}
        </div>
      )}

      {Object.keys(role.annotations).length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {Object.entries(role.annotations)
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

export function ClusterRolesView(): JSX.Element {
  return (
    <ResourceListView<K8sClusterRoleSummary, K8sClusterRole>
      batch={{ resourceKind: "ClusterRole" }}
      title="Cluster Roles"
      emptyMessage="No Cluster Roles found"
      namespaced={false}
      list={(ctx) => window.api.k8s.listClusterRoles({ contextName: ctx })}
      getDetail={(ctx, _namespace, name) =>
        window.api.k8s.getClusterRole({ contextName: ctx, name })
      }
      detailGuard={(item) =>
        (item as K8sClusterRoleSummary).rulesCount !== undefined &&
        !("namespace" in item)
      }
      columns={[
        { head: "Name", cell: (role) => role.name },
        { head: "Rules", cell: (role) => role.rulesCount },
        ageColumn<K8sClusterRoleSummary>(),
      ]}
      renderDetail={(role, ctl: DetailController) => (
        <DetailPanel
          role={role}
          onClose={ctl.onClose}
          onDeleteSuccess={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
