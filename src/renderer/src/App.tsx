import { useEffect, useState } from "react"

import { ThemePicker } from "../components/ThemePicker"
import { applyTheme } from "../lib/themes"
import { useAppStore } from "../store/app.store"
import { ConfigMapsView } from "./components/ConfigMapsView"
import { DaemonSetsView } from "./components/DaemonSetsView"
import { DeploymentsView } from "./components/DeploymentsView"
import { IngressesView } from "./components/IngressesView"
import { NamespacesView } from "./components/NamespacesView"
import { NodesView } from "./components/NodesView"
import { PodsView } from "./components/PodsView"
import { ReplicaSetsView } from "./components/ReplicaSetsView"
import { SecretsView } from "./components/SecretsView"
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
  const selectedResourceType = useAppStore((s) => s.selectedResourceType)
  const themeId = useAppStore((s) => s.themeId)

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
      .catch(console.error)
    window.api.k8s.getClusterType().then(setClusterType).catch(console.error)
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <span className="flex-1 font-semibold">Innfiswindow</span>
        <ThemePicker />
        <span className="rounded border px-2 py-0.5 text-xs mr-2 ml-2">
          {clusterType}
        </span>
        {currentContext && (
          <span className="rounded border px-2 py-0.5 text-xs">
            {currentContext}
          </span>
        )}
      </div>

      {/* Body */}
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
        </div>
      </div>
    </div>
  )
}

export default App
