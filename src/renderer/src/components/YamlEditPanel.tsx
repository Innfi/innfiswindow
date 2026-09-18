import { load as yamlLoad, YAMLException } from "js-yaml"
import type { editor } from "monaco-editor"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Monaco } from "@monaco-editor/react"

import { isEditConflictMessage } from "../../../shared/edit-conflict"
import { Button } from "../../components/ui/Button"
import { DryRunDiff } from "../../components/ui/DryRunDiff"
import { normalizeIpcError } from "../../lib/ipc-error"
import { type ResourceGvk, resourceGvk } from "../../lib/resource-gvk"
import { cn } from "../../lib/utils"
import { dumpYaml } from "../../lib/yaml"
import { DrawerTab, useAppStore } from "../../store/app.store"
import { useColorScheme } from "../hooks/useColorScheme"
import { useRecordHistory } from "../hooks/useRecordHistory"
import type { DryRunResult } from "../types/k8s"

// Monaco is ~6 MB; keep it out of the startup chunk.
const YamlMonacoEditor = lazy(() => import("./YamlMonacoEditor"))

type YamlEditTab = Extract<DrawerTab, { type: "yaml-edit" }>

/** The live manifest as editor text, with the resourceVersion it was read at:
 *  Review and Save both send that version, so a write someone else makes in
 *  the meantime refuses the save instead of being overwritten by it. */
