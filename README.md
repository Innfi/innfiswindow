# Innfiswindow

A Kubernetes resource management desktop app built with Electron, React, and TypeScript.

## Overview

Innfiswindow lets you browse, inspect, and modify Kubernetes resources from a native desktop app. It reads `~/.kube/config` for cluster configuration and communicates with the API server directly — no proxy, no backend server. Managed cluster auth (EKS, AKS credential plugins) is supported natively.

## Features

- **Resource browsing** — Namespaces, Nodes, Pods, Deployments, ReplicaSets, StatefulSets, DaemonSets, Services, Ingresses, ConfigMaps, Secrets
- **Tree navigation** — left sidebar groups resources by Cluster and Workloads
- **List + Detail** — click any row to open a detail panel; list shows brief summary fields only
- **CRUD operations** — create, edit, and delete resources via form dialogs or raw YAML editor
- **YAML editor** — Monaco-powered editor with syntax highlighting and client-side validation
- **Color themes** — 5 built-in palette presets (Default, Ocean, Midnight, Slate, Cyberpunk)
- **Context switching** — switch kubeconfig contexts from the AppBar

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
│   ├── main/                        # Electron main process
│   │   ├── index.ts                 # App entry, BrowserWindow setup
│   │   └── k8s-handlers.ts          # All IPC handlers (k8s API calls)
│   ├── preload/
│   │   ├── index.ts                 # contextBridge — exposes window.api
│   │   └── index.d.ts               # Type declarations for window.api
│   └── renderer/
│       ├── assets/
│       │   └── main.css             # Tailwind entry (@import 'tailwindcss')
│       ├── components/
│       │   └── ui/                  # shadcn/ui component files
│       │       ├── button.tsx
│       │       ├── dialog.tsx
│       │       ├── input.tsx
│       │       ├── label.tsx
│       │       └── table.tsx
│       ├── lib/
│       │   └── utils.ts             # shadcn cn() helper (clsx + tailwind-merge)
│       ├── store/
│       │   └── app.store.ts         # Zustand store (selected resource, context, theme)
│       └── src/
│           ├── App.tsx              # Root layout (AppBar + TreeView + resource panel)
│           ├── main.tsx             # React entry point
│           └── components/
│               ├── TreeView.tsx
│               ├── NamespacesView.tsx
│               ├── NodesView.tsx
│               ├── PodsView.tsx
│               ├── DeploymentsView.tsx
│               ├── ReplicaSetsView.tsx
│               ├── StatefulSetsView.tsx
│               ├── DaemonSetsView.tsx
│               ├── ServicesView.tsx
│               ├── IngressesView.tsx
│               ├── ConfigMapsView.tsx
│               └── SecretsView.tsx
├── docs/
│   └── architecture-refactor-plan.md
├── CLAUDE.md                        # Agent workflow and conventions
├── prd.json                         # Story backlog
├── requirements.md                  # Original product requirements
├── components.json                  # shadcn/ui config
├── electron.vite.config.ts
├── package.json
└── tsconfig.json
```

## IPC Pattern

All Kubernetes API calls run in the **main process** only. The renderer communicates via `window.api`:

```
renderer → window.api.someHandler(args)
              ↓ contextBridge
preload   → ipcRenderer.invoke('k8s:resource:action', args)
              ↓ IPC
main      → ipcMain.handle('k8s:resource:action', handler)
              ↓ @kubernetes/client-node
k8s API
```

IPC channels follow the naming convention `k8s:<resource>:<action>`, e.g. `k8s:pod:list`, `k8s:deployment:create`, `k8s:resource:apply`.

## Development

```bash
npm install
npm run dev        # start in dev mode (hot reload)
npm run build      # production build
npm run preview    # preview production build
```

## Requirements

- Node.js 18+
- A valid `~/.kube/config` pointing to a reachable cluster
- For EKS/AKS: the relevant credential helper (`aws`, `kubelogin`) must be on `PATH`

## License

[MIT](LICENSE)
