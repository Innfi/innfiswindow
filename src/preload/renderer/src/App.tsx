import { Settings } from "lucide-react"
import { useEffect, useState } from "react"

import { ThemePicker } from "../components/ThemePicker"
import { Toaster } from "../components/ui/sonner"
import { handleIpcError } from "../lib/ipc-error"
import { applyTheme } from "../lib/themes"
import { useAppStore } from "../store/app.store"
import { AwsCredentialBanner } from "./components/AwsCredentialBanner"
import { BottomDrawer } from "./components/BottomDrawer"
import { ClusterRoleBindingsView } from "./components/ClusterRoleBindingsView"
import { ClusterRolesView } from "./components/ClusterRolesView"
import { ConfigMapsView } from "./components/ConfigMapsView"
import { CustomStreamView } from "./components/CustomStreamView"
import { DaemonSetsView } from "./components/DaemonSetsView"
import { DeploymentsView } from "./components/DeploymentsView"
import { EventsView } from "./components/EventsView"
import { HPAsView } from "./components/HPAsView"
import { IngressesView } from "./components/IngressesView"
import { NamespacesView } from "./components/NamespacesView"
import { NodesView } from "./components/NodesView"
import { OverviewView } from "./components/OverviewView"
import { PodsView } from "./components/PodsView"
import { PrometheusSettings } from "./components/PrometheusSettings"
import { ReplicaSetsView } from "./components/ReplicaSetsView"
import { RoleBindingsView } from "./components/RoleBindingsView"
import { RolesView } from "./components/RolesView"
import { SecretsView } from "./components/SecretsView"
import { ServiceAccountsView } from "./components/ServiceAccountsView"
import { ServicesView } from "./components/ServicesView"
import { StatefulSetsView } from "./components/StatefulSetsView"
import { TreeView } from "./components/TreeView"

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [awsCredResult, setAwsCredResult] = useState<{
    valid: boolean
    type: "env" | "file" | "metadata" | "none"
    hasSessionToken?: boolean
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
          {(selectedContext ?? currentContext) && (
            <span className="rounded border px-2 py-0.5 text-xs">
              {selectedContext ?? currentContext}
            </span>
          )}
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
              {selectedResourceType === "overview" && <OverviewView />}
              {selectedResourceType === "custom-stream" && <CustomStreamView />}
            </div>
          </div>

          {/* Unified tabbed bottom drawer */}
          <BottomDrawer />
        </div>
      </div>
      <PrometheusSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Toaster position="bottom-right" duration={5000} />
    </>
  )
}

export default App
