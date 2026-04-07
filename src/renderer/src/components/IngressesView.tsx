import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { useAppStore } from "../../store/app.store"
import { cn } from "../../lib/utils"

interface K8sIngressTLS {
  secretName: string
  hosts: string[]
}

interface K8sIngressPath {
  path: string
  pathType: string
  serviceName: string
  servicePort: string | number
}

interface K8sIngressRule {
  host: string
  paths: K8sIngressPath[]
}

interface K8sIngress {
  name: string
  namespace: string
  ingressClassName: string
  hosts: string
  address: string
  ports: string
  creationTimestamp: string
  tls: K8sIngressTLS[]
  rules: K8sIngressRule[]
  labels: Record<string, string>
  annotations: Record<string, string>
}

function formatAge(timestamp: string): string {
  if (!timestamp) return ""
  const diff = Date.now() - new Date(timestamp).getTime()
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d`
  const hours = Math.floor(diff / 3600000)
  if (hours > 0) return `${hours}h`
  const mins = Math.floor(diff / 60000)
  return `${mins}m`
}

function DetailPanel({ item }: { item: K8sIngress }) {
  return (
    <div className="w-96 shrink-0 border-l overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-lg mb-1">{item.name}</h2>
        <p className="text-xs text-muted-foreground">{item.namespace}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Ingress Class</p>
        <p className="text-sm">{item.ingressClassName || <span className="text-muted-foreground italic">none</span>}</p>
      </div>

      {item.tls.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">TLS</p>
          <div className="space-y-2">
            {item.tls.map((t: K8sIngressTLS, i: number) => (
              <div key={i} className="rounded border p-2 text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">Secret: </span>
                  <span className="font-mono">{t.secretName || <span className="italic text-muted-foreground">none</span>}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Hosts: </span>
                  <span>{t.hosts.length > 0 ? t.hosts.join(", ") : "*"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Rules</p>
        {item.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No rules</p>
        ) : (
          <div className="space-y-3">
            {item.rules.map((rule: K8sIngressRule, i: number) => (
              <div key={i} className="rounded border p-2">
                <p className="font-mono text-sm font-medium mb-2">{rule.host}</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left pb-1">Path</th>
                      <th className="text-left pb-1">Type</th>
                      <th className="text-left pb-1">Service</th>
                      <th className="text-left pb-1">Port</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rule.paths.map((p, j) => (
                      <tr key={j}>
                        <td className="font-mono pr-2">{p.path}</td>
                        <td className="pr-2">{p.pathType}</td>
                        <td className="pr-2">{p.serviceName}</td>
                        <td>{String(p.servicePort)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {Object.keys(item.labels).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Labels</p>
          <div className="space-y-0.5">
            {Object.entries(item.labels).map(([k, v]) => (
              <div key={k} className="text-xs font-mono">
                <span className="text-muted-foreground">{k}=</span>{v}
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(item.annotations).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Annotations</p>
          <div className="space-y-0.5">
            {Object.entries(item.annotations).map(([k, v]) => (
              <div key={k} className="text-xs font-mono break-all">
                <span className="text-muted-foreground">{k}=</span>{v}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function IngressesView() {
  const [ingresses, setIngresses] = useState<K8sIngress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sIngress | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  useEffect(() => {
    setLoading(true)
    window.api.k8s
      .listIngresses()
      .then(setIngresses)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading...</div>
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-destructive">{error}</div>
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Namespace</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Hosts</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Ports</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingresses.map((ing) => (
              <TableRow
                key={`${ing.namespace}/${ing.name}`}
                className={cn(
                  "cursor-pointer",
                  selectedItem?.name === ing.name &&
                    selectedItem?.namespace === ing.namespace &&
                    "bg-muted",
                )}
                onClick={() => setSelectedItem(ing)}
              >
                <TableCell className="font-medium">{ing.name}</TableCell>
                <TableCell>{ing.namespace}</TableCell>
                <TableCell>{ing.ingressClassName || "-"}</TableCell>
                <TableCell>{ing.hosts}</TableCell>
                <TableCell>{ing.address || "-"}</TableCell>
                <TableCell>{ing.ports}</TableCell>
                <TableCell>{formatAge(ing.creationTimestamp)}</TableCell>
              </TableRow>
            ))}
            {ingresses.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No ingresses found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {selectedItem && <DetailPanel item={selectedItem} />}
    </div>
  )
}
