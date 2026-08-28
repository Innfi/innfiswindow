# Innfiswindow

A Kubernetes resource management desktop app built with Electron, React, and TypeScript.

## Overview

Innfiswindow lets you browse, inspect, and manage Kubernetes resources from a native desktop app. It reads `~/.kube/config` for cluster configuration and communicates with the API server directly — no proxy, no backend server. Managed cluster auth (EKS, AKS credential plugins) is supported natively.

## Features

### Resource browsing

The tree sidebar lists every kubeconfig context, each expanding into these groups:

- **Cluster**: Namespaces, Nodes, Events
- **Workloads**: Deployments, ReplicaSets, StatefulSets, DaemonSets, Pods, HPAs, Jobs, CronJobs
- **Configuration**: ConfigMaps, Secrets
- **Networking**: Services, Ingresses, NetworkPolicies, Endpoints
- **Auth**: ServiceAccounts, Roles, ClusterRoles, RoleBindings, ClusterRoleBindings
- **Storage**: PersistentVolumes, PersistentVolumeClaims, StorageClasses, VolumeSnapshots
- **Governance**: ResourceQuotas, LimitRanges, PodDisruptionBudgets
- **Custom Resources**: Definitions (CRDs), Browse objects — a generic browser
  for any CRD in the cluster, with the columns that CRD's own
  `additionalPrinterColumns` declare

Standalone sections below the tree cover **Helm** (Repositories, Releases) and **Alarms** (Rules, Active Alarms).

### Navigation & layout

- Multi-context tree: every context is a top-level node, so switching clusters is one click
- Context aliases — give a long ARN a short display name (pencil icon in the AppBar)
- Global search across common resource types from the AppBar
- Click any row to open a detail panel; list shows summary fields only
- Namespace filter + name filter persist across resource type switches
- Empty-state message when filtered list has no results
- Auto-refresh: lists re-fetch on a configurable interval (10s / 30s / 60s / 120s / off) with "Last refreshed" indicator and manual Refresh button
- Global footer surfaces IPC/API errors with an unread badge

### CRUD operations

- Create resources via YAML editor in BottomDrawer "New" tab (`k8s:resource:apply`)
- Edit any resource via the Monaco YAML editor, opened from the detail panel's Edit button
- Editor shows inline YAML syntax markers and a diff view against the live manifest before saving
- Delete resources with AlertDialog confirmation (Delete button in detail panel)
- Deployments additionally support rollout history and rollback to a prior revision
- Pods support `kubectl debug` (an ephemeral container, with a shell attached once it runs) and `kubectl cp` in both directions
- Every write (apply / update / delete, success or failure) is recorded to the History view

### BottomDrawer tabs

- **New resource** — YAML editor for `kubectl apply`-style creation
- **Edit resource** — Monaco YAML editor pre-filled with the live manifest, saves via IPC
- **Pod logs** — live-tailing log stream per container
- **Pod shell** — interactive exec session inside a running container (xterm.js)
- **Port forward** — forward a local port to a Pod or Service
- **Custom stream** — user-defined stream panel

### Observability & auth

- Prometheus endpoint configuration with metrics graphs in Pod detail panel
- Node and Pod metrics via the metrics API
- Events view with live watch, plus per-resource events in detail panels
- Alarm rules evaluated against cluster state, with an Active Alarms view
- EKS credential check on startup; warning banner if AWS credentials are missing or temporary

### Developer quality

- `useK8sResource<T>` shared hook encapsulates loading/error/data/reload across all views
- `useRecordHistory` hook records writes to history, sourcing the active context itself
- `resourceViews.ts` maps each `ResourceType` to its view component — one registry, no switch statements
- Shared presentational components (`ResourceListView`, `DetailPanelLayout`, `SectionHeader`, `MetaEntry`) keep views thin
- `src/renderer/src/types/k8s.ts` — all K8s TypeScript interfaces in one place
- Consistent AlertDialog for all destructive confirmations
- ESLint enforces import order and bans `eslint-disable` of `react-hooks/exhaustive-deps`
- Color palette preset switcher (5 built-in themes) with light/dark support

## Layout

