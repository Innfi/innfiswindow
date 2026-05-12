import { ChevronDown, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import * as Collapsible from "@radix-ui/react-collapsible"

import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { K8sContext } from "../types/k8s"

const groups = [
  { label: "Cluster", items: ["Namespaces", "Nodes", "Events"] },
  {
    label: "Workloads",
    items: [
      "Deployments",
      "ReplicaSets",
      "StatefulSets",
      "DaemonSets",
      "Pods",
      "HPAs",
    ],
  },
  { label: "Configuration", items: ["ConfigMaps", "Secrets"] },
  { label: "Networking", items: ["Services", "Ingresses"] },
  {
    label: "Auth",
    items: [
      "ServiceAccounts",
      "Roles",
      "ClusterRoles",
      "RoleBindings",
      "ClusterRoleBindings",
    ],
  },
]

const clusterTypeBadgeClass: Record<string, string> = {
  EKS: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  AKS: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Local: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
}

export function TreeView(): JSX.Element {
  const [contexts, setContexts] = useState<K8sContext[]>([])
  const [openContexts, setOpenContexts] = useState<Record<string, boolean>>({})
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const selectedResourceType = useAppStore((s) => s.selectedResourceType)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const setSelectedResourceType = useAppStore((s) => s.setSelectedResourceType)
  const setSelectedContext = useAppStore((s) => s.setSelectedContext)

  useEffect(() => {
    window.api.k8s
      .listContexts()
      .then((data) => {
        setContexts(data)
        // Open all contexts by default
        const ctxOpen: Record<string, boolean> = {}
        data.forEach((c) => {
          ctxOpen[c.name] = true
        })
        setOpenContexts(ctxOpen)
        // Open all groups by default
        const grpOpen: Record<string, boolean> = {}
        data.forEach((c) => {
          groups.forEach((g) => {
            grpOpen[`${c.name}::${g.label}`] = true
          })
        })
        setOpenGroups(grpOpen)
      })
      .catch(() => {})
  }, [])

  function toggleContext(name: string) {
    setOpenContexts((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function selectLeaf(contextName: string, resourceType: string) {
    setSelectedContext(contextName)
    setSelectedResourceType(resourceType)
  }

  return (
    <div className="py-2">
      {/* Overview — top-level item */}
      <div
        className={cn(
          "cursor-pointer py-1.5 px-3 text-xs font-bold hover:bg-accent",
          selectedResourceType === "overview" && "bg-accent font-medium",
        )}
        onClick={() => {
          setSelectedContext(null)
          setSelectedResourceType("overview")
        }}
      >
        Overview
      </div>

      {contexts.map((ctx) => (
        <Collapsible.Root
          key={ctx.name}
          open={openContexts[ctx.name]}
          onOpenChange={() => toggleContext(ctx.name)}
        >
          <Collapsible.Trigger asChild>
            <button className="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-bold hover:bg-accent">
              {openContexts[ctx.name] ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="flex-1 truncate text-left">{ctx.name}</span>
              <span
                className={cn(
                  "ml-1 shrink-0 rounded px-1 py-0.5 text-[10px] font-medium",
                  clusterTypeBadgeClass[ctx.clusterType] ??
                    clusterTypeBadgeClass.Local,
                )}
              >
                {ctx.clusterType}
              </span>
            </button>
          </Collapsible.Trigger>
          <Collapsible.Content>
            {groups.map((group) => {
              const groupKey = `${ctx.name}::${group.label}`
              return (
                <Collapsible.Root
                  key={groupKey}
                  open={openGroups[groupKey]}
                  onOpenChange={() => toggleGroup(groupKey)}
                >
                  <Collapsible.Trigger asChild>
                    <button className="flex w-full items-center gap-1 pl-6 pr-3 py-1.5 text-sm font-semibold hover:bg-accent">
                      {openGroups[groupKey] ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      {group.label}
                    </button>
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    {group.items.map((item) => (
                      <div
                        key={item}
                        className={cn(
                          "cursor-pointer py-1.5 pl-12 pr-3 text-sm hover:bg-accent",
                          selectedContext === ctx.name &&
                            selectedResourceType === item &&
                            "bg-accent font-medium",
                        )}
                        onClick={() => selectLeaf(ctx.name, item)}
                      >
                        {item}
                      </div>
                    ))}
                  </Collapsible.Content>
                </Collapsible.Root>
              )
            })}
          </Collapsible.Content>
        </Collapsible.Root>
      ))}

      {/* Custom Stream — top-level item */}
      <div
        className={cn(
          "cursor-pointer py-1.5 px-3 text-xs font-bold hover:bg-accent",
          selectedResourceType === "custom-stream" && "bg-accent font-medium",
        )}
        onClick={() => {
          setSelectedContext(null)
          setSelectedResourceType("custom-stream")
        }}
      >
        Custom Stream
      </div>
    </div>
  )
}
