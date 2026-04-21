import { X } from "lucide-react"
import { useEffect, useState } from "react"

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

interface BindingSubject {
  kind: string
  name: string
  namespace: string
}

interface RoleRef {
  kind: string
  name: string
}

interface K8sRoleBinding {
  name: string
  namespace: string
  roleRef: RoleRef
  subjects: BindingSubject[]
  subjectsCount: number
  creationTimestamp: string
}

function DetailPanel({
  binding,
  onClose,
}: {
  binding: K8sRoleBinding
  onClose: () => void
}): JSX.Element {
  return (
    <div className="w-[480px] shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{binding.name}</h2>
          <span className="text-xs text-muted-foreground">
            {binding.namespace}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Role Ref
        </h3>
        <div className="text-sm">
          <span className="font-medium">{binding.roleRef.kind}:</span>{" "}
          {binding.roleRef.name}
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Subjects ({binding.subjects.length})
        </h3>
        {binding.subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subjects</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {binding.subjects.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{s.kind}</TableCell>
                  <TableCell className="text-xs font-mono">{s.name}</TableCell>
                  <TableCell className="text-xs">{s.namespace}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

export function RoleBindingsView(): JSX.Element {
  const [bindings, setBindings] = useState<K8sRoleBinding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sRoleBinding | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const visible = filterResources(bindings, nameFilter, selectedNamespace)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listRoleBindings()
      .then((data) => {
        setBindings(data)
        setLoading(false)
      })
      .catch((err) => {
        handleIpcError(err, "RoleBindings")
        setError(String(err))
        setLoading(false)
      })
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Role Bindings</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((binding) => (
                <TableRow
                  key={`${binding.namespace}/${binding.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === binding.name &&
                      selectedItem?.namespace === binding.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === binding.name &&
                        selectedItem?.namespace === binding.namespace
                        ? null
                        : binding,
                    )
                  }
                >
                  <TableCell>{binding.name}</TableCell>
                  <TableCell>{binding.namespace}</TableCell>
                  <TableCell>{binding.roleRef.name}</TableCell>
                  <TableCell>{binding.subjectsCount}</TableCell>
                  <TableCell>{formatAge(binding.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem &&
        selectedItem.namespace !== undefined &&
        selectedItem.roleRef !== undefined && (
          <DetailPanel
            binding={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
    </div>
  )
}
