import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import * as Collapsible from "@radix-ui/react-collapsible"

import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"

const groups = [
  { label: "Cluster", items: ["Namespaces", "Nodes", "Events"] },
  {
    label: "Workloads",
    items: ["Deployments", "ReplicaSets", "StatefulSets", "DaemonSets", "Pods"],
  },
  { label: "Configuration", items: ["ConfigMaps", "Secrets"] },
  { label: "Networking", items: ["Services", "Ingresses"] },
]

export function TreeView(): JSX.Element {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Cluster: true,
    Workloads: true,
    Configuration: true,
    Networking: true,
  })
  const selectedResourceType = useAppStore((s) => s.selectedResourceType)
  const setSelectedResourceType = useAppStore((s) => s.setSelectedResourceType)

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="py-2">
      {groups.map((group) => (
        <Collapsible.Root
          key={group.label}
          open={openGroups[group.label]}
          onOpenChange={() => toggleGroup(group.label)}
        >
          <Collapsible.Trigger asChild>
            <button className="flex w-full items-center gap-1 px-3 py-1.5 text-sm font-semibold hover:bg-accent">
              {openGroups[group.label] ? (
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
                  "cursor-pointer py-1.5 pl-9 pr-3 text-sm hover:bg-accent",
                  selectedResourceType === item && "bg-accent font-medium",
                )}
                onClick={() => setSelectedResourceType(item)}
              >
                {item}
              </div>
            ))}
          </Collapsible.Content>
        </Collapsible.Root>
      ))}
    </div>
  )
}
