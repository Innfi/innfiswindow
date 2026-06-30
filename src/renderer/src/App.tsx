import { Pencil, Settings } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { ThemePicker } from "../components/ThemePicker"
import { Button } from "../components/ui/button"
import { CustomStreamView } from "../components/ui/CustomStreamView"
import { GlobalFooter } from "../components/ui/GlobalFooter"
import { GlobalSearch } from "../components/ui/GlobalSearch"
import { Input } from "../components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover"
import { Toaster } from "../components/ui/sonner"
import { handleIpcError } from "../lib/ipc-error"
import { applyTheme } from "../lib/themes"
import { useAppStore } from "../store/app.store"
import { AlarmActiveView, AlarmRulesView } from "./components/AlarmsView"
import { AwsCredentialBanner } from "./components/AwsCredentialBanner"
import { BottomDrawer } from "./components/BottomDrawer"
import { ClusterRoleBindingsView } from "./components/ClusterRoleBindingsView"
import { ClusterRolesView } from "./components/ClusterRolesView"
import { ConfigMapsView } from "./components/ConfigMapsView"
import { CronJobsView } from "./components/CronJobsView"
import { DaemonSetsView } from "./components/DaemonSetsView"
import { DeploymentsView } from "./components/DeploymentsView"
import { EndpointsView } from "./components/EndpointsView"
import { EventsView } from "./components/EventsView"
import { HelmReleasesView, HelmRepositoriesView } from "./components/HelmView"
import { HistoryView } from "./components/HistoryView"
import { HPAsView } from "./components/HPAsView"
import { IngressesView } from "./components/IngressesView"
import { JobsView } from "./components/JobsView"
import { LimitRangesView } from "./components/LimitRangesView"
import { NamespacesView } from "./components/NamespacesView"
import { NetworkPoliciesView } from "./components/NetworkPoliciesView"
import { NodesView } from "./components/NodesView"
import { OverviewView } from "./components/OverviewView"
import { PDBsView } from "./components/PDBsView"
import { PodsView } from "./components/PodsView"
import { PrometheusSettings } from "./components/PrometheusSettings"
import { PVCsView } from "./components/PVCsView"
import { PVsView } from "./components/PVsView"
import { ReplicaSetsView } from "./components/ReplicaSetsView"
import { ResourceQuotasView } from "./components/ResourceQuotasView"
import { RoleBindingsView } from "./components/RoleBindingsView"
import { RolesView } from "./components/RolesView"
import { SecretsView } from "./components/SecretsView"
import { ServiceAccountsView } from "./components/ServiceAccountsView"
import { ServicesView } from "./components/ServicesView"
import { StatefulSetsView } from "./components/StatefulSetsView"
import { StorageClassesView } from "./components/StorageClassesView"
import { TreeView } from "./components/TreeView"
import { VolumeSnapshotsView } from "./components/VolumeSnapshotsView"

function getColorScheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function App(): JSX.Element {
  const [currentContext, setCurrentContext] = useState<string>("")
  const [clusterType, setClusterType] = useState<"EKS" | "AKS" | "Local">(
    "Local",
  )
  const [colorScheme, setColorScheme] = useState<"light" | "dark">(
    getColorScheme,
  )
  const [namespaces, setNamespaces] = useState<string[]>([])
  const selectedResourceType = useAppStore((s) => s.selectedResourceType)
  const themeId = useAppStore((s) => s.themeId)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const setSelectedNamespace = useAppStore((s) => s.setSelectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const setNameFilter = useAppStore((s) => s.setNameFilter)
  const contextAliases = useAppStore((s) => s.contextAliases)
  const setContextAlias = useAppStore((s) => s.setContextAlias)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aliasPopoverOpen, setAliasPopoverOpen] = useState(false)
  const [aliasInput, setAliasInput] = useState("")
  const aliasInputRef = useRef<HTMLInputElement>(null)
  const [awsCredResult, setAwsCredResult] = useState<{
    valid: boolean
    type: "env" | "file" | "sso-cache" | "metadata" | "none"
    hasSessionToken?: boolean
    expiresAt?: string
    ssoSession?: string
  } | null>(null)

  const runAwsCredCheck = (): void => {
    window.api
      .checkAwsCredentials()
      .then(setAwsCredResult)
      .catch(() => setAwsCredResult({ valid: false, type: "none" }))
  }

  useEffect(() => {
    runAwsCredCheck()
  }, [])

  // Apply theme on mount and whenever themeId or colorScheme changes
  useEffect(() => {
    applyTheme(themeId, colorScheme)
  }, [themeId, colorScheme])

  // Listen for OS color scheme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent): void => {
      setColorScheme(e.matches ? "dark" : "light")
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    window.api.k8s
      .getCurrentContext()
      .then(setCurrentContext)
      .catch((err) => handleIpcError(err, "kubeconfig"))
    window.api.k8s
      .getClusterType()
      .then(setClusterType)
      .catch((err) => handleIpcError(err, "cluster type"))
  }, [])

  useEffect(() => {
    const activeContext = selectedContext ?? currentContext
    if (!activeContext) return
    setNameFilter("")
    window.api.k8s
      .listNamespaces({ contextName: selectedContext ?? undefined })
      .then((nsList) => setNamespaces(nsList.map((n) => n.name)))
      .catch((err) => handleIpcError(err, "namespaces"))
  }, [currentContext, selectedContext])

  return (
    <>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center border-b px-4">
          <span className="flex-1 font-semibold">Innfiswindow</span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded p-1 hover:bg-muted mr-1"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <ThemePicker />
          <GlobalSearch />
          <select
            value={selectedNamespace ?? ""}
            onChange={(e) => setSelectedNamespace(e.target.value || null)}
            className="rounded border px-2 py-0.5 text-xs mr-2 ml-2 bg-background text-foreground"
          >
            <option value="">All Namespaces</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Filter by name..."
            className="rounded border px-2 py-0.5 text-xs mr-2 bg-background text-foreground w-40"
          />
          <span className="rounded border px-2 py-0.5 text-xs mr-2 ml-2">
            {clusterType}
          </span>
          {(selectedContext ?? currentContext) &&
            (() => {
              const rawCtx = selectedContext ?? currentContext
              const alias = contextAliases[rawCtx]
              return (
                <div className="flex items-center gap-1">
                  <span
                    className="rounded border px-2 py-0.5 text-xs"
                    title={alias ? rawCtx : undefined}
                  >
                    {alias ?? rawCtx}
                  </span>
                  <Popover
                    open={aliasPopoverOpen}
                    onOpenChange={(open) => {
                      setAliasPopoverOpen(open)
                      if (open) {
                        setAliasInput(contextAliases[rawCtx] ?? "")
                        setTimeout(() => aliasInputRef.current?.focus(), 50)
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        className="rounded p-0.5 hover:bg-muted"
                        aria-label="Edit context alias"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64">
                      <p className="text-xs font-semibold mb-1">
                        Context alias
                      </p>
                      <p className="text-xs text-muted-foreground mb-2 break-all">
                        {rawCtx}
                      </p>
                      <Input
                        ref={aliasInputRef}
                        value={aliasInput}
                        onChange={(e) => setAliasInput(e.target.value)}
                        placeholder="Short display name…"
                        maxLength={64}
                        className="mb-2 h-7 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setContextAlias(rawCtx, aliasInput)
                            setAliasPopoverOpen(false)
                          } else if (e.key === "Escape") {
                            setAliasPopoverOpen(false)
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-6 text-xs flex-1"
                          onClick={() => {
                            setContextAlias(rawCtx, aliasInput)
                            setAliasPopoverOpen(false)
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs flex-1"
                          onClick={() => {
                            setContextAlias(rawCtx, "")
                            setAliasPopoverOpen(false)
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )
            })()}
        </div>

        {/* AWS credential banner */}
        <AwsCredentialBanner
          result={awsCredResult}
          onRecheck={runAwsCredCheck}
        />

        {/* Body */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tree + content row */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar */}
            <div className="w-60 shrink-0 border-r h-full overflow-y-auto">
              <TreeView />
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-hidden">
              {selectedResourceType === "Namespaces" && <NamespacesView />}
              {selectedResourceType === "Nodes" && <NodesView />}
              {selectedResourceType === "Deployments" && <DeploymentsView />}
              {selectedResourceType === "ReplicaSets" && <ReplicaSetsView />}
              {selectedResourceType === "StatefulSets" && <StatefulSetsView />}
              {selectedResourceType === "DaemonSets" && <DaemonSetsView />}
              {selectedResourceType === "ConfigMaps" && <ConfigMapsView />}
              {selectedResourceType === "Secrets" && <SecretsView />}
              {selectedResourceType === "Pods" && <PodsView />}
              {selectedResourceType === "Services" && <ServicesView />}
              {selectedResourceType === "Ingresses" && <IngressesView />}
              {selectedResourceType === "NetworkPolicies" && (
                <NetworkPoliciesView />
              )}
              {selectedResourceType === "Endpoints" && <EndpointsView />}
              {selectedResourceType === "Events" && <EventsView />}
              {selectedResourceType === "HPAs" && <HPAsView />}
              {selectedResourceType === "ServiceAccounts" && (
                <ServiceAccountsView />
              )}
              {selectedResourceType === "Roles" && <RolesView />}
              {selectedResourceType === "ClusterRoles" && <ClusterRolesView />}
              {selectedResourceType === "RoleBindings" && <RoleBindingsView />}
              {selectedResourceType === "ClusterRoleBindings" && (
                <ClusterRoleBindingsView />
              )}
              {selectedResourceType === "PersistentVolumes" && <PVsView />}
              {selectedResourceType === "PersistentVolumeClaims" && (
                <PVCsView />
              )}
              {selectedResourceType === "StorageClasses" && (
                <StorageClassesView />
              )}
              {selectedResourceType === "VolumeSnapshots" && (
                <VolumeSnapshotsView />
              )}
              {selectedResourceType === "Jobs" && <JobsView />}
              {selectedResourceType === "CronJobs" && <CronJobsView />}
              {selectedResourceType === "ResourceQuotas" && (
                <ResourceQuotasView />
              )}
              {selectedResourceType === "LimitRanges" && <LimitRangesView />}
              {selectedResourceType === "PodDisruptionBudgets" && <PDBsView />}
              {selectedResourceType === "overview" && <OverviewView />}
              {selectedResourceType === "custom-stream" && <CustomStreamView />}
              {selectedResourceType === "history" && <HistoryView />}
              {selectedResourceType === "helm-repositories" && (
                <HelmRepositoriesView />
              )}
              {selectedResourceType === "helm-releases" && <HelmReleasesView />}
              {selectedResourceType === "alarm-rules" && <AlarmRulesView />}
              {selectedResourceType === "alarm-active" && <AlarmActiveView />}
            </div>
          </div>

          {/* Unified tabbed bottom drawer */}
          <BottomDrawer />
        </div>

        {/* Global footer */}
        <GlobalFooter />
      </div>
      <PrometheusSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Toaster position="bottom-right" duration={5000} />
    </>
  )
}

export default App
