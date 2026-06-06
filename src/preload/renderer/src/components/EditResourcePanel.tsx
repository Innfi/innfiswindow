import { load as yamlLoad } from "js-yaml"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import { DrawerTab, useAppStore } from "../../store/app.store"

type EditResourceTab = Extract<DrawerTab, { type: "edit-resource" }>

interface EditResourcePanelProps {
  tab: EditResourceTab
  onClose: () => void
}

export function EditResourcePanel({
  tab,
  onClose,
}: EditResourcePanelProps): JSX.Element {
  const [yaml, setYaml] = useState(tab.initialYaml)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const appendHistory = useAppStore((s) => s.appendHistory)

  async function handleSave(): Promise<void> {
    let parsed: unknown
    try {
      parsed = yamlLoad(yaml)
    } catch (e) {
      setError(`YAML syntax error: ${String(e)}`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (tab.resourceKind === "Role") {
        if (!Array.isArray(parsed)) {
          setError("Rules must be a YAML array")
          setSaving(false)
          return
        }
        await window.api.k8s.updateRole(
          tab.namespace!,
          tab.resourceName,
          parsed as Array<{
            apiGroups: string[]
            resources: string[]
            verbs: string[]
          }>,
        )
      } else if (tab.resourceKind === "ClusterRole") {
        if (!Array.isArray(parsed)) {
          setError("Rules must be a YAML array")
          setSaving(false)
          return
        }
        await window.api.k8s.updateClusterRole(
          tab.resourceName,
          parsed as Array<{
            apiGroups: string[]
            resources: string[]
            verbs: string[]
          }>,
        )
      } else if (tab.resourceKind === "RoleBinding") {
        if (!Array.isArray(parsed)) {
          setError("Subjects must be a YAML array")
          setSaving(false)
          return
        }
        await window.api.k8s.updateRoleBinding(
          tab.namespace!,
          tab.resourceName,
          parsed as Array<{ kind: string; name: string; namespace?: string }>,
        )
      } else if (tab.resourceKind === "ClusterRoleBinding") {
        if (!Array.isArray(parsed)) {
          setError("Subjects must be a YAML array")
          setSaving(false)
          return
        }
        await window.api.k8s.updateClusterRoleBinding(
          tab.resourceName,
          parsed as Array<{ kind: string; name: string; namespace?: string }>,
        )
      } else if (tab.resourceKind === "ServiceAccount") {
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          setError("Metadata must be a YAML object")
          setSaving(false)
          return
        }
        await window.api.k8s.updateServiceAccount(
          tab.namespace!,
          tab.resourceName,
          parsed as {
            labels?: Record<string, string>
            annotations?: Record<string, string>
          },
        )
      }
      appendHistory({
        action: "update",
        resourceKind: tab.resourceKind,
        resourceName: tab.resourceName,
        namespace: tab.namespace ?? null,
        context: selectedContext ?? "",
        success: true,
        yamlSnapshot: yaml,
      })
      toast.success(`${tab.resourceKind}/${tab.resourceName} saved`)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      appendHistory({
        action: "update",
        resourceKind: tab.resourceKind,
        resourceName: tab.resourceName,
        namespace: tab.namespace ?? null,
        context: selectedContext ?? "",
        success: false,
        error: msg,
        yamlSnapshot: yaml,
      })
      toast.error(`Failed to save: ${msg}`)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {tab.roleRef && (
        <div className="px-3 py-2 border-b text-xs text-muted-foreground shrink-0">
          <span className="font-medium">Role Ref (read-only):</span>{" "}
          {tab.roleRef.kind}/{tab.roleRef.name}
        </div>
      )}
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
