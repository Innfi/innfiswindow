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

interface K8sConfigMap {
  name: string
  namespace: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  data: Record<string, string>
  binaryData: Record<string, number>
  keys: string[]
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

function DetailPanel({ cm }: { cm: K8sConfigMap }): JSX.Element {
  const dataEntries = Object.entries(cm.data)
  const binaryEntries = Object.entries(cm.binaryData)
  const labelEntries = Object.entries(cm.labels)
  const annotationEntries = Object.entries(cm.annotations)

  return (
    <div className="w-96 shrink-0 border-l h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-base mb-1">{cm.name}</h2>
        <span className="text-xs text-muted-foreground">{cm.namespace}</span>
      </div>

      {dataEntries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Data
          </h3>
          {dataEntries.map(([key, value]) => (
            <div key={key} className="space-y-0.5">
              <div className="font-mono font-bold text-sm">{key}</div>
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {value}
              </pre>
            </div>
          ))}
        </div>
      )}

      {binaryEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Binary Data
          </h3>
          {binaryEntries.map(([key, size]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="font-mono font-bold">{key}</span>
              <span className="text-muted-foreground">{size} bytes</span>
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
            <div key={k} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">{k}:</span>
              <span className="break-all">{v}</span>
            </div>
          ))}
        </div>
      )}

      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Annotations
          </h3>
          {annotationEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">{k}:</span>
              <span className="break-all">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ConfigMapsView(): JSX.Element {
  const [configMaps, setConfigMaps] = useState<K8sConfigMap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sConfigMap | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listConfigMaps()
      .then((data) => {
        setConfigMaps(data)
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
        <h1 className="text-lg font-semibold mb-4">ConfigMaps</h1>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Keys</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configMaps.map((cm) => (
                <TableRow
                  key={`${cm.namespace}/${cm.name}`}
                  className={cn(
                    'cursor-pointer',
                    selectedItem?.name === cm.name &&
                      selectedItem?.namespace === cm.namespace &&
                      'bg-muted'
                  )}
                  onClick={() => setSelectedItem(cm)}
                >
                  <TableCell>{cm.name}</TableCell>
                  <TableCell>{cm.namespace}</TableCell>
                  <TableCell className="max-w-xs truncate">{cm.keys.join(', ') || '-'}</TableCell>
                  <TableCell>{formatAge(cm.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.keys !== undefined && (
        <DetailPanel cm={selectedItem} />
      )}
    </div>
  )
}