async function readLive(
  resourceKind: YamlEditTab["resourceKind"],
  gvk: ResourceGvk | undefined,
  name: string,
  namespace: string,
): Promise<{ text: string; resourceVersion?: string }> {
  const { apiVersion, kind } = resourceGvk(resourceKind, gvk)
  const { manifest, resourceVersion } = await window.api.k8s.readResource(
    apiVersion,
    kind,
    name,
    namespace || undefined,
  )
  return { text: dumpYaml(manifest), resourceVersion }
}

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
  // The resourceVersion `baseline` was read at; undefined until the live read
  // lands (or if the server sent none), which leaves the save unconditional.
  const [baseVersion, setBaseVersion] = useState<string | undefined>()
  // Set once the server refuses a review or save because the object changed
  // since `baseVersion`. Every further attempt would be refused the same way,
  // so the only ways on are a reload or a review against the newer version.
  const [conflict, setConflict] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [checking, setChecking] = useState(false)
  const [review, setReview] = useState<{
    yaml: string
    result: DryRunResult
  } | null>(null)
  const recordHistory = useRecordHistory()
  const colorScheme = useColorScheme()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  // Bumped on every editor mount so markers are reapplied to a fresh model.
  const [editorMounted, setEditorMounted] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    readLive(tab.resourceKind, tab.gvk, tab.resourceName, tab.namespace)
      .then(({ text, resourceVersion }) => {
        if (cancelled) return
        setYaml(text)
        setBaseline(text)
        setBaseVersion(resourceVersion)
        setConflict(false)
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
  }, [tab.resourceKind, tab.gvk, tab.resourceName, tab.namespace])

  const hasChanges = yaml !== baseline
  // A review describes the YAML as it was when the dry run ran; once the text
  // moves on it no longer says what Save would write, so it stops counting.
  const activeReview = review && review.yaml === yaml ? review.result : null

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

  /** Parses and re-serialises the editor text, so the dry run and the save send
   *  byte-identical manifests. Null (with the error shown) if it won't parse. */
  function manifestToSend(): string | null {
    try {
      return dumpYaml(yamlLoad(yaml))
    } catch (e) {
      setError(`YAML syntax error: ${String(e)}`)
      return null
    }
  }

  const conflictText = `${tab.resourceKind}/${tab.resourceName} was changed on the server after this editor loaded it, so nothing was written. Reload to start over from the live object, or review your edits against it — that review shows the other change being reverted, and saving then overwrites it.`

  function showConflict(): void {
    setReview(null)
    setConflict(true)
    setError(conflictText)
  }

  // Save is a PUT, so the preview has to be a dry-run PUT too: it runs the
  // server's defaulting, admission and validation, and diffs against the object
  // as it is live now. It carries `version` just as the save will, so a change
  // made since the editor opened is refused here rather than hidden in the diff
  // as a revert.
  async function runReview(version: string | undefined): Promise<void> {
    const yamlStr = manifestToSend()
    if (yamlStr === null) return
    setChecking(true)
    setError(null)
    try {
      const result = await window.api.k8s.dryRunReplaceResource(
        yamlStr,
        version,
      )
      setReview({ yaml, result })
      setShowDiff(false)
    } catch (e) {
      const msg = normalizeIpcError(e)
      if (isEditConflictMessage(msg)) {
        showConflict()
        toast.error(
          `${tab.resourceKind}/${tab.resourceName} changed on the server`,
        )
        return
      }
      setReview(null)
      setError(`Dry run failed: ${msg}`)
      toast.error(`Dry run failed: ${msg}`)
    } finally {
      setChecking(false)
    }
  }

  /** Discards the edits and starts over from the object as it is now. */
  async function handleReload(): Promise<void> {
    setLoading(true)
    try {
      const { text, resourceVersion } = await readLive(
        tab.resourceKind,
        tab.gvk,
        tab.resourceName,
        tab.namespace,
      )
      setYaml(text)
      setBaseline(text)
      setBaseVersion(resourceVersion)
      setConflict(false)
      setReview(null)
      setError(null)
    } catch (e) {
      setError(`Failed to load live manifest: ${normalizeIpcError(e)}`)
    } finally {
      setLoading(false)
    }
  }

  /** Keeps the edits but takes the newer version as the base, then reviews:
   *  the diff is against the object as it is now, so whatever the other writer
   *  changed shows up as something this save would revert. */
  async function handleReviewAgainstLatest(): Promise<void> {
    setChecking(true)
    let version: string | undefined
    try {
      const live = await readLive(
        tab.resourceKind,
        tab.gvk,
        tab.resourceName,
        tab.namespace,
      )
      version = live.resourceVersion
      setBaseline(live.text)
      setBaseVersion(version)
      setConflict(false)
    } catch (e) {
      setError(`Failed to load live manifest: ${normalizeIpcError(e)}`)
      return
    } finally {
      // runReview raises it again itself, and may return before it does.
      setChecking(false)
    }
    await runReview(version)
  }

  async function handleSave(): Promise<void> {
    const yamlStr = manifestToSend()
    if (yamlStr === null) return
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
      await window.api.k8s.replaceResource(yamlStr, baseVersion)
      recordHistory(target, { success: true })
      toast.success(`${tab.resourceKind}/${tab.resourceName} saved`)
      onClose()
    } catch (e) {
      const msg = normalizeIpcError(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(`Failed to save: ${msg}`)
      useAppStore.getState().addGlobalError(msg, "YamlEdit: save")
      // Someone wrote the object between the review and the confirm.
      if (isEditConflictMessage(msg)) showConflict()
      else setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const theme = colorScheme === "dark" ? "vs-dark" : "vs"

  const noOpReview = activeReview !== null && activeReview.diff === ""

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {activeReview && (
        <DryRunDiff preview={activeReview} className="flex-1 min-h-0" />
      )}
      {/* Hidden rather than unmounted during review, so the editor keeps its
          undo stack for a "Back to editor". */}
      <div
        className={cn("flex-1 min-h-0 flex flex-col", activeReview && "hidden")}
      >
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
      </div>
      {error && (
        <p className="text-xs text-destructive font-mono whitespace-pre-wrap px-3 py-1.5 border-t border-border bg-destructive/5">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t shrink-0">
        {conflict ? (
          <>
            <Button
              size="sm"
              variant="default"
              className="h-6 gap-1 text-xs px-2"
              onClick={handleReviewAgainstLatest}
              disabled={checking || loading}
            >
              {checking ? "Checking…" : "Review against latest"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 gap-1 text-xs px-2"
              onClick={handleReload}
              disabled={checking || loading}
            >
              Reload (discard edits)
            </Button>
          </>
        ) : activeReview ? (
          <>
            <Button
              size="sm"
              variant="default"
              className="h-6 gap-1 text-xs px-2"
              onClick={handleSave}
              disabled={saving || noOpReview}
            >
              {saving ? "Saving…" : "Confirm save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 gap-1 text-xs px-2"
              onClick={() => setReview(null)}
              disabled={saving}
            >
              Back to editor
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="default"
              className="h-6 gap-1 text-xs px-2"
              onClick={() => void runReview(baseVersion)}
              disabled={checking || loading || !hasChanges}
            >
              {checking ? "Checking…" : "Review & save"}
            </Button>
            <Button
              size="sm"
              variant={showDiff ? "secondary" : "outline"}
              className="h-6 gap-1 text-xs px-2"
              onClick={() => setShowDiff((v) => !v)}
              disabled={checking || loading}
            >
              {showDiff ? "Hide diff" : "Show diff"}
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-xs px-2"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        {activeReview && (
          <span className="text-xs text-muted-foreground truncate">
            {noOpReview
              ? "Dry run: the server would leave the live object unchanged"
              : "Dry run: changes to the live object as it is now, after defaulting and admission"}
          </span>
        )}
      </div>
    </div>
  )
}
