import { load as yamlLoad } from "js-yaml"
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/Button"
import { CustomStreamPanel } from "../../components/ui/CustomStreamPanel"
import { normalizeIpcError } from "../../lib/ipc-error"
import { cn } from "../../lib/utils"
import type { DrawerTab } from "../../store/app.store"
import { useAppStore } from "../../store/app.store"
import { useRecordHistory } from "../hooks/useRecordHistory"
import type { DryRunResult } from "../types/k8s"
import { PodLogPanel } from "./PodLogPanel"
import { PortForwardPanel } from "./PortForwardPanel"
import { ShellPanel } from "./ShellPanel"
import { YamlEditPanel } from "./YamlEditPanel"

const TABBAR_HEIGHT = 32
const DEFAULT_DRAWER_HEIGHT = Math.round(window.innerHeight * 0.4)
const MIN_DRAWER_HEIGHT = 120

const YAML_SKELETON = `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-resource
  namespace: default
spec: {}
`

const PREVIEW_MAX_HEIGHT = 200

/** On an update, the diff is the answer. On a create there is nothing to diff
 *  against, so show the server's rendering instead — that's still worth seeing,
 *  since defaulting and mutating webhooks have already run on it. */
function DryRunPreview({ preview }: { preview: DryRunResult }): JSX.Element {
  const isDiff = preview.action === "update" && preview.diff !== ""
  const body = isDiff ? preview.diff : preview.rendered

  return (
    <div
      className="overflow-auto border-t bg-muted/50 px-3 py-2 font-mono text-xs shrink-0"
      style={{ maxHeight: PREVIEW_MAX_HEIGHT }}
    >
      {preview.action === "update" && preview.diff === "" ? (
        <p className="italic text-muted-foreground">
          No changes — the live object already matches this manifest.
        </p>
      ) : (
        body.split("\n").map((line, idx) => (
          <div
            key={idx}
            className={cn(
              "whitespace-pre",
              isDiff && line.startsWith("+") && "text-emerald-600",
              isDiff && line.startsWith("-") && "text-destructive",
              isDiff && line.startsWith("@@") && "text-muted-foreground",
            )}
          >
            {line || " "}
          </div>
        ))
      )}
    </div>
  )
}

