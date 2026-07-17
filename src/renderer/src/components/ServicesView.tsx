import { ArrowLeftRight } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/AlertDialog"
import { Button } from "../../components/ui/Button"
import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { EditButton } from "../../components/ui/EditButton"
import { MetaEntry } from "../../components/ui/MetaEntry"
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useRecordHistory } from "../hooks/useRecordHistory"
import { K8sEndpoint, K8sService, K8sServicePort } from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

function formatPorts(ports: K8sServicePort[]): string {
  if (ports.length === 0) return "-"
  return ports.map((p) => `${p.port}/${p.protocol}`).join(", ")
}

function DetailPanel({
  svc,
  onClose,
  onDeleted,
  onPortForward,
  onDeleteDialogChange,
}: {
  svc: K8sService
  onClose: () => void
  onDeleted: () => void
  onPortForward: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [endpoints, setEndpoints] = useState<K8sEndpoint | null>(null)

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  useEffect(() => {
    window.api.k8s
      .listEndpoints({ contextName: selectedContext ?? undefined })
      .then((all) => {
        const ep = all.find(
          (e) => e.name === svc.name && e.namespace === svc.namespace,
        )
        setEndpoints(ep ?? null)
      })
      .catch(() => setEndpoints(null))
  }, [svc.name, svc.namespace, selectedContext])

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  const selectorEntries = Object.entries(svc.selector).filter(([k, v]) =>
    kv(k, v),
  )
  const labelEntries = Object.entries(svc.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(svc.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  async function handleDelete(): Promise<void> {
    const target = {
      action: "delete",
      resourceKind: "Service",
      resourceName: svc.name,
      namespace: svc.namespace,
    } as const
    setDeleting(true)
    try {
      await window.api.k8s.deleteService(svc.namespace, svc.name)
      recordHistory(target, { success: true })
      toast.success(`Service ${svc.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleted()
      onClose()
    } catch (e) {
      recordHistory(target, { success: false, error: String(e) })
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "Service: delete")
      setDeleteOpenNotify(false)
    } finally {
      setDeleting(false)
    }
  }

  const allEndpointIPs = endpoints
    ? endpoints.subsets.flatMap((s) =>
        s.readyAddresses
          .map((a) => ({ ip: a.ip, pod: a.targetPodName, ready: true }))
          .concat(
            s.notReadyAddresses.map((a) => ({
              ip: a.ip,
              pod: a.targetPodName,
              ready: false,
            })),
          ),
      )
    : []

  return (
    <DetailPanelLayout>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{svc.name}</h2>
          <span className="text-xs text-muted-foreground">{svc.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            title="Port Forward"
            onClick={onPortForward}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <EditButton
            resourceKind="Service"
            resourceName={svc.name}
            namespace={svc.namespace}
            buildYaml={() => ({
              apiVersion: "v1",
              kind: "Service",
              metadata: {
                name: svc.name,
                namespace: svc.namespace,
                ...(Object.keys(svc.labels).length > 0
                  ? { labels: svc.labels }
                  : {}),
              },
              spec: {
                type: svc.type,
                ...(Object.keys(svc.selector).length > 0
                  ? { selector: svc.selector }
                  : {}),
                ports: svc.ports.map((p) => ({
                  name: p.name || undefined,
                  protocol: p.protocol,
                  port: p.port,
                  targetPort: isNaN(Number(p.targetPort))
                    ? p.targetPort
                    : Number(p.targetPort),
                  ...(p.nodePort ? { nodePort: p.nodePort } : {}),
                })),
              },
            })}
          />
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            onClick={() => setDeleteOpenNotify(true)}
          >
            Delete
          </Button>
          <CopyResourceButton
            name={svc.name}
            namespace={svc.namespace}
            resourceKind="service"
          />
          <ClosePanelButton onClose={onClose} className="ml-1" />
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
      />

      {/* Network */}
      <div className="space-y-1">
        <SectionHeader title="Network" />
        <MetaEntry label="Type" value={svc.type} />
        <MetaEntry label="ClusterIP" value={svc.clusterIP || "None"} mono />
        {svc.externalIP && m(svc.externalIP) && (
          <MetaEntry label="External IP" value={svc.externalIP} mono />
        )}
        {svc.sessionAffinity && m(svc.sessionAffinity) && (
          <MetaEntry label="Session Affinity" value={svc.sessionAffinity} />
        )}
        {svc.externalTrafficPolicy && m(svc.externalTrafficPolicy) && (
          <MetaEntry
            label="External Traffic Policy"
            value={svc.externalTrafficPolicy}
          />
        )}
        <MetaEntry
          label="Created"
          value={new Date(svc.creationTimestamp).toLocaleString()}
        />
      </div>

      {/* Ports */}
      {svc.ports.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Ports" />
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium pb-1">Name</th>
                <th className="text-left font-medium pb-1">Protocol</th>
                <th className="text-left font-medium pb-1">Port</th>
                <th className="text-left font-medium pb-1">Target</th>
                <th className="text-left font-medium pb-1">NodePort</th>
              </tr>
            </thead>
            <tbody>
              {svc.ports
                .filter(
                  (p) => !sl || m(p.name) || m(String(p.port)) || m(p.protocol),
                )
                .map((p, i) => (
                  <tr key={i} className="border-t border-border/40">
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

      {/* Endpoints */}
      {endpoints && allEndpointIPs.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Endpoints" />
          <div className="flex flex-wrap gap-1">
            {allEndpointIPs
              .filter((e) => !sl || m(e.ip) || (e.pod && m(e.pod)))
              .map((e, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono border",
                    e.ready
                      ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                      : "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
                  )}
                  title={e.pod ?? undefined}
                >
                  {e.ip}
                </span>
              ))}
          </div>
          {endpoints.subsets.some((s) => s.notReadyAddresses.length > 0) && (
            <p className="text-xs text-muted-foreground">Yellow = not ready</p>
          )}
        </div>
      )}
      {endpoints && allEndpointIPs.length === 0 && (
        <div className="space-y-1">
          <SectionHeader title="Endpoints" />
          <p className="text-xs text-muted-foreground italic">No endpoints</p>
        </div>
      )}

      {/* Selector */}
      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Selector" />
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Labels */}
      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          {labelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Annotations */}
      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Events */}
      <ResourceEventsSection
        namespace={svc.namespace}
        name={svc.name}
        kind="Service"
        search={sl}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {svc.namespace}/{svc.name}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpenNotify(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailPanelLayout>
  )
}

export function ServicesView(): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)

  return (
    <ResourceListView<K8sService>
      title="Services"
      list={(ctx) => window.api.k8s.listServices({ contextName: ctx })}
      detailGuard={(item) => (item as K8sService).type !== undefined}
      columns={[
        { head: "Name", cell: (svc) => svc.name },
        { head: "Namespace", cell: (svc) => svc.namespace },
        { head: "Type", cell: (svc) => svc.type },
        {
          head: "ClusterIP",
          cell: (svc) => svc.clusterIP || "-",
          className: "font-mono text-xs",
        },
        {
          head: "External IP",
          cell: (svc) => svc.externalIP || "-",
          className: "font-mono text-xs",
        },
        {
          head: "Ports",
          cell: (svc) => formatPorts(svc.ports),
          className: "text-xs",
        },
        ageColumn<K8sService>(),
      ]}
      renderDetail={(svc, ctl: DetailController) => (
        <DetailPanel
          svc={svc}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onPortForward={() => {
            const firstPort = svc.ports[0]?.port ?? 80
            openDrawerTab({
              tabKey: `port-forward:Service:${svc.namespace}/${svc.name}`,
              type: "port-forward",
              resourceKind: "Service",
              resourceName: svc.name,
              namespace: svc.namespace,
              localPort: firstPort,
              targetPort: firstPort,
            })
          }}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
