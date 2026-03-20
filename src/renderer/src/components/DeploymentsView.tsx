import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/app.store'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../../components/ui/table'
import { cn } from '../../lib/utils'

interface K8sDeploymentCondition {
  type: string
  status: string
  reason: string
  message: string
}

interface K8sDeploymentContainer {
  name: string
  image: string
}

interface K8sDeployment {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  strategy: string
  creationTimestamp: string
  selector: Record<string, string>
  containers: K8sDeploymentContainer[]
  conditions: K8sDeploymentCondition[]
}

function formatAge(isoTimestamp: string): string {
  if (!isoTimestamp) return '-'
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

function MetaEntry({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground w-32">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  )
}

function DetailPanel({ deployment }: { deployment: K8sDeployment }): JSX.Element {
  const selectorEntries = Object.entries(deployment.selector)

  return (
    <div className="w-80 shrink-0 border-l h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-base mb-1">{deployment.name}</h2>
        <span className="text-xs text-muted-foreground">{deployment.namespace}</span>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Replicas
        </h3>
        <MetaEntry label="Desired" value={String(deployment.replicas)} />
        <MetaEntry label="Ready" value={String(deployment.readyReplicas)} />
        <MetaEntry label="Up-to-date" value={String(deployment.updatedReplicas)} />
        <MetaEntry label="Available" value={String(deployment.availableReplicas)} />
        <MetaEntry label="Strategy" value={deployment.strategy} />
        <MetaEntry label="Created" value={new Date(deployment.creationTimestamp).toLocaleString()} />
      </div>

      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Selector
          </h3>
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {deployment.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {deployment.containers.map((c) => (
            <div key={c.name} className="text-sm border rounded p-2 space-y-0.5">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground break-all">{c.image}</div>
            </div>
          ))}
        </div>
      )}

      {deployment.conditions.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Conditions
          </h3>
          {deployment.conditions.map((c) => (
            <div key={c.type} className="text-sm space-y-0.5 border rounded p-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.type}</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs',
                    c.status === 'True'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
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
    </div>
  )
}

export function DeploymentsView(): JSX.Element {
  const [deployments, setDeployments] = useState<K8sDeployment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sDeployment | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listDeployments()
      .then((data) => {
        setDeployments(data)
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
        <h1 className="text-lg font-semibold mb-4">Deployments</h1>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Up-to-date</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((d) => (
                <TableRow
                  key={`${d.namespace}/${d.name}`}
                  className={cn(
                    'cursor-pointer',
                    selectedItem?.name === d.name &&
                      selectedItem?.namespace === d.namespace &&
                      'bg-muted'
                  )}
                  onClick={() => setSelectedItem(d)}
                >
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{d.namespace}</TableCell>
                  <TableCell>{`${d.readyReplicas}/${d.replicas}`}</TableCell>
                  <TableCell>{d.updatedReplicas}</TableCell>
                  <TableCell>{d.availableReplicas}</TableCell>
                  <TableCell>{formatAge(d.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.namespace !== undefined && (
        <DetailPanel deployment={selectedItem} />
      )}
    </div>
  )
}
