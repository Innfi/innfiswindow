import type { editor } from "monaco-editor"
import Editor, { DiffEditor, OnMount } from "@monaco-editor/react"

import "../../lib/monaco-setup"

const EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: "on",
  folding: true,
  tabSize: 2,
  wordWrap: "on",
  scrollBeyondLastLine: false,
  renderWhitespace: "selection",
  automaticLayout: true,
}

interface YamlMonacoEditorProps {
  value: string
  /** When set, renders a read-only side-by-side diff against this text. */
  original?: string
  readOnly: boolean
  theme: "vs" | "vs-dark"
  onChange: (value: string) => void
  onMount: OnMount
}

export default function YamlMonacoEditor({
  value,
  original,
  readOnly,
  theme,
  onChange,
  onMount,
}: YamlMonacoEditorProps): JSX.Element {
  if (original !== undefined) {
    return (
      <DiffEditor
        original={original}
        modified={value}
        language="yaml"
        theme={theme}
        options={{ ...EDITOR_OPTIONS, readOnly: true }}
      />
    )
  }
  return (
    <Editor
      value={value}
      onChange={(v) => onChange(v ?? "")}
      language="yaml"
      theme={theme}
      options={{ ...EDITOR_OPTIONS, readOnly }}
      onMount={onMount}
    />
  )
}
