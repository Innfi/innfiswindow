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

interface K8sServicePort {
  name: string
  protocol: string
  port: number
  targetPort: string
  nodePort: number | null
}

interface K8sService {
  name: string
  namespace: string
  type: string
  clusterIP: string
  externalIP: string
  ports: K8sServicePort[]
  creationTimestamp: string
  selector: Record<string, string>
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

function formatPorts(ports: K8sServicePort[]): string {
  if (ports.length === 0) return "-"
  return ports.map((p) => `${p.port}/${p.protocol}`).join(", ")
}

function DetailPanel({ svc }: { svc: K8sService }): JSX.Element {
  const selectorEntries = Object.entries(svc.selector)
  const labelEntries = Object.entries(svc.labels)
  const annotationEntries = Object.entries(svc.annotations)

  return (
    <div className="w-96 shrink-0 border-l h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-base mb-1">{svc.name}</h2>
        <span className="text-xs text-muted-foreground">{svc.namespace}</span>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Network
        </h3>
        <div className="flex gap-2 text-sm">
          <span className="shrink-0 font-medium text-muted-foreground">
            Type:
          </span>
          <span>{svc.type}</span>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="shrink-0 font-medium text-muted-foreground">
            ClusterIP:
          </span>
          <span className="font-mono">{svc.clusterIP || "-"}</span>
        </div>
        {svc.externalIP && (
          <div className="flex gap-2 text-sm">
            <span className="shrink-0 font-medium text-muted-foreground">
              External IP:
            </span>
            <span className="font-mono">{svc.externalIP}</span>
          </div>
        )}
      </div>

      {svc.ports.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Ports
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="text-left font-medium pb-1">Name</th>
                <th className="text-left font-medium pb-1">Protocol</th>
                <th className="text-left font-medium pb-1">Port</th>
                <th className="text-left font-medium pb-1">Target</th>
                <th className="text-left font-medium pb-1">NodePort</th>
              </tr>
            </thead>
            <tbody>
              {svc.ports.map((p, i) => (
                <tr key={i} className="font-mono text-xs">
                  <td className="py-0.5">{p.name || "-"}</td>
                  <td className="py-0.5">{p.protocol}</td>
                  <td className="py-0.5">{p.port}</td>
                  <td className="py-0.5">{p.targetPort}</td>
                  <td className="py-0.5">{p.nodePort ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Selector
          </h3>
          {selectorEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">
                {k}:
              </span>
              <span className="break-all">{v}</span>
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
    </div>
  )
}

export function ServicesView(): JSX.Element {
  const [services, setServices] = useState<K8sService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sService | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listServices()
      .then((data) => {
        setServices(data)
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
        <h1 className="text-lg font-semibold mb-4">Services</h1>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>ClusterIP</TableHead>
                <TableHead>External IP</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((svc) => (
                <TableRow
                  key={`${svc.namespace}/${svc.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === svc.name &&
                      selectedItem?.namespace === svc.namespace &&
                      "bg-muted",
                  )}
                  onClick={() => setSelectedItem(svc)}
                >
                  <TableCell>{svc.name}</TableCell>
                  <TableCell>{svc.namespace}</TableCell>
                  <TableCell>{svc.type}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {svc.clusterIP || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {svc.externalIP || "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatPorts(svc.ports)}
                  </TableCell>
                  <TableCell>{formatAge(svc.creationTimestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.type !== undefined && (
        <DetailPanel svc={selectedItem} />
      )}
    </div>
  )
}
