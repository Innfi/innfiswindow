# Architecture Refactoring Plan — innfiswindow

**Date:** 2026-04-03
**Scope:** Full audit of `src/` (main process, preload, renderer). No production code was changed in this analysis.

---

## 1. Current State

### 1.1 File Inventory

| Layer | Directory | Files | LOC |
|-------|-----------|-------|-----|
| Main process | `src/main/` | 2 | 538 |
| Preload | `src/preload/` | 2 | 306 |
| Renderer — view components | `src/renderer/src/components/` | 10 | 2,828 |
| Renderer — app root | `src/renderer/src/` | 2 | 79 |
| Renderer — store | `src/renderer/store/` | 1 | 15 |
| Renderer — lib/utils | `src/renderer/lib/` | 1 | 6 |
| Renderer — shadcn/ui | `src/renderer/components/ui/` | 5 | 233 |
| Test files | `src/main/__tests__/` | 1 | 195 |
| **Total** | `src/` | **24** (+ 2 test) | **4,005** (+ 195 test) |

> *The `src/renderer/index.html` and `src/renderer/assets/main.css` are not counted as source code.*

### 1.2 LOC per Layer (production code only)

- **Main process:** 538 LOC (`index.ts` 143 + `k8s-handlers.ts` 395)
- **Preload:** 306 LOC (`index.ts` 60 + `index.d.ts` 246)
- **Renderer:** 3,161 LOC (all files under `src/renderer/`)

### 1.3 IPC Handlers

21 handlers registered in `src/main/index.ts`, grouped as follows:

| Category | Handlers |
|----------|----------|
| Context info | `k8s:contexts:list`, `k8s:context:current`, `k8s:cluster:type` |
| List operations | `k8s:namespaces:list`, `k8s:nodes:list`, `k8s:deployments:list`, `k8s:replicasets:list`, `k8s:pods:list`, `k8s:daemonsets:list`, `k8s:statefulsets:list`, `k8s:configmaps:list`, `k8s:secrets:list` |
| Deployment CRUD | `k8s:deployment:create`, `k8s:deployment:update`, `k8s:deployment:delete` |
| StatefulSet CRUD | `k8s:statefulset:create`, `k8s:statefulset:update`, `k8s:statefulset:delete` |
| DaemonSet CRUD | `k8s:daemonset:create`, `k8s:daemonset:update`, `k8s:daemonset:delete` |

### 1.4 Zustand Store

**File:** `src/renderer/store/app.store.ts` (15 LOC, 1 slice)

| Field | Type | Notes |
|-------|------|-------|
| `selectedResourceType` | `string \| null` | Navigation selection |
| `selectedItem` | `object \| null` | **Untyped** — cast in each consumer |

Actions: `setSelectedResourceType`, `setSelectedItem`.

**Not in store** (local state in `App.tsx`): `currentContext`, `clusterType`.

### 1.5 React Components

| Component | File | LOC | Notes |
|-----------|------|-----|-------|
| `App` | `src/renderer/src/App.tsx` | 69 | Layout root |
| `TreeView` | `…/components/TreeView.tsx` | 62 | Nav sidebar |
| `NamespacesView` | `…/components/NamespacesView.tsx` | 153 | List + detail |
| `NodesView` | `…/components/NodesView.tsx` | 212 | List + detail |
| `ReplicaSetsView` | `…/components/ReplicaSetsView.tsx` | 202 | List + detail |
| `PodsView` | `…/components/PodsView.tsx` | 197 | List + detail |
| `ConfigMapsView` | `…/components/ConfigMapsView.tsx` | 177 | List + detail |
| `SecretsView` | `…/components/SecretsView.tsx` | 202 | List + detail |
| `DeploymentsView` | `…/components/DeploymentsView.tsx` | **546** | **EXCEEDS 300 LOC** |
| `StatefulSetsView` | `…/components/StatefulSetsView.tsx` | **548** | **EXCEEDS 300 LOC** |
| `DaemonSetsView` | `…/components/DaemonSetsView.tsx` | **529** | **EXCEEDS 300 LOC** |

