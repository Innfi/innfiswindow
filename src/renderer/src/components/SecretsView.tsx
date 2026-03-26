import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
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

interface K8sSecret {
  name: string
  namespace: string
  type: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  data: Record<string, string>
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

function DetailPanel({ secret }: { secret: K8sSecret }): JSX.Element {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const dataEntries = Object.entries(secret.data)
  const labelEntries = Object.entries(secret.labels)
  const annotationEntries = Object.entries(secret.annotations)

  function toggleReveal(key: string) {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="w-96 shrink-0 border-l h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-base mb-1">{secret.name}</h2>
        <span className="text-xs text-muted-foreground">{secret.namespace}</span>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1">
          Type
        </h3>
        <span className="text-sm font-mono">{secret.type}</span>
      </div>

      {dataEntries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Data
          </h3>
          {dataEntries.map(([key, value]) => (
            <div key={key} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm flex-1">{key}</span>
                <button
                  onClick={() => toggleReveal(key)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={revealedKeys.has(key) ? 'Hide value' : 'Show value'}
                >
                  {revealedKeys.has(key) ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {revealedKeys.has(key) ? (
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {value}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground tracking-widest">••••••••</div>
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

export function SecretsView(): JSX.Element {
  const [secrets, setSecrets] = useState<K8sSecret[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sSecret | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listSecrets()
      .then((data) => {
        setSecrets(data)
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
        <h1 className="text-lg font-semibold mb-4">Secrets</h1>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Keys</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow
                  key={`${secret.namespace}/${secret.name}`}
                  className={cn(
                    'cursor-pointer',
                    selectedItem?.name === secret.name &&
                      selectedItem?.namespace === secret.namespace &&
                      'bg-muted'
                  )}
                  onClick={() => setSelectedItem(secret)}
                >
                  <TableCell>{secret.name}</TableCell>
                  <TableCell>{secret.namespace}</TableCell>
                  <TableCell className="text-xs">{secret.type}</TableCell>
                  <TableCell className="max-w-xs truncate">{secret.keys.join(', ') || '-'}</TableCell>
                  <TableCell>{formatAge(secret.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.type !== undefined && (
        <DetailPanel secret={selectedItem} />
      )}
    </div>
  )
}
