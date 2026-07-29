# Review follow-ups

Outstanding items from the k8s-ops review. Each is self-contained; tackle in any
order. Severity is relative to running this as a real cluster-ops tool.

## 1. List views don't scale — no pagination, no watch (perf, high)

Every list handler calls `list*ForAllNamespaces()` with no `limit`/`continue`,
and `useK8sResource` refetches the **entire** list on every poll tick. On a large
cluster (thousands of pods) this means one huge IPC payload plus a full re-map
every interval.

- Files: all `src/main/handlers/*.ts` (search `ForAllNamespaces`),
  `src/renderer/src/hooks/useK8sResource.ts`.
- Options, cheapest first:
  1. Honor the selected namespace to shrink payloads (list-namespaced instead of
     all-namespaces when a namespace is active).
  2. Add server-side `limit` + `continue` paging to the list handlers.
  3. Longer term: move hot lists (pods, events) to the **watch API** for
     incremental updates instead of full-list polling.

## 2. List handlers serialize full detail (perf, medium)

`listDeployments` / `listPods` (etc.) map every container, env var, volume, and
probe for every row — but list views only render a summary. That full detail
crosses IPC on every poll.

- Files: `src/main/handlers/workload.ts` and siblings.
- Fix: split a lightweight list shape (name, ns, status, counts, age) from the
  detail shape; fetch full detail only when a row is selected (a per-item
  `get<Resource>` handler). Coordinate with the `K8s*` types in
  `src/renderer/src/types/k8s.ts` / `src/shared/k8s.ts`.

## 3. Renderer `sandbox: false` (security, medium)

`src/main/index.ts` sets `webPreferences.sandbox: false`, giving the preload full
Node. `contextIsolation` is on (good), but enabling the sandbox is defense in
depth.

- Try `sandbox: true` and confirm the preload (`src/preload/index.ts`) still
  loads — it uses only `contextBridge`/`ipcRenderer`, which are sandbox-safe, so
  this may just work. Verify Monaco workers, xterm, and all IPC still function.

## 4. CSP needs runtime verification (security, follow-through)

A dev-aware CSP was added via `onHeadersReceived` in `src/main/index.ts`. It was
**not** verified against a running app (no GUI/cluster in the review env).

- Run `npm run dev`: open the YAML Monaco editor and a pod shell/log panel, watch
  devtools console for CSP violations.
- Run a packaged build (`npm run package:unpack`): the `file://` origin can trip
  `script-src 'self'`. If it does, switch the renderer to a custom `app://`
  protocol (`protocol.handle`) and set `script-src 'self' app://…`.

## 5. Apply: no dry-run / diff preview (feature, medium)

`src/main/handlers/apply.ts` applies YAML with no server-side dry-run or diff, so
there's no "show me what changes" step before a write.

- Add a `dryRun: "All"` code path and surface the returned object / a diff against
  the live object in the apply UI before the real apply.

## 6. Misc smaller items

- **Pod owner-name heuristic** (`src/main/handlers/workload.ts`, ~line 401):
  `firstOwner.name.replace(/-[a-z0-9]+$/, "")` guesses a Deployment name from the
  ReplicaSet name and breaks on deploy names ending in `-<alnum>`. Prefer
  resolving the RS's own `ownerReferences` when accuracy matters.
- **Raw IPC error strings** (`src/renderer/src/hooks/useK8sResource.ts`): errors
  are shown via `String(err)`, leaking the `Error invoking remote method '…':`
  prefix. `src/renderer/lib/ipc-error.ts` already normalizes messages — reuse it.
- **Silent helm/prometheus failures**: some handlers `catch { return [] }`, so a
  broken `helm` binary is indistinguishable from "no releases". Surface an error
  state to the view instead of swallowing.

## 7. Node drain — parity gaps (feature, low)

The drain added in this branch issues evictions but does **not** wait for pods to
terminate, and has no `--force` (unmanaged pods), `--grace-period`, or
emptyDir-data handling.

- File: `drainNode` in `src/main/handlers/cluster.ts`.
- Add a poll loop that waits for evicted pods to disappear (with a timeout), and
  optional force/grace-period flags plumbed through IPC + the drain dialog.
