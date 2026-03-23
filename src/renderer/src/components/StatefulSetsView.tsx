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

interface K8sStatefulSetContainer {
  name: string
  image: string
}

interface K8sStatefulSetVolumeClaimTemplate {
  name: string
  storage: string
}

interface K8sStatefulSet {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  creationTimestamp: string
  serviceName: string
  updateStrategy: string
  selector: Record<string, string>
  containers: K8sStatefulSetContainer[]
  volumeClaimTemplates: K8sStatefulSetVolumeClaimTemplate[]
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

function DetailPanel({ ss }: { ss: K8sStatefulSet }): JSX.Element {
  const selectorEntries = Object.entries(ss.selector)

  return (
    <div className="w-80 shrink-0 border-l h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-base mb-1">{ss.name}</h2>
        <span className="text-xs text-muted-foreground">{ss.namespace}</span>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Replicas
        </h3>
        <MetaEntry label="Desired" value={String(ss.replicas)} />
        <MetaEntry label="Ready" value={String(ss.readyReplicas)} />
        <MetaEntry label="Created" value={new Date(ss.creationTimestamp).toLocaleString()} />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Configuration
        </h3>
        <MetaEntry label="Service Name" value={ss.serviceName} />
        <MetaEntry label="Update Strategy" value={ss.updateStrategy} />
      </div>

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

      {ss.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {ss.containers.map((c) => (
            <div key={c.name} className="text-sm border rounded p-2 space-y-0.5">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground break-all">{c.image}</div>
            </div>
          ))}
        </div>
      )}

      {ss.volumeClaimTemplates.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Volume Claim Templates
          </h3>
          {ss.volumeClaimTemplates.map((vct) => (
            <div key={vct.name} className="text-sm border rounded p-2 space-y-0.5">
              <div className="font-medium">{vct.name}</div>
              <div className="text-xs text-muted-foreground">{vct.storage}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StatefulSetsView(): JSX.Element {
  const [statefulSets, setStatefulSets] = useState<K8sStatefulSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sStatefulSet | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listStatefulSets()
      .then((data) => {
        setStatefulSets(data)
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
        <h1 className="text-lg font-semibold mb-4">StatefulSets</h1>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Service</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statefulSets.map((ss) => (
                <TableRow
                  key={`${ss.namespace}/${ss.name}`}
                  className={cn(
                    'cursor-pointer',
                    selectedItem?.name === ss.name &&
                      selectedItem?.namespace === ss.namespace &&
                      'bg-muted'
                  )}
                  onClick={() => setSelectedItem(ss)}
                >
                  <TableCell>{ss.name}</TableCell>
                  <TableCell>{ss.namespace}</TableCell>
                  <TableCell>{ss.readyReplicas}/{ss.replicas}</TableCell>
                  <TableCell>{formatAge(ss.creationTimestamp)}</TableCell>
                  <TableCell>{ss.serviceName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.serviceName !== undefined && (
        <DetailPanel ss={selectedItem} />
      )}
    </div>
  )
}