*11 exported components, plus numerous inline helper components defined inside larger files.*

### 1.6 Files Exceeding 300 LOC

| File | LOC | Reason |
|------|-----|--------|
| `src/renderer/src/components/StatefulSetsView.tsx` | 548 | Monolithic: contains 4 nested components |
| `src/renderer/src/components/DeploymentsView.tsx` | 546 | Monolithic: contains 4 nested components |
| `src/renderer/src/components/DaemonSetsView.tsx` | 529 | Monolithic: contains 4 nested components |
| `src/main/k8s-handlers.ts` | 395 | All K8s API wrappers in one file |

---

## 2. Pain Points

### PP-1: Monolithic CRUD View Components (Critical)

`DeploymentsView.tsx` (546 LOC), `StatefulSetsView.tsx` (548 LOC), and `DaemonSetsView.tsx` (529 LOC) each define four internal sub-components — `DetailPanel`, `CreateDialog`, `EditDialog`, `DeleteDialog` — as inner functions within the same file. Nesting components as closures prevents isolated testing, makes dead-code analysis impossible, and causes the entire 500+ LOC file to re-evaluate whenever any parent state changes. The three files are also structurally ~95% identical (see PP-2).

**Affected files:** `src/renderer/src/components/DeploymentsView.tsx`, `StatefulSetsView.tsx`, `DaemonSetsView.tsx`

### PP-2: Pervasive Copy-Paste Duplication (Critical)

The following constructs appear verbatim in all three CRUD view files:

- `formatAge(dateStr: string): string` — a 15-line date-formatting function defined three times independently.
- `MetaEntry` — a small presentational component (`<div>` with label + value) defined inline in each file.
- The detail panel structure (labels section, annotations section, `creationTimestamp` row) is duplicated across `NamespacesView`, `NodesView`, `DeploymentsView`, `StatefulSetsView`, and `DaemonSetsView`.
- The `[loading, setLoading]` / `[error, setError]` / `[items, setItems]` state + `useEffect` fetch pattern is copy-pasted into every view.

Any bug in `formatAge` must be fixed in three places; any future resource view that adds CRUD will copy the pattern a fourth time.

**Affected files:** All 10 view components; most severely the three CRUD views.

### PP-3: Untyped Zustand Store `selectedItem` (High)

`app.store.ts` types `selectedItem` as `object | null`. Every consumer casts it:

```ts
// DeploymentsView.tsx
const selectedItem = useAppStore((s) => s.selectedItem) as K8sDeployment | null;
```

There is no compile-time guard preventing `selectedItem` from being cast to the wrong K8s type (e.g., casting a `K8sPod` as a `K8sDeployment`). TypeScript cannot catch this error at the call site.

**Affected files:** `src/renderer/store/app.store.ts`, all view components.

### PP-4: App-Level State Not in Store (High)

`App.tsx` manages `currentContext` (string) and `clusterType` ('EKS' | 'AKS' | 'Local') in local `useState`. These values are not accessible to any component other than `App` without prop-drilling. If a future view component needs to branch on cluster type (e.g., to hide EKS-specific features), it has no way to read that value.

**Affected file:** `src/renderer/src/App.tsx` (lines 5–9, 14–26).

### PP-5: No Error Handling Wrapper for IPC Handlers (High)

In `src/main/index.ts` all 21 `ipcMain.handle` registrations directly invoke the corresponding handler function with no surrounding try/catch or structured logging:

```ts
ipcMain.handle('k8s:deployments:list', () => listDeployments());
```

If the K8s API throws (e.g., expired credentials, unreachable cluster), the rejection propagates raw to the renderer. There is no central place to log errors, report them with context (handler name, arguments), or return a structured error envelope. Each renderer component independently handles `catch` with ad-hoc error strings.

**Affected file:** `src/main/index.ts` (lines 80–140).

### PP-6: Duplicated K8s Type Definitions (Medium)

