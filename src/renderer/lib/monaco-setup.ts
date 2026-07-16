// edcore.main = editor API + all editor contributions (folding, find, diff),
// without monaco's ~80 bundled languages. Only YAML is pulled in below.
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main"
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"
import { loader } from "@monaco-editor/react"

import "monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution"

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment
  }
}

// @monaco-editor/react fetches monaco from a CDN by default, which never
// resolves in a packaged Electron app. Pin it to the bundled copy.
window.MonacoEnvironment = {
  getWorker: () => new editorWorker(),
}
loader.config({ monaco })
