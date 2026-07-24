import { Pencil, Settings } from "lucide-react"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"

import { ThemePicker } from "../components/ThemePicker"
import { Button } from "../components/ui/Button"
import { GlobalFooter } from "../components/ui/GlobalFooter"
import { GlobalSearch } from "../components/ui/GlobalSearch"
import { Input } from "../components/ui/Input"
import { NameFilterInput } from "../components/ui/NameFilterInput"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/Popover"
import { Toaster } from "../components/ui/Toaster"
import { TreeView } from "../components/ui/TreeView"
import { handleIpcError } from "../lib/ipc-error"
import { applyTheme } from "../lib/themes"
import { useAppStore } from "../store/app.store"
import { AwsCredentialBanner } from "./components/AwsCredentialBanner"
import { BottomDrawer } from "./components/BottomDrawer"
import { PrometheusSettings } from "./components/PrometheusSettings"
import { useColorScheme } from "./hooks/useColorScheme"
import { resourceViews } from "./resourceViews"

function App(): JSX.Element {
  const [currentContext, setCurrentContext] = useState<string>("")
  const [clusterType, setClusterType] = useState<"EKS" | "AKS" | "Local">(
    "Local",
  )
  const colorScheme = useColorScheme()
  const [namespaces, setNamespaces] = useState<string[]>([])
  const selectedResourceType = useAppStore((s) => s.selectedResourceType)
  const themeId = useAppStore((s) => s.themeId)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const setSelectedNamespace = useAppStore((s) => s.setSelectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
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
  const [connection, setConnection] = useState<{
    connected: boolean
    reason?: "network" | "auth" | "unknown"
    error?: string
  } | null>(null)
  const [reconnecting, setReconnecting] = useState(false)

  const runAwsCredCheck = useCallback((): void => {
    window.api
      .checkAwsCredentials()
      .then(setAwsCredResult)
      .catch(() => setAwsCredResult({ valid: false, type: "none" }))
  }, [])

  // Probe the cluster; if the connection dropped, auto-attempt a reconnect
  // (which re-runs the exec credential plugin) before reporting it lost.
  const runConnectionCheck = useCallback(async (): Promise<void> => {
    const ctx = { contextName: selectedContext ?? undefined }
    try {
      let status = await window.api.k8s.checkConnection(ctx)
      if (!status.connected) {
        status = await window.api.k8s.reconnect(ctx)
      }
      setConnection(status)
    } catch (e) {
      setConnection({ connected: false, reason: "unknown", error: String(e) })
    }
  }, [selectedContext])

  const handleReconnect = useCallback(async (): Promise<void> => {
    setReconnecting(true)
    try {
      const status = await window.api.k8s.reconnect({
        contextName: selectedContext ?? undefined,
      })
      setConnection(status)
      runAwsCredCheck()
    } catch (e) {
      setConnection({ connected: false, reason: "unknown", error: String(e) })
    } finally {
      setReconnecting(false)
    }
  }, [selectedContext, runAwsCredCheck])

  // Periodically re-check credentials (cheap, local) and the live connection.
  // Re-runs whenever the selected context changes.
  useEffect(() => {
    runAwsCredCheck()
    runConnectionCheck()
    const id = window.setInterval(() => {
      runAwsCredCheck()
      runConnectionCheck()
    }, 30000)
    return () => window.clearInterval(id)
  }, [runAwsCredCheck, runConnectionCheck])

  // Apply theme on mount and whenever themeId or colorScheme changes
  useEffect(() => {
    applyTheme(themeId, colorScheme)
  }, [themeId, colorScheme])

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

  const ResourceView = selectedResourceType
    ? resourceViews[selectedResourceType]
    : undefined

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
          <NameFilterInput />
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

        {/* AWS credential / cluster connection banner */}
        <AwsCredentialBanner
          result={awsCredResult}
          connection={connection}
          reconnecting={reconnecting}
          onRecheck={runAwsCredCheck}
          onReconnect={handleReconnect}
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
              {ResourceView && (
                <Suspense
                  fallback={
                    <p className="p-4 text-sm text-muted-foreground">
                      Loading...
                    </p>
                  }
                >
                  <ResourceView />
                </Suspense>
              )}
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
