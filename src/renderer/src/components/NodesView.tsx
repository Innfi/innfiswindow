import { useEffect, useState } from "react"
import { useAppStore } from "../../store/app.store"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../components/ui/table"
import { cn } from "../../lib/utils"
import { X } from "lucide-react"

interface K8sNodeCondition {
  type: string
  status: string
  reason: string
  message: string
}

interface K8sNode {
  name: string
  status: string
  roles: string
  creationTimestamp: string
  version: string
  labels: Record<string, string>
  capacity: Record<string, string>
  allocatable: Record<string, string>
  conditions: K8sNodeCondition[]
}

function formatAge(isoTimestamp: string): string {
  if (!isoTimestamp) return "-"
  const diffMs = Date.now() - new Date(isoTimestamp).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 60) return `${diffSecs}s`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

function MetaEntry({
  label,
  value,
}: {
  label: string
  value: string
}): JSX.Element {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground w-32">
        {label}
      </span>
      <span className="break-all">{value}</span>
    </div>
  )
}

function DetailPanel({ node, onClose }: { node: K8sNode; onClose: () => void }): JSX.Element {
  const labelEntries = Object.entries(node.labels)
  const capacityEntries = Object.entries(node.capacity)
  const allocatableEntries = Object.entries(node.allocatable)

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
        <h2 className="font-semibold text-base mb-1">{node.name}</h2>
        <span
          className={cn(
            "inline-block rounded px-2 py-0.5 text-xs font-medium",
            node.status === "Ready"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800",
          )}
        >
          {node.status}
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
          Metadata
        </h3>
        <MetaEntry
          label="Created"
          value={new Date(node.creationTimestamp).toLocaleString()}
        />
        <MetaEntry label="Roles" value={node.roles} />
        <MetaEntry label="Version" value={node.version} />
      </div>

      {capacityEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Capacity
          </h3>
          {capacityEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {allocatableEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Allocatable
          </h3>
          {allocatableEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {node.conditions.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Conditions
          </h3>
          {node.conditions.map((c) => (
            <div
              key={c.type}
              className="text-sm space-y-0.5 border rounded p-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.type}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs",
                    c.status === "True"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800",
                  )}
                >
                  {c.status}
                </span>
              </div>
              {c.reason && (
                <div className="text-xs text-muted-foreground">{c.reason}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Labels
          </h3>
          {labelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}
    </div>
  )
}

export function NodesView(): JSX.Element {
  const [nodes, setNodes] = useState<K8sNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sNode | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listNodes()
      .then((data) => {
        setNodes(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <h1 className="text-lg font-semibold mb-4">Nodes</h1>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map((node) => (
                <TableRow
                  key={node.name}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === node.name && "bg-muted",
                  )}
                  onClick={() => setSelectedItem(selectedItem?.name === node.name ? null : node)}
                >
                  <TableCell>{node.name}</TableCell>
                  <TableCell>{node.status}</TableCell>
                  <TableCell>{node.roles}</TableCell>
                  <TableCell>{formatAge(node.creationTimestamp)}</TableCell>
                  <TableCell>{node.version}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && <DetailPanel node={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  )
}
