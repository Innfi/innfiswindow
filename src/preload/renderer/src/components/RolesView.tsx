import { dump as yamlDump } from "js-yaml"
import { Pencil, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "../../components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { handleIpcError } from "../../lib/ipc-error"
import { cn, filterResources, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"

interface K8sRoleRule {
  apiGroups: string[]
  resources: string[]
  verbs: string[]
}

interface K8sRole {
  name: string
  namespace: string
  rulesCount: number
  creationTimestamp: string
  rules: K8sRoleRule[]
}

function DetailPanel({
  role,
  onClose,
}: {
  role: K8sRole
  onClose: () => void
}): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)

  function handleEdit(): void {
    openDrawerTab({
      type: "edit-resource",
      resourceKind: "Role",
      resourceName: role.name,
      namespace: role.namespace,
      initialYaml: yamlDump(role.rules),
    })
  }

  return (
    <div className="w-[480px] shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{role.name}</h2>
          <span className="text-xs text-muted-foreground">
            {role.namespace}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleEdit}>
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Rules ({role.rules.length})
        </h3>
        {role.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>API Groups</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Verbs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {role.rules.map((rule, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-mono">
                    {rule.apiGroups.join(", ") || '""'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {rule.resources.join(", ") || "*"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {rule.verbs.join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

export function RolesView(): JSX.Element {
  const [roles, setRoles] = useState<K8sRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedItem = useAppStore((s) => s.selectedItem) as K8sRole | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const visible = filterResources(roles, nameFilter, selectedNamespace)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listRoles({ contextName: selectedContext ?? undefined })
      .then((data) => {
        setRoles(data)
        setLoading(false)
      })
      .catch((err) => {
        handleIpcError(err, "Roles")
        setError(String(err))
        setLoading(false)
      })
  }, [selectedContext])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Roles</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((role) => (
                <TableRow
                  key={`${role.namespace}/${role.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === role.name &&
                      selectedItem?.namespace === role.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === role.name &&
                        selectedItem?.namespace === role.namespace
                        ? null
                        : role,
                    )
                  }
                >
                  <TableCell>{role.name}</TableCell>
                  <TableCell>{role.namespace}</TableCell>
                  <TableCell>{role.rulesCount}</TableCell>
                  <TableCell>{formatAge(role.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.namespace !== undefined && (
        <DetailPanel
          role={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