K8s interface types (e.g., `K8sDeployment`, `K8sStatefulSet`, `K8sDaemonSet`) are defined in `src/preload/index.d.ts` and **re-declared** inside each view component file. For example, `K8sDeployment` appears in both `src/preload/index.d.ts:48` and `src/renderer/src/components/DeploymentsView.tsx:37`. If a field is added to the type in one location it must be manually added in the other.

**Affected files:** `src/preload/index.d.ts`, `DeploymentsView.tsx`, `StatefulSetsView.tsx`, `DaemonSetsView.tsx`.

### PP-7: IPC Channel Names Not Centrally Managed (Medium)

IPC channel strings (`'k8s:deployments:list'`, etc.) are string literals scattered across three files: `src/main/index.ts` (registration), `src/preload/index.ts` (bridge mapping), and `src/preload/index.d.ts` (type declarations). Renaming a channel requires edits in all three locations with no compiler assistance. A typo in any location causes a silent runtime failure.

**Affected files:** `src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`.

### PP-8: No React Error Boundaries (Medium)

There are no `ErrorBoundary` components anywhere in the renderer. An unhandled runtime error in any view component (e.g., trying to read a property of `null` from malformed K8s API data) will crash the entire React tree and show a blank white screen. This is especially problematic in an Electron app where there is no "reload page" affordance visible to the user.

**Affected directory:** `src/renderer/src/`.

### PP-9: Per-Component Data Fetching With No Caching (Medium)

Each view component calls `window.api.<resource>List()` inside a `useEffect` on mount, with no shared cache. Switching between `Deployments` and `Pods` in the tree triggers a fresh K8s API call every time. For large clusters this causes visible latency on every navigation. There is no way to invalidate or share the previously fetched list.

**Affected files:** All 10 view components.

### PP-10: Zero Renderer Unit Tests (Medium)

`src/main/__tests__/k8s-handlers.integration.test.ts` covers the main-process handler functions well. However, there are no unit or component tests for any React components, the Zustand store, the `formatAge` utility, or dialog validation logic. The `formatAge` function is duplicated three times with no tests, making it impossible to know if any copy has diverged.

**Affected directory:** `src/renderer/` (no `__tests__` directory exists).

---

## 3. Refactoring Plan

### P1 — High priority (address before adding new resource types)

#### P1-A: Extract Shared `formatAge` and `MetaEntry` Utilities

**Description:** Move the `formatAge(dateStr: string): string` function and the `MetaEntry` presentational component out of the three CRUD view files into shared modules.
**Motivation:** PP-2. Any date-formatting bug currently requires fixing in three places. The next resource view will copy them a fourth time.
**Affected files:**
- Create `src/renderer/lib/format.ts` — export `formatAge`.
- Create `src/renderer/src/components/MetaEntry.tsx` — export `MetaEntry`.
- Update `DeploymentsView.tsx`, `StatefulSetsView.tsx`, `DaemonSetsView.tsx`, `NamespacesView.tsx`, `NodesView.tsx` to import from these new modules and delete their local definitions.

**Complexity:** S

---

#### P1-B: Split Monolithic CRUD View Files into Dedicated Component Files

**Description:** Each CRUD view file (`DeploymentsView`, `StatefulSetsView`, `DaemonSetsView`) currently embeds four inner components. Extract each into its own file in a subdirectory:

```
src/renderer/src/components/deployments/
  DeploymentsView.tsx          (~120 LOC — table + orchestration only)
  DeploymentDetailPanel.tsx    (~80 LOC)
  CreateDeploymentDialog.tsx   (~100 LOC)
  EditDeploymentDialog.tsx     (~80 LOC)
  DeleteDeploymentDialog.tsx   (~50 LOC)
```

Repeat the same split for `statefulsets/` and `daemonsets/`.

**Motivation:** PP-1. Nested components cannot be tested in isolation, and the current files are at 546–548 LOC. Extracted components can be imported, mocked, and unit-tested independently.
**Affected files:** `DeploymentsView.tsx`, `StatefulSetsView.tsx`, `DaemonSetsView.tsx` — split into 5 files each (15 files total).
**Complexity:** M

---

#### P1-C: Import K8s Types from Preload Instead of Re-declaring