```
┌──────────────────────────────────────────────────────────┐
│  AppBar: "Innfiswindow"  [⚙] [theme] [search] [ns] [name]│
│                                    [Local] [context] [✎]  │
├───────────────┬──────────────────────────────────────────┤
│  Tree View    │  Resource List / Detail                   │
│  (w-60)       │  (flex-1)                                 │
│               │                                           │
│  ▼ context-a  │  When no item selected:                   │
│    ▼ Cluster  │    Table of resources                     │
│      Namespaces│   When item selected:                    │
│      Nodes    │    Detail panel on right                  │
│    ▶ Workloads│                                           │
│  ▶ context-b  │                                           │
│  ▼ Helm       │                                           │
│  ▼ Alarms     │                                           │
├───────────────┴──────────────────────────────────────────┤
│  BottomDrawer: [New resource] [nginx/logs] [nginx/shell]  │
├──────────────────────────────────────────────────────────┤
│  GlobalFooter: context • errors [3]                       │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer         | Technology                     |
| ------------- | ------------------------------ |
| Desktop shell | Electron (electron-vite)       |
| UI framework  | React + TypeScript             |
| Styling       | Tailwind CSS v4 + shadcn/ui    |
| State         | Zustand (persisted)            |
| k8s client    | @kubernetes/client-node        |
| YAML editor   | Monaco (lazy-loaded) + js-yaml |
| Terminal      | xterm.js over WebSocket        |
| Charts        | Recharts + prometheus-query    |
| Toasts        | sonner                         |
| Build         | electron-vite + Vite           |
| Tests         | Vitest (unit/IPC) + Playwright |

## Project Structure

```
innfiswindow/
├── src/
│   ├── main/
│   │   ├── index.ts                 # App entry, BrowserWindow setup, IPC registration
│   │   ├── handlers/                # k8s API logic, split by domain
│   │   │   ├── workload.ts          #   deployments, pods, statefulsets, daemonsets…
│   │   │   ├── networking.ts        #   services, ingresses, netpols, endpoints
│   │   │   ├── config.ts            #   configmaps, secrets
│   │   │   ├── rbac.ts              #   roles, bindings, serviceaccounts
│   │   │   ├── storage.ts           #   pvs, pvcs, storageclasses, snapshots
│   │   │   ├── governance.ts        #   quotas, limitranges, pdbs
│   │   │   ├── autoscaling.ts       #   hpas
│   │   │   ├── batch.ts             #   jobs, cronjobs
│   │   │   ├── cluster.ts           #   contexts, namespaces, nodes
│   │   │   ├── apply.ts             #   apply / replace arbitrary manifests
│   │   │   ├── events.ts, metrics.ts, helm.ts, alarm.ts
│   │   ├── ipc/                     # ipcMain.handle registration per domain
│   │   │   ├── context-clients.ts   #   per-context KubeConfig client cache
│   │   │   ├── pod-streams.ts       #   log tail + exec stream plumbing
│   │   │   ├── pod-copy.ts          #   kubectl cp (tar over the exec channel)
│   │   │   ├── dialog.ts            #   native file/folder picker
│   │   │   ├── portforward.ts, socket-stream.ts
│   │   │   └── …                    #   one module per handler domain
│   │   ├── k8s-handlers.ts          # Barrel re-exporting handlers/*
│   │   ├── aws-handlers.ts          # EKS credential check
│   │   ├── prometheus-handlers.ts   # Prometheus metrics fetch
│   │   └── __tests__/               # IPC handler integration tests
│   ├── preload/
│   │   ├── index.ts                 # contextBridge — exposes window.api
│   │   └── index.d.ts               # Type declarations for window.api
│   └── renderer/
│       ├── index.html
│       ├── assets/main.css          # Tailwind entry
│       ├── components/
│       │   ├── ThemePicker.tsx
│       │   └── ui/                  # shadcn/ui + shared presentational components
│       │       ├── TreeView.tsx, ResourceListView.tsx, DetailPanelLayout.tsx
│       │       ├── GlobalSearch.tsx, GlobalFooter.tsx, RefreshBar.tsx
│       │       └── Button.tsx, Dialog.tsx, AlertDialog.tsx, Table.tsx, …
│       ├── lib/
│       │   ├── utils.ts             # cn(), filterResources(), formatAge()
│       │   ├── ipc-error.ts         # handleIpcError() helper
│       │   ├── themes.ts            # palette presets + applyTheme()
│       │   ├── yaml.ts, resource-gvk.ts, monaco-setup.ts
│       ├── store/
│       │   └── app.store.ts         # Zustand store (selection, context, theme, tabs, history, alarms)
│       └── src/
│           ├── App.tsx, main.tsx
│           ├── resourceViews.ts     # ResourceType → view component registry
│           ├── hooks/
│           │   ├── useK8sResource.ts    # Shared data-fetching hook
│           │   ├── useRecordHistory.ts  # Shared write-history recorder
│           │   └── useColorScheme.ts
│           ├── types/
│           │   ├── k8s.ts               # All K8s* TypeScript interfaces
│           │   └── resource.ts          # ResourceType union
│           └── components/
│               ├── BottomDrawer.tsx, YamlEditPanel.tsx, YamlMonacoEditor.tsx
│               ├── PodLogPanel.tsx, ShellPanel.tsx, PortForwardPanel.tsx
│               ├── OverviewView.tsx, HistoryView.tsx, AlarmsView.tsx, HelmView.tsx
│               ├── PodsView.tsx, DeploymentsView.tsx, … (one View per resource type)
│               ├── PodMetricsSection.tsx, ResourceEventsSection.tsx, ContainerCard.tsx
│               └── PrometheusSettings.tsx, AwsCredentialBanner.tsx
├── e2e/                             # Playwright config + smoke tests
├── scripts/                         # kind setup/teardown + fixture manifests
├── docs/                            # Architecture notes
├── CLAUDE.md                        # Agent workflow and conventions
├── requirements.md                  # Product requirements
├── components.json                  # shadcn/ui config
├── electron.vite.config.ts
├── electron-builder.yml
├── vitest.config.ts
└── package.json
```

## IPC Pattern

All Kubernetes API calls run in the **main process** only. The renderer communicates via `window.api`:

```
renderer → window.api.k8s.someHandler(args)
              ↓ contextBridge
