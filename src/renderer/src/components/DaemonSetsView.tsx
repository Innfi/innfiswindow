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

interface K8sDaemonSetContainer {
  name: string
  image: string
}

interface K8sDaemonSetToleration {
  key: string
  operator: string
  value: string
  effect: string
}

interface K8sDaemonSet {
  name: string
  namespace: string
  desiredNumberScheduled: number
  currentNumberScheduled: number
  numberReady: number
  updatedNumberScheduled: number
  numberAvailable: number
  creationTimestamp: string
  updateStrategy: string
  selector: Record<string, string>
  nodeSelector: Record<string, string>
  containers: K8sDaemonSetContainer[]
  tolerations: K8sDaemonSetToleration[]
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

function DetailPanel({ ds }: { ds: K8sDaemonSet }): JSX.Element {
  const selectorEntries = Object.entries(ds.selector)
  const nodeSelectorEntries = Object.entries(ds.nodeSelector)

  return (
    <div className="w-80 shrink-0 border-l h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-base mb-1">{ds.name}</h2>
        <span className="text-xs text-muted-foreground">{ds.namespace}</span>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Scheduling
        </h3>
        <MetaEntry label="Desired" value={String(ds.desiredNumberScheduled)} />
        <MetaEntry label="Current" value={String(ds.currentNumberScheduled)} />
        <MetaEntry label="Ready" value={String(ds.numberReady)} />
        <MetaEntry label="Up-to-date" value={String(ds.updatedNumberScheduled)} />
        <MetaEntry label="Available" value={String(ds.numberAvailable)} />
        <MetaEntry label="Created" value={new Date(ds.creationTimestamp).toLocaleString()} />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Update Strategy
        </h3>
        <MetaEntry label="Strategy" value={ds.updateStrategy} />
      </div>

      {nodeSelectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Node Selector
          </h3>
          {nodeSelectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
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

      {ds.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {ds.containers.map((c) => (
            <div key={c.name} className="text-sm border rounded p-2 space-y-0.5">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground break-all">{c.image}</div>
            </div>
          ))}
        </div>
      )}

      {ds.tolerations.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Tolerations
          </h3>
          {ds.tolerations.map((t, i) => (
            <div key={i} className="text-sm border rounded p-2 space-y-0.5">
              {t.key && <div className="font-medium">{t.key}</div>}
              <div className="text-xs text-muted-foreground">
                {[t.operator, t.value, t.effect].filter(Boolean).join(' / ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DaemonSetsView(): JSX.Element {
  const [daemonSets, setDaemonSets] = useState<K8sDaemonSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sDaemonSet | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listDaemonSets()
      .then((data) => {
        setDaemonSets(data)
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
        <h1 className="text-lg font-semibold mb-4">DaemonSets</h1>
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
                <TableHead>Up-to-date</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daemonSets.map((ds) => (
                <TableRow
                  key={`${ds.namespace}/${ds.name}`}
                  className={cn(
                    'cursor-pointer',
                    selectedItem?.name === ds.name &&
                      selectedItem?.namespace === ds.namespace &&
                      'bg-muted'
                  )}
                  onClick={() => setSelectedItem(ds)}
                >
                  <TableCell>{ds.name}</TableCell>
                  <TableCell>{ds.namespace}</TableCell>
                  <TableCell>{ds.desiredNumberScheduled}</TableCell>
                  <TableCell>{ds.currentNumberScheduled}</TableCell>
                  <TableCell>{ds.numberReady}</TableCell>
                  <TableCell>{ds.updatedNumberScheduled}</TableCell>
                  <TableCell>{ds.numberAvailable}</TableCell>
                  <TableCell>{formatAge(ds.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.desiredNumberScheduled !== undefined && (
        <DetailPanel ds={selectedItem} />
      )}
    </div>
  )
}