**Description:** Delete the local K8s type declarations inside each view component and replace with imports from `src/preload/index.d.ts` (or a dedicated shared types module — see P2-A).
**Motivation:** PP-6. Currently `K8sDeployment` is defined in two places. Removing the duplicates ensures that the preload type definition is the single source of truth.
**Affected files:** `DeploymentsView.tsx` (lines 37–49), `StatefulSetsView.tsx`, `DaemonSetsView.tsx`.
**Complexity:** S

---

#### P1-D: Add Typed `selectedItem` to Zustand Store

**Description:** Replace the `selectedItem: object | null` field with a discriminated union:

```ts
type SelectedItem =
  | { type: 'Deployment'; data: K8sDeployment }
  | { type: 'StatefulSet'; data: K8sStatefulSet }
  | { type: 'DaemonSet'; data: K8sDaemonSet }
  | { type: 'Pod'; data: K8sPod }
  // ... other resource types
  | null;
```

Consumers narrow via `if (selectedItem?.type === 'Deployment')` instead of unsafe casts.
**Motivation:** PP-3. Eliminates the `as K8sDeployment | null` casts scattered across all view components.
**Affected files:** `src/renderer/store/app.store.ts`, all 10 view components.
**Complexity:** M

---

#### P1-E: Add Centralized IPC Error Handler

**Description:** Wrap all `ipcMain.handle` registrations in `src/main/index.ts` with a logging/error-envelope wrapper:

```ts
function handle<T>(channel: string, fn: (...args: unknown[]) => Promise<T>) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      console.error(`[IPC] ${channel} failed:`, err);
      return { ok: false, error: (err as Error).message };
    }
  });
}
```

Renderer components check `result.ok` before using `result.data`.
**Motivation:** PP-5. Centralises error logging, gives renderer a structured error format, and ensures no uncaught rejection silently swallows errors.
**Affected files:** `src/main/index.ts`, `src/preload/index.d.ts` (update return types), all view components (update error handling).
**Complexity:** M

---

### P2 — Medium priority (address after P1, before adding Configuration CRUD)

#### P2-A: Create `src/shared/types.ts` for K8s Domain Types

**Description:** Move all K8s interface definitions (`K8sNamespace`, `K8sNode`, `K8sDeployment`, etc.) from `src/preload/index.d.ts` into a new `src/shared/types.ts` that is importable from both main and renderer. Update `preload/index.d.ts` to re-export from `src/shared/types.ts`.
**Motivation:** PP-6, PP-7. A single authoritative type file eliminates duplication and is the prerequisite for P2-B.
**Affected files:** `src/preload/index.d.ts`, all view components, `src/main/k8s-handlers.ts`.
**Complexity:** S

---

#### P2-B: Define IPC Channel Names as Constants

**Description:** Create `src/shared/ipc-channels.ts` exporting a const object:

```ts
export const IPC = {
  NAMESPACES_LIST: 'k8s:namespaces:list',
  DEPLOYMENTS_LIST: 'k8s:deployments:list',
  DEPLOYMENT_CREATE: 'k8s:deployment:create',
  // ... all 21 channels
} as const;
```

Import `IPC` in `src/main/index.ts`, `src/preload/index.ts`, and all renderer call sites.
**Motivation:** PP-7. Typos in channel names are now caught at compile time; renaming a channel is a single-file change.
**Affected files:** `src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`, all view components that call `window.api.*`.
**Complexity:** S

---

#### P2-C: Move `currentContext` and `clusterType` into Zustand Store

**Description:** Add `currentContext: string | null` and `clusterType: 'EKS' | 'AKS' | 'Local' | null` fields to the Zustand store. Remove `useState` from `App.tsx` for these values and populate the store on app mount.
**Motivation:** PP-4. Makes cluster metadata available to any component that may need it (e.g., to show EKS-specific help text or disable features unsupported on certain cluster types).
**Affected files:** `src/renderer/store/app.store.ts`, `src/renderer/src/App.tsx`.
**Complexity:** S

---

#### P2-D: Extract `useResourceFetch` Custom Hook