preload   → ipcRenderer.invoke('k8s:resource:action', args)
              ↓ IPC
main      → ipcMain.handle('k8s:resource:action', handler)
              ↓ @kubernetes/client-node
k8s API
```

IPC channels follow the naming convention `<domain>:<resource>:<action>`, e.g. `k8s:pods:list`, `k8s:deployment:rollback`, `k8s:resource:apply`, `helm:release:install`, `aws:credentials:check`.

Handlers accept an optional `contextName`; `src/main/ipc/context-clients.ts` caches one client per kubeconfig context so multi-cluster views don't re-authenticate on every call.

## Data Fetching

All resource views use the `useK8sResource<T>` hook:

```ts
const { data, loading, error, reload } = useK8sResource(
  (ctx) => window.api.k8s.listDeployments({ contextName: ctx }),
  selectedContext,
)
```

The hook manages loading/error state, re-fetches on context change, and exposes `reload()` for manual refresh and post-delete list updates.

## Recording Writes

Mutating actions record to the History view through `useRecordHistory`, which splits _what_ was written from _how it went_ and supplies the active context itself:

```ts
const recordHistory = useRecordHistory()

const target = {
  action: "delete",
  resourceKind: "Pod",
  resourceName: pod.name,
  namespace: pod.namespace,
} as const

try {
  await window.api.k8s.deletePod(pod.namespace, pod.name)
  recordHistory(target, { success: true })
} catch (e) {
  recordHistory(target, { success: false, error: String(e) })
}
```

## Development

```bash
npm install
npm run dev        # start in dev mode (hot reload)
npm run build      # typecheck + production build
npm run typecheck  # TypeScript compile check (node + web)
npm run lint       # ESLint (--fix)
npm run format     # Prettier
```

Packaging: `npm run package`, or `build:win` / `build:mac` / `build:linux` for a specific target.

## Testing

```bash
npm test           # Vitest — IPC handler integration tests (requires kind cluster)
npm run test:e2e   # Playwright UI smoke tests (requires kind cluster)
```

A `kind` cluster setup script and fixture manifests live in `scripts/`.

## Requirements

- Node.js 18+
- A valid `~/.kube/config` pointing to a reachable cluster
- For EKS/AKS: the relevant credential helper (`aws`, `kubelogin`) must be on `PATH`

## License

[MIT](LICENSE)
