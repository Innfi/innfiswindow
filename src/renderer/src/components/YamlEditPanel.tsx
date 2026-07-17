import { load as yamlLoad, YAMLException } from "js-yaml"
import type { editor } from "monaco-editor"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Monaco } from "@monaco-editor/react"

import { Button } from "../../components/ui/Button"
import { resourceGvk } from "../../lib/resource-gvk"
import { dumpYaml } from "../../lib/yaml"
import { DrawerTab, useAppStore } from "../../store/app.store"
import { useColorScheme } from "../hooks/useColorScheme"
import { useRecordHistory } from "../hooks/useRecordHistory"

// Monaco is ~6 MB; keep it out of the startup chunk.
const YamlMonacoEditor = lazy(() => import("./YamlMonacoEditor"))

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
  const [baseline, setBaseline] = useState(tab.initialYaml)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const recordHistory = useRecordHistory()
  const colorScheme = useColorScheme()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  // Bumped on every editor mount so markers are reapplied to a fresh model.
  const [editorMounted, setEditorMounted] = useState(0)

  useEffect(() => {
    let cancelled = false
    const { apiVersion, kind } = resourceGvk(tab.resourceKind)
    setLoading(true)
    window.api.k8s
      .readResource(
        apiVersion,
        kind,
        tab.resourceName,
        tab.namespace || undefined,
      )
      .then((obj) => {
        if (cancelled) return
        const text = dumpYaml(obj)
        setYaml(text)
        setBaseline(text)
        setError(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(`Failed to load live manifest: ${msg}`)
        useAppStore.getState().addGlobalError(msg, "YamlEdit: load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab.resourceKind, tab.resourceName, tab.namespace])

  const hasChanges = yaml !== baseline

  // Mark YAML syntax errors inline instead of only on save.
  useEffect(() => {
    const monaco = monacoRef.current
    const model = editorRef.current?.getModel()
    if (!monaco || !model) return
    try {
      yamlLoad(yaml)
      monaco.editor.setModelMarkers(model, "yaml", [])
    } catch (e) {
      const mark = e instanceof YAMLException ? e.mark : undefined
      const line = (mark?.line ?? 0) + 1
      const column = (mark?.column ?? 0) + 1
      monaco.editor.setModelMarkers(model, "yaml", [
        {
          severity: monaco.MarkerSeverity.Error,
          message: e instanceof Error ? e.message : String(e),
          startLineNumber: line,
          startColumn: column,
          endLineNumber: line,
          endColumn: column + 1,
        },
      ])
    }
  }, [yaml, editorMounted])

  async function handleSave(): Promise<void> {
    let parsed: unknown
    try {
      parsed = yamlLoad(yaml)
    } catch (e) {
      setError(`YAML syntax error: ${String(e)}`)
      return
    }
    const yamlStr = dumpYaml(parsed)
    const target = {
      action: "update",
      resourceKind: tab.resourceKind,
      resourceName: tab.resourceName,
      namespace: tab.namespace,
      yamlSnapshot: yamlStr,
    } as const
    setSaving(true)
    setError(null)
    try {
      await window.api.k8s.replaceResource(yamlStr)
      recordHistory(target, { success: true })
      toast.success(`${tab.resourceKind}/${tab.resourceName} saved`)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(`Failed to save: ${msg}`)
      useAppStore.getState().addGlobalError(msg, "YamlEdit: save")
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const theme = colorScheme === "dark" ? "vs-dark" : "vs"

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {showDiff && !hasChanges ? (
        <div className="flex-1 overflow-auto p-3 font-mono text-sm bg-muted">
          <p className="text-muted-foreground italic">No changes</p>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex-1 grid place-items-center text-xs text-muted-foreground">
              Loading editor…
            </div>
          }
        >
          <YamlMonacoEditor
            value={loading ? "" : yaml}
            original={showDiff ? baseline : undefined}
            readOnly={loading}
            theme={theme}
            onChange={setYaml}
            onMount={(editorInstance, monaco) => {
              editorRef.current = editorInstance
              monacoRef.current = monaco
              setEditorMounted((v) => v + 1)
            }}
          />
        </Suspense>
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
          disabled={saving || loading || !hasChanges}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant={showDiff ? "secondary" : "outline"}
          className="h-6 gap-1 text-xs px-2"
          onClick={() => setShowDiff((v) => !v)}
          disabled={saving || loading}
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