**Description:** Every view component duplicates this pattern:

```ts
const [items, setItems] = useState<T[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
useEffect(() => {
  setLoading(true);
  window.api.xyzList().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
}, []);
```

Extract this into `src/renderer/hooks/useResourceFetch.ts`:

```ts
function useResourceFetch<T>(fetcher: () => Promise<T[]>): {
  items: T[]; loading: boolean; error: string | null; refetch: () => void;
}
```

**Motivation:** PP-2, PP-9. Eliminates 12 lines of boilerplate per view (×10 = 120 lines removed). The `refetch` return value also enables manual refresh after mutations without duplicating the fetch setup.
**Affected files:** All 10 view components, new `src/renderer/hooks/useResourceFetch.ts`.
**Complexity:** S

---

#### P2-E: Add React Error Boundaries

**Description:** Create `src/renderer/src/components/ErrorBoundary.tsx` — a simple class-based error boundary (the only acceptable use of a class component in this project). Wrap the resource panel and tree view independently so a crash in one does not unmount the other.
**Motivation:** PP-8. Electron apps do not have browser reload buttons; a white screen is a dead end for users.
**Affected files:** `src/renderer/src/App.tsx` (wrap `<ResourcePanel>` and `<TreeView>`), new `ErrorBoundary.tsx`.
**Complexity:** S

---

### P3 — Lower priority (technical debt, quality of life)

#### P3-A: Add Component Unit Tests with Vitest + React Testing Library

**Description:** Add `@testing-library/react` and `jsdom` as dev dependencies. Create tests for: `formatAge` (once extracted per P1-A), `useResourceFetch` hook, `TreeView` (selection state), and the three dialog components (form validation, submit, cancel).
**Motivation:** PP-10. The formatter and dialog validation logic are currently untested despite being business-critical (a bug in replica count validation would silently pass invalid data to the K8s API).
**Affected files:** New `src/renderer/src/__tests__/` directory; `package.json` (add dev deps); `vitest.config.ts` (add jsdom environment for renderer tests).
**Complexity:** M

---

#### P3-B: Split `src/main/k8s-handlers.ts` by API Group

**Description:** `k8s-handlers.ts` (395 LOC) currently bundles all CRUD functions for all resource types. Split into:

```
src/main/handlers/
  context.ts         (listContexts, getCurrentContext, getClusterType)
  core-v1.ts         (namespaces, nodes, pods, configmaps, secrets)
  apps-v1-read.ts    (deployments list, replicasets list, statefulsets list, daemonsets list)
  apps-v1-write.ts   (deployment/statefulset/daemonset create/update/delete)
```

**Motivation:** PP-1 (main process variant). The file will grow as new resources are added. Splitting by API group makes it easy to find and test individual handlers.
**Affected files:** `src/main/k8s-handlers.ts` → 4 files; `src/main/index.ts` (update imports).
**Complexity:** S

---

#### P3-C: Add Resource List Caching in Zustand Store

**Description:** Add a `resourceCache` map to the Zustand store:

```ts
resourceCache: Partial<Record<ResourceType, { items: unknown[]; fetchedAt: number }>>
```

`useResourceFetch` checks the cache first; treats entries older than 30 seconds as stale. After any mutation, the relevant cache entry is cleared to force a fresh fetch on next navigation.
**Motivation:** PP-9. Eliminates redundant K8s API calls when toggling between two resource types and reduces latency for large clusters.
**Affected files:** `src/renderer/store/app.store.ts`, `src/renderer/hooks/useResourceFetch.ts`.
**Complexity:** M

---

## 4. Proposed Directory Layout

The following tree shows the recommended `src/` structure after all P1 and P2 refactoring is complete:

