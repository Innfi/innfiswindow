import { load as yamlLoad } from "js-yaml"
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import { useAppStore } from "../../store/app.store"
import { CustomStreamPanel } from "./CustomStreamPanel"
import { EditResourcePanel } from "./EditResourcePanel"
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

function NewResourcePanel({ onClose }: { onClose: () => void }): JSX.Element {
  const [yaml, setYaml] = useState(YAML_SKELETON)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  async function handleApply(): Promise<void> {
    try {
      yamlLoad(yaml)
    } catch (e) {
      setError(`YAML syntax error: ${String(e)}`)
      return
    }
    setApplying(true)
    setError(null)
    try {
      await window.api.k8s.applyResource(yaml)
      toast.success("Resource applied successfully")
      onClose()
    } catch (e) {
      const msg = String(e)
      setError(msg)
      toast.error(`Apply failed: ${msg}`)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <textarea
        value={yaml}
        onChange={(e) => setYaml(e.target.value)}
        className="flex-1 resize-none p-3 font-mono text-sm bg-muted text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        spellCheck={false}
      />
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
          disabled={applying}
        >
          {applying ? "Applying…" : "Apply"}
        </Button>
      </div>
    </div>
  )
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
          const label =
            tab.type === "pod-log"
              ? tab.podName
              : tab.type === "pod-shell"
                ? `${tab.podName} / ${tab.containerName}`
                : tab.type === "edit-resource"
                  ? `${tab.resourceKind}/${tab.resourceName}`
                  : tab.type === "yaml-edit"
                    ? `${tab.resourceKind}/${tab.resourceName}`
                    : tab.type === "custom-stream"
                      ? tab.label
                      : tab.type === "port-forward"
                        ? `pf:${tab.resourceName}:${tab.localPort}`
                        : `New ${tab.resourceKind}`
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
              {tab.type === "edit-resource" && (
                <EditResourcePanel
                  tab={tab}
                  onClose={() => closeDrawerTab(tab.id)}
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
