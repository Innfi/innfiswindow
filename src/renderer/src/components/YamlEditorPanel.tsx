import { load as yamlLoad } from "js-yaml"
import { useEffect, useRef, useState } from "react"

import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
        style={{ height: "80vh" }}
        onClose={() => onOpenChange(false)}
      >
        <div className="p-6 pb-3 bg-card text-card-foreground border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle>{title ?? "YAML Editor"}</DialogTitle>
          </DialogHeader>
        </div>
        <div className="flex-1 min-h-0">
          <textarea
            ref={textareaRef}
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            className="w-full h-full resize-none p-4 font-mono text-sm bg-muted text-foreground border-border focus:outline-none focus:ring-1 focus:ring-ring"
            spellCheck={false}
          />
        </div>
        <div className="p-6 pt-3 space-y-3 bg-card text-card-foreground border-t border-border">
          {error && (
            <p className="text-sm text-destructive font-mono whitespace-pre-wrap">
              {error}
            </p>
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
