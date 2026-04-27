import { dump as yamlDump, load as yamlLoad } from "js-yaml"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import { DrawerTab } from "../../store/app.store"

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
      }
      toast.success(`${tab.resourceKind}/${tab.resourceName} saved`)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(`Failed to save: ${msg}`)
      setError(msg)
    } finally {
      setSaving(false)
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
          variant="default"
          className="h-6 gap-1 text-xs px-2"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
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
