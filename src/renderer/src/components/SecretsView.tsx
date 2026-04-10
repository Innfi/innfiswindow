import { dump as yamlDump } from "js-yaml"
import { Eye, EyeOff, FileCode, X } from "lucide-react"
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
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { YamlEditorPanel } from "./YamlEditorPanel"

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

function DetailPanel({
  secret,
  onClose,
}: {
  secret: K8sSecret
  onClose: () => void
}): JSX.Element {
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
    <div className="w-96 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{secret.name}</h2>
          <span className="text-xs text-muted-foreground">
            {secret.namespace}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
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
                <span className="font-mono font-bold text-sm flex-1">
                  {key}
                </span>
                <button
                  onClick={() => toggleReveal(key)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={
                    revealedKeys.has(key) ? "Hide value" : "Show value"
                  }
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
                <div className="text-sm text-muted-foreground tracking-widest">
                  ••••••••
                </div>
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

export function SecretsView(): JSX.Element {
  const [secrets, setSecrets] = useState<K8sSecret[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [yamlInitial, setYamlInitial] = useState("")
  const [yamlTitle, setYamlTitle] = useState("")

  const selectedItem = useAppStore((s) => s.selectedItem) as K8sSecret | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  function fetchSecrets(): void {
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
  }

  useEffect(() => {
    fetchSecrets()
  }, [])

  function openNewYaml(): void {
    const template = yamlDump({
      apiVersion: "v1",
      kind: "Secret",
      metadata: { name: "my-secret", namespace: "default" },
      type: "Opaque",
      data: { key: "dmFsdWU=" },
    })
    setYamlInitial(template)
    setYamlTitle("New Secret (YAML)")
    setYamlOpen(true)
  }

  function openEditYaml(secret: K8sSecret): void {
    const obj = {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: secret.name,
        namespace: secret.namespace,
        ...(Object.keys(secret.labels).length > 0
          ? { labels: secret.labels }
          : {}),
      },
      type: secret.type,
      ...(Object.keys(secret.data).length > 0 ? { data: secret.data } : {}),
    }
    setYamlInitial(yamlDump(obj))
    setYamlTitle(`Edit Secret: ${secret.namespace}/${secret.name}`)
    setYamlOpen(true)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Secrets</h1>
          <Button size="sm" variant="outline" onClick={openNewYaml}>
            <FileCode className="h-4 w-4" />
            New Resource (YAML)
          </Button>
        </div>
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
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow
                  key={`${secret.namespace}/${secret.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === secret.name &&
                      selectedItem?.namespace === secret.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === secret.name &&
                        selectedItem?.namespace === secret.namespace
                        ? null
                        : secret,
                    )
                  }
                >
                  <TableCell>{secret.name}</TableCell>
                  <TableCell>{secret.namespace}</TableCell>
                  <TableCell className="text-xs">{secret.type}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {secret.keys.join(", ") || "-"}
                  </TableCell>
                  <TableCell>{formatAge(secret.creationTimestamp)}</TableCell>
                  <TableCell>
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit YAML"
                        onClick={() => openEditYaml(secret)}
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

      {selectedItem && selectedItem.type !== undefined && (
        <DetailPanel
          secret={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <YamlEditorPanel
        open={yamlOpen}
        onOpenChange={setYamlOpen}
        initialYaml={yamlInitial}
        title={yamlTitle}
        onApplied={() => {
          fetchSecrets()
          setSelectedItem(null)
        }}
      />
    </div>
  )
}