function NewResourcePanel({ onClose }: { onClose: () => void }): JSX.Element {
  const [yaml, setYaml] = useState(YAML_SKELETON)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<DryRunResult | null>(null)
  const recordHistory = useRecordHistory()

  // The preview describes the YAML as it was at dry-run time, so editing after
  // previewing has to invalidate it — otherwise Apply would write something the
  // user never saw a preview of.
  function editYaml(next: string): void {
    setYaml(next)
    setPreview(null)
  }

  async function handlePreview(): Promise<void> {
    try {
      yamlLoad(yaml)
    } catch (e) {
      setError(`YAML syntax error: ${String(e)}`)
      return
    }
    setPreviewing(true)
    setError(null)
    try {
      setPreview(await window.api.k8s.dryRunResource(yaml))
    } catch (e) {
      const msg = normalizeIpcError(e)
      setPreview(null)
      setError(msg)
      toast.error(`Preview failed: ${msg}`)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleApply(): Promise<void> {
    let parsed: unknown
    try {
      parsed = yamlLoad(yaml)
    } catch (e) {
      setError(`YAML syntax error: ${String(e)}`)
      return
    }
    const meta = parsed as {
      kind?: string
      metadata?: { name?: string; namespace?: string }
    } | null
    const target = {
      action: "apply",
      resourceKind: meta?.kind ?? "Resource",
      resourceName: meta?.metadata?.name ?? "",
      namespace: meta?.metadata?.namespace ?? null,
      yamlSnapshot: yaml,
    } as const
    setApplying(true)
    setError(null)
    try {
      await window.api.k8s.applyResource(yaml)
      recordHistory(target, { success: true })
      toast.success("Resource applied successfully")
      onClose()
    } catch (e) {
      const msg = String(e)
      recordHistory(target, { success: false, error: msg })
      setError(msg)
      toast.error(`Apply failed: ${msg}`)
      useAppStore.getState().addGlobalError(msg, "Apply")
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <textarea
        value={yaml}
        onChange={(e) => editYaml(e.target.value)}
        className="flex-1 resize-none p-3 font-mono text-sm bg-muted text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        spellCheck={false}
      />
      {preview && <DryRunPreview preview={preview} />}
      {error && (
        <p className="text-xs text-destructive font-mono whitespace-pre-wrap px-3 py-1.5 border-t border-border bg-destructive/5">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-xs px-2"
          onClick={handleApply}
          disabled={applying || previewing}
        >
          {applying ? "Applying…" : "Apply"}
        </Button>
        <Button
          size="sm"
          variant={preview ? "secondary" : "outline"}
          className="h-6 gap-1 text-xs px-2"
          onClick={handlePreview}
          disabled={applying || previewing}
        >
          {previewing ? "Checking…" : "Preview"}
        </Button>
        {preview && (
          <span className="text-xs text-muted-foreground">
            Dry run: would {preview.action} {preview.kind}/{preview.name}
            {preview.namespace ? ` in ${preview.namespace}` : ""}
          </span>
        )}
      </div>
    </div>
  )
}

function tabLabel(tab: DrawerTab): string {
  switch (tab.type) {
    case "pod-log":
      return tab.podName
    case "pod-shell":
      return `${tab.podName} / ${tab.containerName}`
    case "yaml-edit":
      return `${tab.resourceKind}/${tab.resourceName}`
    case "custom-stream":
      return tab.label
    case "port-forward":
      return `pf:${tab.resourceName}:${tab.localPort}`
    default:
      return `New ${tab.resourceKind}`
  }
}

export function BottomDrawer(): JSX.Element {
  const drawerTabs = useAppStore((s) => s.drawerTabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const closeDrawerTab = useAppStore((s) => s.closeDrawerTab)
  const setActiveDrawerTab = useAppStore((s) => s.setActiveDrawerTab)
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)

  const [height, setHeight] = useState(DEFAULT_DRAWER_HEIGHT)
  const [collapsed, setCollapsed] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const dragStartHeight = useRef<number>(DEFAULT_DRAWER_HEIGHT)

  const isOpen = drawerTabs.length > 0

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragStartY.current = e.clientY
      dragStartHeight.current = height
      e.preventDefault()
    },
    [height],
  )

  useEffect(() => {
    function onMouseMove(e: MouseEvent): void {
      if (dragStartY.current === null) return
      const delta = dragStartY.current - e.clientY
      const newHeight = Math.max(
        MIN_DRAWER_HEIGHT,
        dragStartHeight.current + delta,
      )
      setHeight(newHeight)
      if (collapsed && newHeight > MIN_DRAWER_HEIGHT) {
        setCollapsed(false)
      }
    }
    function onMouseUp(): void {
      dragStartY.current = null
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  }, [collapsed])

  // Auto-expand when new tab opens
  useEffect(() => {
    if (isOpen) setCollapsed(false)
  }, [isOpen])

  if (!isOpen) {
    return (
      <div
        className="shrink-0 border-t bg-background flex items-center px-2 gap-2"
        style={{ height: TABBAR_HEIGHT }}
      >
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-xs px-2"
          onClick={() =>
            openDrawerTab({
              tabKey: "new-resource:Resource",
              type: "new-resource",
              resourceKind: "Resource",
            })
          }
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>
    )
  }

  const contentHeight = collapsed ? 0 : height

  return (
    <div
      className="shrink-0 border-t bg-background flex flex-col"
      style={{ height: (collapsed ? 0 : contentHeight) + TABBAR_HEIGHT }}
    >
      {/* Resize handle */}
      {!collapsed && (
        <div
          className="h-1 cursor-ns-resize bg-border hover:bg-primary/40 shrink-0"
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Tab bar */}
      <div
        className="flex items-center border-b shrink-0 overflow-x-auto"
        style={{ height: TABBAR_HEIGHT }}
      >
        {/* New resource button */}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-xs px-2 shrink-0"
          onClick={() =>
            openDrawerTab({
              tabKey: "new-resource:Resource",
              type: "new-resource",
              resourceKind: "Resource",
            })
          }
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>

        {/* Tabs */}
        {drawerTabs.map((tab) => {
          const label = tabLabel(tab)
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              className={`flex items-center gap-1 px-2 h-full border-r cursor-pointer text-xs shrink-0 max-w-[180px] ${
                isActive
                  ? "bg-background border-b-2 border-b-primary text-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setActiveDrawerTab(tab.id)}
            >
              <span className="truncate">{label}</span>
              <button
                className="ml-1 rounded hover:bg-destructive/20 p-0.5"
                onClick={(e) => {
                  e.stopPropagation()
                  if (tab.type === "custom-stream") {
                    window.api.stopSocketStream(tab.id)
                  }
                  if (tab.type === "port-forward") {
                    window.api.stopPortForward(tab.id)
                  }
                  closeDrawerTab(tab.id)
                }}
                title="Close tab"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}

        <div className="flex-1" />

        {/* Collapse toggle */}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 shrink-0"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Panel content */}
      {!collapsed && (
        <div className="flex-1 min-h-0">
          {drawerTabs.map((tab) => (
            <div
              key={tab.id}
              className="w-full h-full"
              style={{ display: tab.id === activeTabId ? "block" : "none" }}
            >
              {tab.type === "pod-log" && (
                <PodLogPanel
                  tabKey={tab.id}
                  namespace={tab.namespace}
                  podName={tab.podName}
                  containers={tab.containers}
                  restored={tab.restored}
                />
              )}
              {tab.type === "new-resource" && (
                <NewResourcePanel onClose={() => closeDrawerTab(tab.id)} />
              )}
              {tab.type === "pod-shell" && (
                <ShellPanel
                  sessionId={tab.sessionId}
                  namespace={tab.namespace}
                  podName={tab.podName}
                  containerName={tab.containerName}
                  restored={tab.restored}
                />
              )}
              {tab.type === "yaml-edit" && (
                <YamlEditPanel
                  tab={tab}
                  onClose={() => closeDrawerTab(tab.id)}
                />
              )}
              {tab.type === "custom-stream" && (
                <CustomStreamPanel
                  sessionId={tab.id}
                  socketPath={tab.socketPath}
                  label={tab.label}
                />
              )}
              {tab.type === "port-forward" && (
                <PortForwardPanel
                  sessionId={tab.id}
                  resourceKind={tab.resourceKind}
                  resourceName={tab.resourceName}
                  namespace={tab.namespace}
                  defaultLocalPort={tab.localPort}
                  defaultTargetPort={tab.targetPort}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
