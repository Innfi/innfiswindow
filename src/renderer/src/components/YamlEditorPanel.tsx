import { useEffect, useState } from "react"
import Editor from "@monaco-editor/react"
import { load as yamlLoad } from "js-yaml"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog"
import { Button } from "../../components/ui/button"

interface YamlEditorPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialYaml: string
  title?: string
  onApplied: () => void
}

export function YamlEditorPanel({
  open,
  onOpenChange,
  initialYaml,
  title,
  onApplied,
}: YamlEditorPanelProps): JSX.Element {
  const [yaml, setYaml] = useState(initialYaml)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (open) {
      setYaml(initialYaml)
      setError(null)
    }
  }, [open, initialYaml])

  async function handleApply(): Promise<void> {
    // Client-side YAML validation
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
      onApplied()
      onOpenChange(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl w-full flex flex-col p-0 overflow-hidden"
        style={{ minHeight: "60vh" }}
        onClose={() => onOpenChange(false)}
      >
        <div className="p-6 pb-3">
          <DialogHeader>
            <DialogTitle>{title ?? "YAML Editor"}</DialogTitle>
          </DialogHeader>
        </div>
        <div className="flex-1 min-h-0 border-t border-b" style={{ height: "55vh" }}>
          <Editor
            height="55vh"
            language="yaml"
            value={yaml}
            onChange={(v) => setYaml(v ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
            }}
          />
        </div>
        <div className="p-6 pt-3 space-y-3">
          {error && (
            <p className="text-sm text-red-500 font-mono whitespace-pre-wrap">{error}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={applying}
            >
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? "Applying…" : "Apply"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
