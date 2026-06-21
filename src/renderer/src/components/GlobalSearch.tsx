import { Loader2, Search } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { useAppStore } from "../../store/app.store"

type SearchResult = {
  name: string
  namespace?: string
  resourceType: string
  item: object
}

const RESOURCE_ORDER = [
  "Pods",
  "Deployments",
  "StatefulSets",
  "DaemonSets",
  "ReplicaSets",
  "Services",
  "Ingresses",
  "ConfigMaps",
  "Secrets",
  "Namespaces",
  "Nodes",
  "ServiceAccounts",
  "Roles",
  "ClusterRoles",
  "RoleBindings",
  "ClusterRoleBindings",
]

export function GlobalSearch(): JSX.Element {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, SearchResult[]>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedContext = useAppStore((s) => s.selectedContext)
  const navigateToResource = useAppStore((s) => s.navigateToResource)

  // Click outside to close
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Ctrl+K / Cmd+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const search = useCallback(
    async (q: string): Promise<void> => {
      const ctx = selectedContext ? { contextName: selectedContext } : undefined
      const lower = q.toLowerCase()
      setLoading(true)
      setOpen(true)

      const [
        pods,
        deployments,
        statefulSets,
        daemonSets,
        replicaSets,
        services,
        ingresses,
        configMaps,
        secrets,
        namespaces,
        nodes,
        serviceAccounts,
        roles,
        clusterRoles,
        roleBindings,
        clusterRoleBindings,
      ] = await Promise.allSettled([
        window.api.k8s.listPods(ctx),
        window.api.k8s.listDeployments(ctx),
        window.api.k8s.listStatefulSets(ctx),
        window.api.k8s.listDaemonSets(ctx),
        window.api.k8s.listReplicaSets(ctx),
        window.api.k8s.listServices(ctx),
        window.api.k8s.listIngresses(ctx),
        window.api.k8s.listConfigMaps(ctx),
        window.api.k8s.listSecrets(ctx),
        window.api.k8s.listNamespaces(ctx),
        window.api.k8s.listNodes(ctx),
        window.api.k8s.listServiceAccounts(ctx),
        window.api.k8s.listRoles(ctx),
        window.api.k8s.listClusterRoles(ctx),
        window.api.k8s.listRoleBindings(ctx),
        window.api.k8s.listClusterRoleBindings(ctx),
      ])

      const grouped: Record<string, SearchResult[]> = {}

      function process<T extends { name: string; namespace?: string }>(
        settled: PromiseSettledResult<T[]>,
        kind: string,
      ): void {
        if (settled.status !== "fulfilled") return
        const matches = settled.value
          .filter((item) => item.name.toLowerCase().includes(lower))
          .slice(0, 5)
          .map((item) => ({
            name: item.name,
            namespace: item.namespace,
            resourceType: kind,
            item: item as object,
          }))
        if (matches.length > 0) grouped[kind] = matches
      }

      process(pods, "Pods")
      process(deployments, "Deployments")
      process(statefulSets, "StatefulSets")
      process(daemonSets, "DaemonSets")
      process(replicaSets, "ReplicaSets")
      process(services, "Services")
      process(ingresses, "Ingresses")
      process(configMaps, "ConfigMaps")
      process(secrets, "Secrets")
      process(namespaces, "Namespaces")
      process(nodes, "Nodes")
      process(serviceAccounts, "ServiceAccounts")
      process(roles, "Roles")
      process(clusterRoles, "ClusterRoles")
      process(roleBindings, "RoleBindings")
      process(clusterRoleBindings, "ClusterRoleBindings")

      setResults(grouped)
      setLoading(false)
    },
    [selectedContext],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 2) {
      setResults({})
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const handleSelect = (result: SearchResult): void => {
    navigateToResource(result.resourceType, result.item)
    setOpen(false)
    setQuery("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Escape") {
      setOpen(false)
      setQuery("")
      inputRef.current?.blur()
    }
  }

  const hasResults = Object.keys(results).length > 0
  const orderedKinds = RESOURCE_ORDER.filter((k) => results[k])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length >= 2) setOpen(true)
          }}
          placeholder="Search... (Ctrl+K)"
          className="rounded border pl-7 pr-6 py-0.5 text-xs bg-background text-foreground w-48 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {loading && (
          <Loader2 className="absolute right-2 h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-y-auto z-50 rounded-md border bg-background text-foreground shadow-md">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : !hasResults ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No results found
            </div>
          ) : (
            orderedKinds.map((kind) => (
              <div key={kind}>
                <div className="border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {kind}
                </div>
                {results[kind].map((r) => (
                  <button
                    key={`${kind}-${r.name}-${r.namespace ?? ""}`}
                    onClick={() => handleSelect(r)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors"
                  >
                    <span className="flex-1 truncate text-xs font-medium">
                      {r.name}
                    </span>
                    {r.namespace && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {r.namespace}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
