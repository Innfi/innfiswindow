import { dump as yamlDump } from "js-yaml"
import { FileCode, ScrollText, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "../../components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { handleIpcError } from "../../lib/ipc-error"
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { MetaEntry } from "./MetaEntry"
import { YamlEditorPanel } from "./YamlEditorPanel"

interface K8sPodContainer {
  name: string
  image: string
  restartCount: number
}

interface K8sPodCondition {
  type: string
  status: string
  reason: string
  message: string
}

interface K8sPod {
  name: string
  namespace: string
  deployment: string
  app: string
  status: string
  restarts: number
  creationTimestamp: string
  nodeName: string
  containers: K8sPodContainer[]
  conditions: K8sPodCondition[]
}

function DetailPanel({
  pod,
  onClose,
  onLogs,
}: {
  pod: K8sPod
  onClose: () => void
  onLogs: () => void
}): JSX.Element {
  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{pod.name}</h2>
          <span className="text-xs text-muted-foreground">{pod.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title="Logs" onClick={onLogs}>
            <ScrollText className="h-4 w-4" />
          </Button>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Info
        </h3>
        <MetaEntry label="Status" value={pod.status} />
        <MetaEntry label="Node" value={pod.nodeName || "-"} />
        <MetaEntry label="Deployment" value={pod.deployment || "-"} />
        <MetaEntry label="App" value={pod.app || "-"} />
        <MetaEntry label="Restarts" value={String(pod.restarts)} />
        <MetaEntry
          label="Created"
          value={new Date(pod.creationTimestamp).toLocaleString()}
        />
      </div>

      {pod.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {pod.containers.map((c) => (
            <div
              key={c.name}
              className="text-sm border rounded p-2 space-y-0.5"
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground break-all">
                {c.image}
              </div>
              <div className="text-xs text-muted-foreground">
                Restarts: {c.restartCount}
              </div>
            </div>
          ))}
        </div>
      )}

      {pod.conditions.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Conditions
          </h3>
          {pod.conditions.map((c) => (
            <div
              key={c.type}
              className="text-sm space-y-0.5 border rounded p-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.type}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs",
                    c.status === "True"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800",
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

export function PodsView(): JSX.Element {
  const [pods, setPods] = useState<K8sPod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [yamlInitial, setYamlInitial] = useState("")
  const [yamlTitle, setYamlTitle] = useState("")

  const selectedItem = useAppStore((s) => s.selectedItem) as K8sPod | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)

  const visiblePods = selectedNamespace
    ? pods.filter((p) => p.namespace === selectedNamespace)
    : pods

  function fetchPods(): void {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listPods()
      .then((data) => {
        setPods(data)
        setLoading(false)
      })
      .catch((err) => {
        handleIpcError(err, "Pods")
        setError(String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchPods()
  }, [])

  function openEditYaml(pod: K8sPod): void {
    const obj = {
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name: pod.name,
        namespace: pod.namespace,
        ...(pod.app ? { labels: { app: pod.app } } : {}),
      },
      spec: {
        ...(pod.nodeName ? { nodeName: pod.nodeName } : {}),
        containers: pod.containers.map((c) => ({
          name: c.name,
          image: c.image,
        })),
      },
    }
    setYamlInitial(yamlDump(obj))
    setYamlTitle(`Edit Pod: ${pod.namespace}/${pod.name}`)
    setYamlOpen(true)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4">
          <h1 className="text-lg font-semibold">Pods</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Deployment</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Restarts</TableHead>
                <TableHead>Age</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiblePods.map((p) => (
                <TableRow
                  key={`${p.namespace}/${p.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === p.name &&
                      selectedItem?.namespace === p.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === p.name &&
                        selectedItem?.namespace === p.namespace
                        ? null
                        : p,
                    )
                  }
                >
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.namespace}</TableCell>
                  <TableCell>{p.deployment || "-"}</TableCell>
                  <TableCell>{p.app || "-"}</TableCell>
                  <TableCell>{p.status}</TableCell>
                  <TableCell>{p.restarts}</TableCell>
                  <TableCell>{formatAge(p.creationTimestamp)}</TableCell>
                  <TableCell>
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit YAML"
                        onClick={() => openEditYaml(p)}
                      >
                        <FileCode className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.containers !== undefined && (
        <DetailPanel
          pod={selectedItem}
          onClose={() => setSelectedItem(null)}
          onLogs={() =>
            openDrawerTab({
              type: "pod-log",
              namespace: selectedItem.namespace,
              podName: selectedItem.name,
              containers: selectedItem.containers,
            })
          }
        />
      )}

      <YamlEditorPanel
        open={yamlOpen}
        onOpenChange={setYamlOpen}
        initialYaml={yamlInitial}
        title={yamlTitle}
        onApplied={() => {
          fetchPods()
          setSelectedItem(null)
        }}
      />
    </div>
  )
}