```
src/
├── shared/
│   ├── types.ts               # All K8s domain interfaces (K8sDeployment, K8sPod, …)
│   └── ipc-channels.ts        # IPC channel name constants
│
├── main/
│   ├── index.ts               # Window creation + ipcMain.handle registrations (using IPC constants)
│   └── handlers/
│       ├── context.ts         # listContexts, getCurrentContext, getClusterType
│       ├── core-v1.ts         # namespaces, nodes, pods, configmaps, secrets
│       ├── apps-v1-read.ts    # deployments/replicasets/statefulsets/daemonsets list
│       └── apps-v1-write.ts   # deployment/statefulset/daemonset create/update/delete
│
├── preload/
│   ├── index.ts               # contextBridge, imports IPC constants from shared/
│   └── index.d.ts             # window.api type declarations, re-exports from shared/types.ts
│
└── renderer/
    ├── assets/
    │   └── main.css
    ├── components/
    │   └── ui/                # shadcn/ui primitives (button, dialog, input, label, table)
    ├── lib/
    │   ├── utils.ts           # cn() helper
    │   └── format.ts          # formatAge() and other shared formatters
    ├── hooks/
    │   └── useResourceFetch.ts
    ├── store/
    │   └── app.store.ts       # Includes currentContext, clusterType, typed selectedItem
    └── src/
        ├── App.tsx
        ├── main.tsx
        └── components/
            ├── ErrorBoundary.tsx
            ├── TreeView.tsx
            ├── MetaEntry.tsx          # Shared label+value presentational component
            ├── NamespacesView.tsx
            ├── NodesView.tsx
            ├── PodsView.tsx
            ├── ReplicaSetsView.tsx
            ├── ConfigMapsView.tsx
            ├── SecretsView.tsx
            ├── deployments/
            │   ├── DeploymentsView.tsx
            │   ├── DeploymentDetailPanel.tsx
            │   ├── CreateDeploymentDialog.tsx
            │   ├── EditDeploymentDialog.tsx
            │   └── DeleteDeploymentDialog.tsx
            ├── statefulsets/
            │   ├── StatefulSetsView.tsx
            │   ├── StatefulSetDetailPanel.tsx
            │   ├── CreateStatefulSetDialog.tsx
            │   ├── EditStatefulSetDialog.tsx
            │   └── DeleteStatefulSetDialog.tsx
            └── daemonsets/
                ├── DaemonSetsView.tsx
                ├── DaemonSetDetailPanel.tsx
                ├── CreateDaemonSetDialog.tsx
                ├── EditDaemonSetDialog.tsx
                └── DeleteDaemonSetDialog.tsx
```

---

## 5. Refactoring Priority Summary

| ID | Title | Priority | Complexity | Motivation |
|----|-------|----------|------------|------------|
| P1-A | Extract `formatAge` + `MetaEntry` | P1 | S | PP-2 |
| P1-B | Split monolithic CRUD view files | P1 | M | PP-1 |
| P1-C | Import K8s types from preload | P1 | S | PP-6 |
| P1-D | Typed `selectedItem` in store | P1 | M | PP-3 |
| P1-E | Centralised IPC error handler | P1 | M | PP-5 |
| P2-A | `src/shared/types.ts` | P2 | S | PP-6 |
| P2-B | IPC channel name constants | P2 | S | PP-7 |
| P2-C | Move context/clusterType to store | P2 | S | PP-4 |
| P2-D | `useResourceFetch` hook | P2 | S | PP-2, PP-9 |
| P2-E | React error boundaries | P2 | S | PP-8 |
| P3-A | Component unit tests | P3 | M | PP-10 |
| P3-B | Split `k8s-handlers.ts` | P3 | S | PP-1 |
| P3-C | Resource list caching | P3 | M | PP-9 |

> **Complexity key:** S = hours, M = 1–2 days, L = 3+ days.

---

## 6. What Is Not Changing

The following architectural decisions are sound and should be preserved:

- **IPC isolation**: K8s API calls stay in the main process only. No changes to this boundary.
- **shadcn/ui component library**: The `src/renderer/components/ui/` primitives are well-structured and do not need refactoring.
- **Tailwind CSS v4**: The config-file-free setup is correct and intentional.
- **electron-vite layout**: `src/main/`, `src/preload/`, `src/renderer/` directory boundaries should remain unchanged.
- **Functional React components**: All components already use hooks; no class components except the new `ErrorBoundary`.
