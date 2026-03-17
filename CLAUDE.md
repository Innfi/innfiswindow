# CLAUDE.md - k8s management tool

## Your role
You are an autonomous coding agent implementing the innfiswindow Kubernetes management desktop app.
Each time you are invoked, you will be given a story ID from prd.json. Implement that story completely, then mark it `"complete"` in prd.json.

## Workflow — follow exactly

1. Read `prd.json` and find the story you were given.
2. Read the story's `description` and `acceptance_criteria` carefully.
3. Check the story's `dependencies` — those stories must already be `"complete"` before you proceed.
4. Implement the story. Write all necessary files. Do not skip acceptance criteria.
5. When done, update the story's `"status"` field in `prd.json` from `"incomplete"` to `"complete"`.
6. Run `git add -A && git commit -m "feat: <story-id> <story-title>"` to commit your work.
7. Stop. Do not implement other stories.

## Project conventions

- **Language**: TypeScript everywhere (main process, preload, renderer).
- **Stack**: electron-vite + React + Tailwind CSS v4 + shadcn/ui + Zustand + @kubernetes/client-node.
- **Scaffold command** (S01 only): `npm create @quick-start/electron@latest . -- --template react-ts` (targets current directory).
- **File layout** (electron-vite convention):
  - `src/main/` — Electron main process
  - `src/preload/` — Electron preload script
  - `src/renderer/` — React app (renderer process)
  - `src/renderer/components/ui/` — shadcn/ui component files (copied manually)
  - `src/renderer/lib/utils.ts` — shadcn `cn()` helper (`clsx` + `tailwind-merge`)
- **IPC pattern**: renderer calls `window.api.<handler>(args)` exposed via preload `contextBridge`. Main process registers `ipcMain.handle('k8s:resource:action', handler)`.
- **State**: Zustand store at `src/renderer/store/app.store.ts`.
- **Component style**: functional components with hooks only. No class components.
- **Do not** add backend servers, proxies, or HTTP layers — use Electron IPC exclusively.

## Tailwind CSS v4 setup

- Install: `tailwindcss @tailwindcss/vite`
- Add plugin to `electron.vite.config.ts` renderer Vite config: `import tailwindcss from '@tailwindcss/vite'` then `plugins: [tailwindcss(), react()]`
- Entry CSS (`src/renderer/assets/main.css`): first line must be `@import 'tailwindcss';`
- No `tailwind.config.js` needed — Tailwind v4 is config-file-free by default.

## shadcn/ui setup

- Do NOT run `npx shadcn init` — it misdetects electron-vite project structure.
- Create `components.json` manually at project root (see S01 in prd.json for content).
- Copy component source files directly into `src/renderer/components/ui/<component>.tsx`.
- Always create `src/renderer/lib/utils.ts`:
  ```ts
  import { clsx, type ClassValue } from 'clsx'
  import { tailwindMerge } from 'tailwind-merge'
  export function cn(...inputs: ClassValue[]) {
    return tailwindMerge(clsx(inputs))
  }
  ```
  Note: import is `twMerge` from `tailwind-merge`, not `tailwindMerge`. Use: `import { twMerge } from 'tailwind-merge'`
- shadcn Table source: copy from https://ui.shadcn.com/docs/components/table (or write equivalent using `<table>` with the standard shadcn class structure).

## k8s API notes

- Use `@kubernetes/client-node`. Load config with `new KubeConfig(); kc.loadFromDefault()`.
- `CoreV1Api` handles: namespaces, nodes, pods.
- `AppsV1Api` handles: deployments.
- All k8s API calls happen in the **main process** only, never in the renderer.
- Serialize only plain data (no class instances) before sending over IPC.
- Exec credential plugins (for EKS/AKS) are supported natively — do not disable them.

## Layout reference

```
┌─────────────────────────────────────────────────┐
│  AppBar: "Innfiswindow"         [context] [EKS]  │
├──────────────┬──────────────────────────────────┤
│  Tree View   │  Resource List / Detail           │
│  (w-60)      │  (flex-1)                         │
│              │                                   │
│  ▼ Cluster   │  When no item selected:           │
│    Namespaces│    Table of resources             │
│    Nodes     │  When item selected:              │
│  ▼ Workloads │    Detail panel on right          │
│    Deployments│                                  │
│    Pods      │                                   │
└──────────────┴──────────────────────────────────┘
```
