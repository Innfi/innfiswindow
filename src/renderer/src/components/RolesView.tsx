import { useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CollapsibleSection } from "../../components/ui/CollapsibleSection"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table"
import { K8sRole, K8sRoleSummary } from "../types/k8s"
import { RoleSubjectsSection } from "./RoleSubjectsSection"

function DetailPanel({
  role,
  onClose,
  onDeleteSuccess,
  onDeleteDialogChange,
}: {
  role: K8sRole
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
              <span className="text-xs text-muted-foreground">
                {role.namespace}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <EditButton
                resourceKind="Role"
                resourceName={role.name}
                namespace={role.namespace}
                buildYaml={() => ({
                  apiVersion: "rbac.authorization.k8s.io/v1",
                  kind: "Role",
                  metadata: {
                    name: role.name,
                    namespace: role.namespace,
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
                resourceKind="Role"
                resourceName={role.name}
                namespace={role.namespace}
                onDeleted={onDeleteSuccess}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
              />
              <CopyResourceButton
                name={role.name}
                namespace={role.namespace}
                resourceKind="role"
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
      <CollapsibleSection id="role.metadata" title="Metadata">
        <MetaEntry
          label="Created"
          value={new Date(role.creationTimestamp).toLocaleString()}
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="role.rules"
        title="Rules"
        count={role.rules.length}
      >
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
      </CollapsibleSection>

      <RoleSubjectsSection
        kind="Role"
        name={role.name}
        namespace={role.namespace}
        search={sl}
        collapsibleId="role.boundTo"
      />

      {Object.keys(role.labels).length > 0 && (
        <CollapsibleSection id="role.labels" title="Labels">
          <LabelEntries
            entries={Object.entries(role.labels).filter(([k, v]) => kv(k, v))}
          />
        </CollapsibleSection>
      )}

      {Object.keys(role.annotations).length > 0 && (
        <CollapsibleSection id="role.annotations" title="Annotations">
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
        </CollapsibleSection>
      )}
    </DetailPanelLayout>
  )
}

export function RolesView(): JSX.Element {
  return (
    <ResourceListView<K8sRoleSummary, K8sRole>
      batch={{ resourceKind: "Role" }}
      title="Roles"
      list={(ctx, ns, sel) =>
        window.api.k8s.listRoles({
          contextName: ctx,
          namespace: ns,
          labelSelector: sel,
        })
      }
      getDetail={(ctx, namespace, name) =>
        window.api.k8s.getRole({ contextName: ctx, namespace, name })
      }
      detailGuard={(item) =>
        (item as K8sRoleSummary).namespace !== undefined &&
        (item as K8sRoleSummary).rulesCount !== undefined
      }
      columns={[
        { head: "Name", cell: (role) => role.name },
        { head: "Namespace", cell: (role) => role.namespace },
        { head: "Rules", cell: (role) => role.rulesCount },
        ageColumn<K8sRoleSummary>(),
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
