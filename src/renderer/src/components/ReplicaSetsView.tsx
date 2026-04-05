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

interface K8sOwnerRef {
  kind: string
  name: string
}

interface K8sReplicaSetContainer {
  name: string
  image: string
}

interface K8sReplicaSet {
  name: string
  namespace: string
  desiredReplicas: number
  currentReplicas: number
  readyReplicas: number
  creationTimestamp: string
  selector: Record<string, string>
  containers: K8sReplicaSetContainer[]
  ownerReferences: K8sOwnerRef[]
  podTemplateLabels: Record<string, string>
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

function DetailPanel({ rs }: { rs: K8sReplicaSet }): JSX.Element {
  const selectorEntries = Object.entries(rs.selector)
  const podTemplateEntries = Object.entries(rs.podTemplateLabels)

  return (
    <div className="w-80 shrink-0 border-l h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-base mb-1">{rs.name}</h2>
        <span className="text-xs text-muted-foreground">{rs.namespace}</span>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Replicas
        </h3>
        <MetaEntry label="Desired" value={String(rs.desiredReplicas)} />
        <MetaEntry label="Current" value={String(rs.currentReplicas)} />
        <MetaEntry label="Ready" value={String(rs.readyReplicas)} />
        <MetaEntry
          label="Created"
          value={new Date(rs.creationTimestamp).toLocaleString()}
        />
      </div>

      {rs.ownerReferences.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Owner References
          </h3>
          {rs.ownerReferences.map((o, i) => (
            <div key={i} className="text-sm border rounded p-2 space-y-0.5">
              <div className="font-medium">{o.name}</div>
              <div className="text-xs text-muted-foreground">{o.kind}</div>
            </div>
          ))}
        </div>
      )}

      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Selector Labels
          </h3>
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {rs.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {rs.containers.map((c) => (
            <div
              key={c.name}
              className="text-sm border rounded p-2 space-y-0.5"
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground break-all">
                {c.image}
              </div>
            </div>
          ))}
        </div>
      )}

      {podTemplateEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Pod Template Labels
          </h3>
          {podTemplateEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ReplicaSetsView(): JSX.Element {
  const [replicaSets, setReplicaSets] = useState<K8sReplicaSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sReplicaSet | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listReplicaSets()
      .then((data) => {
        setReplicaSets(data)
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
        <h1 className="text-lg font-semibold mb-4">ReplicaSets</h1>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Desired</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {replicaSets.map((rs) => (
                <TableRow
                  key={`${rs.namespace}/${rs.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === rs.name &&
                      selectedItem?.namespace === rs.namespace &&
                      "bg-muted",
                  )}
                  onClick={() => setSelectedItem(rs)}
                >
                  <TableCell>{rs.name}</TableCell>
                  <TableCell>{rs.namespace}</TableCell>
                  <TableCell>{rs.desiredReplicas}</TableCell>
                  <TableCell>{rs.currentReplicas}</TableCell>
                  <TableCell>{rs.readyReplicas}</TableCell>
                  <TableCell>{formatAge(rs.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem &&
        selectedItem.namespace !== undefined &&
        selectedItem.desiredReplicas !== undefined && (
          <DetailPanel rs={selectedItem} />
        )}
    </div>
  )
}
