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

interface K8sNamespace {
  name: string
  status: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
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

function DetailPanel({ ns, onClose }: { ns: K8sNamespace; onClose: () => void }): JSX.Element {
  const labelEntries = Object.entries(ns.labels)
  const annotationEntries = Object.entries(ns.annotations)

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
        <h2 className="font-semibold text-base mb-1">{ns.name}</h2>
        <span
          className={cn(
            "inline-block rounded px-2 py-0.5 text-xs font-medium",
            ns.status === "Active"
              ? "bg-green-100 text-green-800"
              : "bg-yellow-100 text-yellow-800",
          )}
        >
          {ns.status}
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
          value={new Date(ns.creationTimestamp).toLocaleString()}
        />
      </div>

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

      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Annotations
          </h3>
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}
    </div>
  )
}

export function NamespacesView(): JSX.Element {
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sNamespace | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listNamespaces()
      .then((data) => {
        setNamespaces(data)
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
        <h1 className="text-lg font-semibold mb-4">Namespaces</h1>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {namespaces.map((ns) => (
                <TableRow
                  key={ns.name}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === ns.name && "bg-muted",
                  )}
                  onClick={() => setSelectedItem(selectedItem?.name === ns.name ? null : ns)}
                >
                  <TableCell>{ns.name}</TableCell>
                  <TableCell>{ns.status}</TableCell>
                  <TableCell>{formatAge(ns.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && <DetailPanel ns={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  )
}
