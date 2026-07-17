# CLAUDE.md - k8s management tool

## Your role

You are a coding agent working on innfiswindow, a Kubernetes management desktop app. The app is scaffolded and functional — you are maintaining and extending an existing codebase, not bootstrapping one.

See `README.md` for the feature set and project structure, and `requirements.md` for product requirements.

## Workflow

1. Read the task. If it touches a resource view, read a sibling view first — they share a strong shape, and matching it matters more than inventing a better one.
2. Implement it. Do not leave acceptance criteria half-done.
3. If you add npm packages, add them to `package.json`, then run `npm install` before building.
4. Verify: `npm run typecheck && npm run lint`. Both must pass clean.
5. Commit only when asked.

## Project conventions

- **Language**: TypeScript everywhere (main process, preload, renderer).
- **Stack**: electron-vite + React + Tailwind CSS v4 + shadcn/ui + Zustand + @kubernetes/client-node.
- **Component style**: functional components with hooks only. No class components.
- **Do not** add backend servers, proxies, or HTTP layers — use Electron IPC exclusively.

### File layout

- `src/main/` — Electron main process
  - `src/main/handlers/` — k8s API logic, one module per domain (`workload`, `networking`, `config`, `rbac`, `storage`, `governance`, `autoscaling`, `batch`, `cluster`, `apply`, `events`, `metrics`, `helm`, `alarm`)
  - `src/main/ipc/` — `ipcMain.handle` registration, one module per domain
  - `src/main/k8s-handlers.ts` — barrel re-exporting `handlers/*`; add new domains here
- `src/preload/` — contextBridge (`index.ts`) + `window.api` type declarations (`index.d.ts`)
- `src/renderer/` — React app
  - `src/renderer/components/ui/` — shadcn/ui files and shared presentational components
  - `src/renderer/lib/` — `utils.ts` (`cn`, `filterResources`, `formatAge`), `themes.ts`, `yaml.ts`, `ipc-error.ts`, `resource-gvk.ts`
  - `src/renderer/store/app.store.ts` — Zustand store
  - `src/renderer/src/` — app code: `App.tsx`, `resourceViews.ts`, `components/`, `hooks/`, `types/`

Note the split: `src/renderer/src/` holds app code, while `src/renderer/{components,lib,store}/` sit one level up. Match the import depth of the file you're editing rather than guessing.

### Reuse before writing

Check these before adding anything:

- `useK8sResource<T>` (`src/renderer/src/hooks/`) — loading/error/data/reload for every list view. Do not hand-roll fetch state.
- `useRecordHistory` — records writes to the History view. Takes a `target` (what was written) and a `result` (`{ success, error? }`); it supplies the active context itself. Never call `appendHistory` directly from a component.
- `ResourceListView`, `DetailPanelLayout`, `SectionHeader`, `MetaEntry`, `AlertDialog` (`components/ui/`) — views are thin compositions of these.
- `src/renderer/src/types/k8s.ts` — all `K8s*` interfaces live here, not next to the view.

### Adding a resource type

1. Add the `K8s*` interface to `src/renderer/src/types/k8s.ts`.
2. Add handler(s) to the right `src/main/handlers/<domain>.ts`, register IPC in `src/main/ipc/<domain>.ts`.
3. Expose it in `src/preload/index.ts` + `index.d.ts`.
4. Add the type to `RESOURCE_TYPES` in `src/renderer/src/types/resource.ts`.
5. Write the view in `src/renderer/src/components/<Name>View.tsx`, modeled on a sibling.
6. Register it in `src/renderer/src/resourceViews.ts` and add it to a tree group in `components/ui/TreeView.tsx`.

### Lint rules that will fail you

- `simple-import-sort` — node builtins, external, `src/`, relative. Run `npm run lint` (it auto-fixes).
- `eslint-comments/no-restricted-disable` — you may **not** `eslint-disable` `react-hooks/exhaustive-deps`. Fix the dependency array or restructure with `useCallback`.

## Tailwind CSS v4 setup

- Plugin is wired in `electron.vite.config.ts` renderer config: `plugins: [tailwindcss(), react()]`
- Entry CSS (`src/renderer/assets/main.css`): first line is `@import 'tailwindcss';`
- No `tailwind.config.js` — Tailwind v4 is config-file-free by default.
- Theme palettes are CSS variables driven by `src/renderer/lib/themes.ts`; use semantic classes (`bg-background`, `text-muted-foreground`) so presets and dark mode keep working.

## shadcn/ui setup

- Do NOT run `npx shadcn init` — it misdetects electron-vite project structure. `components.json` already exists at the project root.
- Copy component source files directly into `src/renderer/components/ui/<Component>.tsx`.
- The `cn()` helper is at `src/renderer/lib/utils.ts` — note the import is `twMerge` from `tailwind-merge`:
  ```ts
  import { type ClassValue, clsx } from "clsx"
  import { twMerge } from "tailwind-merge"
  export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs))
  }
  ```

## IPC pattern

Renderer calls `window.api.<domain>.<handler>(args)` exposed via preload `contextBridge`. Main registers `ipcMain.handle('<domain>:<resource>:<action>', handler)` — e.g. `k8s:pods:list`, `k8s:deployment:rollback`, `helm:release:install`, `aws:credentials:check`.

```
renderer → window.api.k8s.listPods({ contextName })
preload  → ipcRenderer.invoke('k8s:pods:list', args)
main     → ipcMain.handle('k8s:pods:list', handler)
```

## k8s API notes

- Use `@kubernetes/client-node`. All k8s API calls happen in the **main process** only, never in the renderer.
- Handlers take an optional `contextName`. Get clients from `src/main/ipc/context-clients.ts`, which caches one client per kubeconfig context — do not call `loadFromDefault()` in a handler.
- Serialize only plain data (no class instances) before sending over IPC. Map API objects into the `K8s*` shapes from `types/k8s.ts`.
- Exec credential plugins (for EKS/AKS) are supported natively — do not disable them.

## Layout reference

```
┌──────────────────────────────────────────────────────────┐
│  AppBar: "Innfiswindow"  [⚙] [theme] [search] [ns] [name]│
│                                    [Local] [context] [✎] │
├───────────────┬──────────────────────────────────────────┤
│  Tree View    │  Resource List / Detail                  │
│  (w-60)       │  (flex-1)                                │
│               │                                          │
│  ▼ context-a  │  When no item selected:                  │
│    ▼ Cluster  │    Table of resources                    │
│    ▶ Workloads│  When item selected:                     │
│  ▶ context-b  │    Detail panel on right                 │
│  ▼ Helm       │                                          │
│  ▼ Alarms     │                                          │
├───────────────┴──────────────────────────────────────────┤
│  BottomDrawer: [New resource] [nginx/logs] […]           │
├──────────────────────────────────────────────────────────┤
│  GlobalFooter: context • errors [3]                      │
└──────────────────────────────────────────────────────────┘
```

## Commands

```bash
npm run dev        # hot-reload dev mode
npm run build      # typecheck + production build
npm run typecheck  # node + web
npm run lint       # ESLint (--fix)
npm test           # Vitest IPC integration tests (requires kind cluster)
npm run test:e2e   # Playwright smoke tests (requires kind cluster)
```

`scripts/` holds the `kind` setup/teardown scripts and fixture manifests.
