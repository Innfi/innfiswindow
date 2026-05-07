# Innfiswindow

A Kubernetes resource management desktop app built with Electron, React, and TypeScript.

## Overview

Innfiswindow lets you browse, inspect, and manage Kubernetes resources from a native desktop app. It reads `~/.kube/config` for cluster configuration and communicates with the API server directly — no proxy, no backend server. Managed cluster auth (EKS, AKS credential plugins) is supported natively.

## Features

### Resource browsing
- **Cluster**: Namespaces, Nodes
- **Workloads**: Pods, Deployments, ReplicaSets, StatefulSets, DaemonSets
- **Networking**: Services, Ingresses
- **Config**: ConfigMaps, Secrets
- **Access Control**: ServiceAccounts, Roles, ClusterRoles, RoleBindings, ClusterRoleBindings
- **Events**: live-tailing Kubernetes events

### Navigation & layout
- Tree sidebar groups resources by category (Cluster / Workloads / Networking / Config / Access Control)
- Click any row to open a detail panel; list shows summary fields only
- Namespace filter + name filter persist across resource type switches
- Multi-cluster support: switch kubeconfig contexts from the AppBar
- Empty-state message when filtered list has no results
- Auto-refresh: lists re-fetch on a configurable interval (10s / 30s / 60s / 120s / off) with "Last refreshed" indicator and manual Refresh button

### CRUD operations
- Create resources via YAML editor in BottomDrawer "New" tab
- Edit resources via YAML editor in BottomDrawer "Edit" tab (opened from detail panel)
- Delete resources with AlertDialog confirmation (Delete button in detail panel)
- Supported for full CRUD: Deployments, StatefulSets, DaemonSets, Services, Ingresses, ConfigMaps, Secrets
- Supported for delete: Pods, Roles, ClusterRoles, RoleBindings, ClusterRoleBindings, ServiceAccounts
- RBAC edit (Roles, ClusterRoles, RoleBindings, ClusterRoleBindings, ServiceAccounts) patches specific fields via dedicated BottomDrawer tab

### BottomDrawer tabs
- **New resource** — YAML editor for `kubectl apply`-style creation
- **Edit resource** — YAML editor pre-filled with current resource YAML, saves via IPC
- **Pod logs** — live-tailing log stream per container
- **Pod shell** — interactive exec session inside a running container

### Observability & auth
- Prometheus endpoint configuration with metrics graphs in Pod detail panel
- EKS credential check on startup; warning banner if AWS credentials are missing or temporary

### Developer quality
- `useK8sResource<T>` shared hook encapsulates loading/error/data/reload across all views
- Shared `src/types/k8s.ts` — all K8s TypeScript interfaces in one place
- Consistent AlertDialog for all destructive confirmations
- ESLint enforces import order and bans `eslint-disable` of `react-hooks/exhaustive-deps`
- Color palette preset switcher (5 built-in themes)

## Layout

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
│    Deployments                                   │
│    Pods      │                                   │
└──────────────┴──────────────────────────────────┘
│  BottomDrawer: [New resource] [nginx/logs] …     │
└──────────────────────────────────────────────────┘
```

## Tech Stack

| Layer         | Technology                  |
| ------------- | --------------------------- |
| Desktop shell | Electron (electron-vite)    |
| UI framework  | React + TypeScript          |
| Styling       | Tailwind CSS v4 + shadcn/ui |
| State         | Zustand                     |
| k8s client    | @kubernetes/client-node     |
| Build         | electron-vite + Vite        |

## Project Structure

```
innfiswindow/
├── src/
│   ├── main/
│   │   ├── index.ts                 # App entry, BrowserWindow setup, IPC registration
│   │   ├── k8s-handlers.ts          # k8s API functions (list, create, update, delete)
│   │   ├── aws-handlers.ts          # EKS credential check
│   │   └── prometheus-handlers.ts   # Prometheus metrics fetch
│   └── preload/
│       ├── index.ts                 # contextBridge — exposes window.api
│       ├── index.d.ts               # Type declarations for window.api
│       └── renderer/
│           ├── lib/
│           │   ├── utils.ts         # cn(), filterResources(), formatAge()
│           │   └── ipc-error.ts     # handleIpcError() helper
│           ├── store/
│           │   └── app.store.ts     # Zustand store (selected item, context, theme, drawer tabs)
│           └── src/
│               ├── App.tsx
│               ├── main.tsx
│               ├── hooks/
│               │   └── useK8sResource.ts  # Shared data-fetching hook
│               ├── types/
│               │   └── k8s.ts             # All K8s* TypeScript interfaces
│               └── components/
│                   ├── TreeView.tsx
│                   ├── BottomDrawer.tsx
│                   ├── EmptyState.tsx
│                   ├── RefreshBar.tsx
│                   ├── YamlEditorPanel.tsx
│                   ├── YamlEditPanel.tsx
│                   ├── EditResourcePanel.tsx
│                   ├── PodLogPanel.tsx
│                   ├── ShellPanel.tsx
│                   ├── PodMetricsSection.tsx
│                   ├── PrometheusSettings.tsx
│                   ├── AwsCredentialBanner.tsx
│                   ├── NamespacesView.tsx
│                   ├── NodesView.tsx
│                   ├── PodsView.tsx
│                   ├── DeploymentsView.tsx
│                   ├── ReplicaSetsView.tsx
│                   ├── StatefulSetsView.tsx
│                   ├── DaemonSetsView.tsx
│                   ├── ServicesView.tsx
│                   ├── IngressesView.tsx
│                   ├── ConfigMapsView.tsx
│                   ├── SecretsView.tsx
│                   ├── ServiceAccountsView.tsx
│                   ├── RolesView.tsx
│                   ├── ClusterRolesView.tsx
│                   ├── RoleBindingsView.tsx
│                   ├── ClusterRoleBindingsView.tsx
│                   └── EventsView.tsx
├── CLAUDE.md                        # Agent workflow and conventions
├── prd.json                         # Story backlog
├── components.json                  # shadcn/ui config
├── electron.vite.config.ts
├── package.json
└── tsconfig.json
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

IPC channels follow the naming convention `k8s:<resource>:<action>`, e.g. `k8s:pods:list`, `k8s:deployment:create`, `k8s:resource:apply`.

## Data Fetching

All resource views use the `useK8sResource<T>` hook:

```ts
const { data, loading, error, reload } = useK8sResource(
  (ctx) => window.api.k8s.listDeployments({ contextName: ctx }),
  selectedContext
)
```

The hook manages loading/error state, re-fetches on context change, and exposes `reload()` for manual refresh and post-delete list updates.

## Development

```bash
npm install
npm run dev        # start in dev mode (hot reload)
npm run build      # production build
npm run typecheck  # TypeScript compile check
npm run lint       # ESLint
```

## Testing

```bash
npm test           # IPC handler integration tests (requires kind cluster)
npm run test:e2e   # Playwright UI smoke tests (requires kind cluster)
```

A `kind` cluster setup script and fixture manifests live in `scripts/`.

## Requirements

- Node.js 18+
- A valid `~/.kube/config` pointing to a reachable cluster
- For EKS/AKS: the relevant credential helper (`aws`, `kubelogin`) must be on `PATH`

## License

[MIT](LICENSE)
