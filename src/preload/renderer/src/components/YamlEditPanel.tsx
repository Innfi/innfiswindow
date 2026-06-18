import { diffLines } from "diff"
import { dump as yamlDump, load as yamlLoad } from "js-yaml"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import { DrawerTab, useAppStore } from "../../store/app.store"

type YamlEditTab = Extract<DrawerTab, { type: "yaml-edit" }>

interface YamlEditPanelProps {
  tab: YamlEditTab
  onClose: () => void
}

export function YamlEditPanel({
  tab,
  onClose,
}: YamlEditPanelProps): JSX.Element {
  const [yaml, setYaml] = useState(tab.initialYaml)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const appendHistory = useAppStore((s) => s.appendHistory)

  const hasChanges = yaml !== tab.initialYaml

  async function handleSave(): Promise<void> {
    let parsed: unknown
    try {
      parsed = yamlLoad(yaml)
    } catch (e) {
      setError(`YAML syntax error: ${String(e)}`)
      return
    }
    const yamlStr = yamlDump(parsed)
    setSaving(true)
    setError(null)
    try {
      // FIXME: too much if/else
      if (tab.resourceKind === "Deployment") {
        await window.api.k8s.updateDeployment(
          tab.namespace,
          tab.resourceName,
          yamlStr,
        )
      } else if (tab.resourceKind === "Service") {
        await window.api.k8s.updateService(
          tab.namespace,
          tab.resourceName,
          yamlStr,
        )
      } else if (tab.resourceKind === "Ingress") {
        await window.api.k8s.updateIngress(
          tab.namespace,
          tab.resourceName,
          yamlStr,
        )
      } else if (tab.resourceKind === "DaemonSet") {
        await window.api.k8s.updateDaemonSet(
          tab.namespace,
          tab.resourceName,
          yamlStr,
        )
      } else if (tab.resourceKind === "StatefulSet") {
        await window.api.k8s.updateStatefulSet(
          tab.namespace,
          tab.resourceName,
          yamlStr,
        )
      } else if (tab.resourceKind === "ConfigMap") {
        await window.api.k8s.updateConfigMap(
          tab.namespace,
          tab.resourceName,
          yamlStr,
        )
      } else if (tab.resourceKind === "Secret") {
        await window.api.k8s.updateSecret(
          tab.namespace,
          tab.resourceName,
          yamlStr,
        )
      }
      appendHistory({
        action: "update",
        resourceKind: tab.resourceKind,
        resourceName: tab.resourceName,
        namespace: tab.namespace,
        context: selectedContext ?? "",
        success: true,
        yamlSnapshot: yamlStr,
      })
      toast.success(`${tab.resourceKind}/${tab.resourceName} saved`)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      appendHistory({
        action: "update",
        resourceKind: tab.resourceKind,
        resourceName: tab.resourceName,
        namespace: tab.namespace,
        context: selectedContext ?? "",
        success: false,
        error: msg,
        yamlSnapshot: yamlStr,
      })
      toast.error(`Failed to save: ${msg}`)
      useAppStore.getState().addGlobalError(msg, "YamlEdit: save")
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const diffParts = showDiff ? diffLines(tab.initialYaml, yaml) : []

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {showDiff ? (
        <div className="flex-1 overflow-auto p-3 font-mono text-sm bg-muted">
          {!hasChanges ? (
            <p className="text-muted-foreground italic">No changes</p>
          ) : (
            diffParts.map((part, i) => {
              const lines = part.value.replace(/\n$/, "").split("\n")
              return lines.map((line, j) => (
                <div
                  key={`${i}-${j}`}
                  className={
                    part.added
                      ? "bg-green-500/20 text-green-700 dark:text-green-300"
                      : part.removed
                        ? "bg-red-500/20 text-red-700 dark:text-red-300"
                        : "text-foreground"
                  }
                >
                  <span className="select-none mr-1 text-muted-foreground">
                    {part.added ? "+" : part.removed ? "-" : " "}
                  </span>
                  {line}
                </div>
              ))
            })
          )}
        </div>
      ) : (
        <textarea
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          className="flex-1 resize-none p-3 font-mono text-sm bg-muted text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          spellCheck={false}
        />
      )}
      {error && (
        <p className="text-xs text-destructive font-mono whitespace-pre-wrap px-3 py-1.5 border-t border-border bg-destructive/5">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t shrink-0">
        <Button
          size="sm"
          variant="default"
          className="h-6 gap-1 text-xs px-2"
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant={showDiff ? "secondary" : "outline"}
          className="h-6 gap-1 text-xs px-2"
          onClick={() => setShowDiff((v) => !v)}
          disabled={saving}
        >
          {showDiff ? "Hide diff" : "Show diff"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-xs px-2"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
