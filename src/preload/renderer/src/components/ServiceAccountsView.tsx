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

interface K8sServiceAccount {
  name: string
  namespace: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  secrets: string[]
  imagePullSecrets: string[]
}

function DetailPanel({
  sa,
  onClose,
}: {
  sa: K8sServiceAccount
  onClose: () => void
}): JSX.Element {
  const labelEntries = Object.entries(sa.labels)
  const annotationEntries = Object.entries(sa.annotations)

  return (
    <div className="w-96 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{sa.name}</h2>
          <span className="text-xs text-muted-foreground">{sa.namespace}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Labels
          </h3>
          {labelEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">
                {k}:
              </span>
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
              <span className="shrink-0 font-medium text-muted-foreground">
                {k}:
              </span>
              <span className="break-all">{v}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Secrets ({sa.secrets.length})
        </h3>
        {sa.secrets.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          sa.secrets.map((s) => (
            <div key={s} className="text-sm font-mono">
              {s}
            </div>
          ))
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Image Pull Secrets ({sa.imagePullSecrets.length})
        </h3>
        {sa.imagePullSecrets.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          sa.imagePullSecrets.map((s) => (
            <div key={s} className="text-sm font-mono">
              {s}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function ServiceAccountsView(): JSX.Element {
  const [serviceAccounts, setServiceAccounts] = useState<K8sServiceAccount[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sServiceAccount | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const visible = filterResources(
    serviceAccounts,
    nameFilter,
    selectedNamespace,
  )

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listServiceAccounts({ contextName: selectedContext ?? undefined })
      .then((data) => {
        setServiceAccounts(data)
        setLoading(false)
      })
      .catch((err) => {
        handleIpcError(err, "ServiceAccounts")
        setError(String(err))
        setLoading(false)
      })
  }, [selectedContext])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Service Accounts</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Secrets</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((sa) => (
                <TableRow
                  key={`${sa.namespace}/${sa.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === sa.name &&
                      selectedItem?.namespace === sa.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === sa.name &&
                        selectedItem?.namespace === sa.namespace
                        ? null
                        : sa,
                    )
                  }
                >
                  <TableCell>{sa.name}</TableCell>
                  <TableCell>{sa.namespace}</TableCell>
                  <TableCell>{sa.secrets.length}</TableCell>
                  <TableCell>{formatAge(sa.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.secrets !== undefined && (
        <DetailPanel sa={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
