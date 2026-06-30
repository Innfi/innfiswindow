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
      "Jobs",
      "CronJobs",
    ],
  },
  { label: "Configuration", items: ["ConfigMaps", "Secrets"] },
  {
    label: "Networking",
    items: ["Services", "Ingresses", "NetworkPolicies", "Endpoints"],
  },
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
  {
    label: "Storage",
    items: [
      "PersistentVolumes",
      "PersistentVolumeClaims",
      "StorageClasses",
      "VolumeSnapshots",
    ],
  },
  {
    label: "Governance",
    items: ["ResourceQuotas", "LimitRanges", "PodDisruptionBudgets"],
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
  const [helmOpen, setHelmOpen] = useState(true)
  const [alarmsOpen, setAlarmsOpen] = useState(true)

  const selectedResourceType = useAppStore((s) => s.selectedResourceType)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const setSelectedResourceType = useAppStore((s) => s.setSelectedResourceType)
  const setSelectedContext = useAppStore((s) => s.setSelectedContext)
  const cleanupContextStates = useAppStore((s) => s.cleanupContextStates)
  const contextAliases = useAppStore((s) => s.contextAliases)

  useEffect(() => {
    window.api.k8s
      .listContexts()
      .then((data) => {
        setContexts(data)
        cleanupContextStates(data.map((c) => c.name))
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
              <span
                className="flex-1 truncate text-left"
                title={contextAliases[ctx.name] ? ctx.name : undefined}
              >
                {contextAliases[ctx.name] ?? ctx.name}
              </span>
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

      {/* History — top-level item */}
      <div
        className={cn(
          "cursor-pointer py-1.5 px-3 text-xs font-bold hover:bg-accent",
          selectedResourceType === "history" && "bg-accent font-medium",
        )}
        onClick={() => {
          setSelectedContext(null)
          setSelectedResourceType("history")
        }}
      >
        History
      </div>

      {/* Alarms — collapsible section */}
      <Collapsible.Root open={alarmsOpen} onOpenChange={setAlarmsOpen}>
        <Collapsible.Trigger asChild>
          <button className="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-bold hover:bg-accent">
            {alarmsOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            Alarms
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          {(
            [
              { label: "Rules", type: "alarm-rules" },
              { label: "Active Alarms", type: "alarm-active" },
            ] as const
          ).map(({ label, type }) => (
            <div
              key={type}
              className={cn(
                "cursor-pointer py-1.5 pl-8 pr-3 text-sm hover:bg-accent",
                selectedResourceType === type && "bg-accent font-medium",
              )}
              onClick={() => {
                setSelectedContext(null)
                setSelectedResourceType(type)
              }}
            >
              {label}
            </div>
          ))}
        </Collapsible.Content>
      </Collapsible.Root>

      {/* Helm — collapsible section */}
      <Collapsible.Root open={helmOpen} onOpenChange={setHelmOpen}>
        <Collapsible.Trigger asChild>
          <button className="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-bold hover:bg-accent">
            {helmOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            Helm
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          {["Repositories", "Releases"].map((item) => {
            const resourceType = `helm-${item.toLowerCase()}`
            return (
              <div
                key={item}
                className={cn(
                  "cursor-pointer py-1.5 pl-8 pr-3 text-sm hover:bg-accent",
                  selectedResourceType === resourceType &&
                    "bg-accent font-medium",
                )}
                onClick={() => {
                  setSelectedContext(null)
                  setSelectedResourceType(resourceType)
                }}
              >
                {item}
              </div>
            )
          })}
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  )
}
