import { Plus, X } from "lucide-react"

import { cn } from "../../lib/utils"
import type { ViewSnapshot } from "../../store/app.store"
import { useAppStore } from "../../store/app.store"
import type { ResourceType } from "../types/resource"

/** Tab captions for the views whose ResourceType id isn't presentable. */
const viewLabels: Partial<Record<ResourceType, string>> = {
  overview: "Overview",
  history: "History",
  "custom-stream": "Custom Stream",
  "helm-repositories": "Helm Repositories",
  "helm-releases": "Helm Releases",
  "alarm-rules": "Alarm Rules",
  "alarm-active": "Active Alarms",
  "api-resources": "API Resources",
  "access-review": "Access Review",
  "custom-resources": "Custom Resources",
  ValidatingWebhookConfigurations: "Validating Webhooks",
  MutatingWebhookConfigurations: "Mutating Webhooks",
  "aws-vpcs": "VPCs",
  "aws-subnets": "Subnets",
  "aws-route-tables": "Route Tables",
  "aws-nat-gateways": "NAT Gateways",
  "aws-internet-gateways": "Internet Gateways",
  "aws-egress-only-gateways": "Egress-Only Gateways",
  "aws-transit-gateways": "Transit Gateways",
  "aws-iam-principals": "IAM Principals",
}

type ViewFields = Pick<
  ViewSnapshot,
  "selectedContext" | "selectedResourceType" | "selectedItem" | "drawerTabs"
>

function itemName(item: object | null): string | undefined {
  const name = (item as { name?: unknown } | null)?.name
  return typeof name === "string" ? name : undefined
}

/**
 * Workspace tabs: each holds a whole view — the cluster, the resource type,
 * the selected object and its own drawer of logs, shells and YAML editors.
 * Middle-click closes a tab; Ctrl/Cmd-click or middle-click on a tree leaf
 * opens that view in a new one.
 */
export function ViewTabBar(): JSX.Element {
  const viewTabs = useAppStore((s) => s.viewTabs)
  const activeViewTabId = useAppStore((s) => s.activeViewTabId)
  const setActiveViewTab = useAppStore((s) => s.setActiveViewTab)
  const openViewTab = useAppStore((s) => s.openViewTab)
  const closeViewTab = useAppStore((s) => s.closeViewTab)
  const contextAliases = useAppStore((s) => s.contextAliases)
  const live: ViewFields = {
    selectedContext: useAppStore((s) => s.selectedContext),
    selectedResourceType: useAppStore((s) => s.selectedResourceType),
    selectedItem: useAppStore((s) => s.selectedItem),
    drawerTabs: useAppStore((s) => s.drawerTabs),
  }

  const canClose = viewTabs.length > 1

  return (
    <div className="flex h-8 shrink-0 items-stretch overflow-x-auto border-b bg-muted/30">
      {viewTabs.map((tab) => {
        const view = tab.snapshot ?? live
        const isActive = tab.id === activeViewTabId
        const ctx = view.selectedContext
        const ctxLabel = ctx === null ? null : (contextAliases[ctx] ?? ctx)
        const type = view.selectedResourceType
        const typeLabel = type ? (viewLabels[type] ?? type) : "Empty"
        const selected = itemName(view.selectedItem)
        const drawerCount = view.drawerTabs.length
        const title = [ctxLabel, typeLabel, selected]
          .filter(Boolean)
          .join(" / ")
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            title={title}
            className={cn(
              "group flex max-w-[260px] shrink-0 cursor-pointer items-center gap-1.5 border-r px-3 text-xs",
              isActive
                ? "border-b-2 border-b-primary bg-background text-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
            onClick={() => setActiveViewTab(tab.id)}
            onAuxClick={(e) => {
              if (e.button === 1 && canClose) closeViewTab(tab.id)
            }}
          >
            {ctxLabel && (
              <span className="max-w-[90px] truncate rounded border px-1 text-[10px]">
                {ctxLabel}
              </span>
            )}
            <span className="truncate">
              {typeLabel}
              {selected && (
                <span className="text-muted-foreground"> / {selected}</span>
              )}
            </span>
            {drawerCount > 0 && (
              <span
                className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground"
                title={`${drawerCount} open in drawer`}
              >
                {drawerCount}
              </span>
            )}
            {canClose && (
              <button
                className={cn(
                  "rounded p-0.5 hover:bg-destructive/20",
                  !isActive && "opacity-0 group-hover:opacity-100",
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  closeViewTab(tab.id)
                }}
                title="Close tab"
                aria-label="Close tab"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )
      })}
      <button
        className="flex shrink-0 items-center px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => openViewTab()}
        title="New tab (duplicates the current view)"
        aria-label="New tab"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
