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
  1. ~~Honor the selected namespace to shrink payloads.~~ **Done** — every list
     handler takes `namespace?` and branches to `list*Namespaced*`;
     `useK8sResource` passes the active namespace through.
  2. Add server-side `limit` + `continue` paging to the list handlers. Needs a
     paging cursor in `useK8sResource` and a "load more" affordance in
     `ResourceListView`. **Not planned** — option 3 covers the same cost for the
     lists that hurt, and paging would make name filtering and sorting silently
     wrong, since both run client-side over the loaded rows
     (`ResourceListView`).
  3. ~~Move hot lists (pods, events) to the **watch API**.~~ **Done for pods and
     events** — see below. Extending it to another list is now a matter of
     adding a case to `createEntry` and passing `watch` to that view.

### Watch-backed lists

`src/main/informers.ts` keeps one `makeInformer` per context + resource +
namespace, shared by every subscriber that asked for the same thing, and maps
each watched object through the *same* mapper the list handler uses
(`mapPodSummary`, `mapEvent`) so a row is identical whether it arrived by watch
or by list.

- IPC: `k8s:watch:start` returns `{ subId, items }` — the informer's synced
  cache — and `k8s:watch:stop` unsubscribes. Changes are pushed on
  `k8s:watch:event`, tagged with the `subId`; `k8s:watch:closed` announces a
  watch that died after it was established.
- Renderer: `useK8sResource` takes `watch?: WatchResource`. It uses the snapshot
  as its initial data, applies add/update/delete **in place** (dropping and
  re-appending would make a changing row jump to the bottom of the table), and
  falls back to polling the existing `list` fetcher whenever the watch can't
  start (a role without the `watch` verb) or later drops. `ResourceListView`
  passes the option through; `PodsView` sets `watch="pods"`.
- Timestamps: the typed list client deserializes them into `Date`, the watch
  stream leaves them as strings. `toIso` (`src/main/handlers/time.ts`) is what
  makes a mapper safe to feed from both.
- Pod owner resolution runs off a second informer over ReplicaSets, which keeps
  the owner map current instead of re-listing every ReplicaSet per poll. If that
  watch fails, pod mapping drops to the same name-stripping fallback the list
  path uses.
- `refreshInterval: "off"` disables the watch too — it is a background refresh.
  Pausing (a delete dialog) tears the subscription down rather than buffering,
  so resuming re-lists instead of leaving the view on a cache that stopped
  being updated.
- `EventsView` lost its **Tail** toggle: tailing is what the view now does. The
  old hand-rolled `k8s:events:watch:*` channels are gone — they ignored the
  selected context and namespace, and prepended every update as a new row
  instead of updating the one whose `count` had climbed.
- Informers hold open HTTP streams, so they are stopped on `before-quit`, when a
  renderer navigates (a reload never gets to call `stopWatch`), and when the
  last subscriber leaves.

Covered by `src/main/__tests__/informers.integration.test.ts` against the kind
cluster: snapshot/list equivalence, owner resolution parity, a created pod
arriving as `add` then `delete`, and two subscribers sharing one informer.

## 2. List handlers serialize full detail (perf, medium) — **done**

Twelve resources are now split into `XxxSummary` (what a list row renders) and
`XxxInfo extends XxxSummary` (what the detail panel adds), in
`src/shared/k8s.ts`. `list*` returns summaries; a new `get<Xxx>` handler fetches
one object's detail when a row is selected. Resources whose every field is
already list-sized (Services, PVCs, Jobs, …) keep a single `XxxInfo` and are
untouched.

Split: pods, deployments, replicasets, statefulsets, daemonsets (pod templates),
configmaps + secrets (`data`), ingresses (rules), networkpolicies (rules),
endpoints (subsets), roles + clusterroles (`rules`).

`listSecrets` in particular no longer ships every Secret's base64 `data`
cluster-wide on every poll tick — values now leave the main process only for the
one Secret whose panel is open.

- IPC: `k8s:<resource>:get` per resource.
- Renderer: `ResourceListView<S, D>` takes an optional `getDetail`; when set,
  `useResourceDetail` (`src/renderer/src/hooks/`) fetches the selected row's
  detail and refreshes it on the list's own poll interval, matching on
  name+namespace so the per-tick `selectedItem` re-sync doesn't refetch. A
  request in flight for a row the user has moved off is discarded rather than
  overwriting the current one, and detail already on screen survives a failed
  background refresh.
- `getPod` resolves its owner by reading the one ReplicaSet, where `listPods`
  has to list them all.
- `ServicesView` used to list every Endpoints object cluster-wide to find the
  one matching the open Service; it calls `getEndpoint` now.

Note for whoever does item 1: `detailGuard` discriminates the shared
`selectedItem` by probing for a field, so the guards on split views must name a
summary field, not a detail one.

## 3. Renderer `sandbox: false` (security, medium) — **done**

`webPreferences.sandbox` is now `true` in `src/main/index.ts`. The preload only
uses `contextBridge`/`ipcRenderer`, both sandbox-safe.

One thing this required: a sandboxed preload can only `require` `electron` plus
a few polyfilled builtins, and the preload build was leaving
`@electron-toolkit/preload` as an external `require`. `electron.vite.config.ts`
now excludes it from `externalizeDepsPlugin` so it gets bundled in. Any future
preload dependency needs the same treatment.

Still unverified against a running app (see item 4): confirm Monaco workers,
xterm, and IPC all work with the sandbox on.

## 4. CSP needs runtime verification (security, follow-through)

A dev-aware CSP was added via `onHeadersReceived` in `src/main/index.ts`. It was
**not** verified against a running app (no GUI/cluster in the review env).

- Run `npm run dev`: open the YAML Monaco editor and a pod shell/log panel, watch
  devtools console for CSP violations.
- Run a packaged build (`npm run package:unpack`): the `file://` origin can trip
  `script-src 'self'`. If it does, switch the renderer to a custom `app://`
  protocol (`protocol.handle`) and set `script-src 'self' app://…`.

## 5. Apply: no dry-run / diff preview (feature, medium) — **done**

`dryRunResource` in `src/main/handlers/apply.ts` runs the manifest through the
API server with `dryRun=All` (so defaulting, admission webhooks and validation
all run, and nothing is persisted), then diffs the result against the live
object. It mirrors `applyResource`'s create-then-patch-on-409 flow so the
preview matches what the real apply would do.

The diff is a small LCS line diff over both sides' YAML, sorted-key dumped so
key ordering isn't mistaken for a change. The apply UI (`NewResourcePanel` in
`BottomDrawer.tsx`) has a **Preview** button; on a create it shows the server's
rendering instead of a diff. Editing the YAML invalidates the preview.

- IPC: `k8s:resource:dryRun`.

## 6. Misc smaller items — **done**

- ~~**Pod owner-name heuristic**~~ — `buildReplicaSetOwnerMap`
  (`src/main/handlers/workload.ts`) resolves the ReplicaSet's own
  `ownerReferences`, falling back to name-stripping only when the caller can't
  list ReplicaSets.
- ~~**Raw IPC error strings**~~ — `useK8sResource` routes errors through
  `normalizeIpcError`.
- ~~**Silent helm/prometheus failures**~~ — `helmRepoList` only swallows the
  "no repositories" empty state and rethrows everything else; `getNodeMetrics`
  returns a typed `MetricsUnavailable` on 404/403 and rethrows otherwise.

## 7. Node drain — parity gaps (feature, low) — **done**

`drainNode` in `src/main/handlers/cluster.ts` now:

- Classifies every pod **before** evicting anything, and refuses the whole drain
  if it finds one it can't safely move — a half-drained node is worse than an
  undrained one. Static/mirror pods are always skipped instead, since the
  kubelet recreates them regardless.
- Takes `DrainOptions` (`force`, `gracePeriodSeconds`, `ignoreDaemonSets`,
  `deleteEmptyDirData`, `timeoutSeconds`), each guarding one of those refusals,
  plumbed through `k8s:node:drain` → preload → the drain dialog in `NodesView`.
- Waits for evicted pods to actually terminate, polling every 2s until the
  timeout (default 300s). Matches on pod UID, not name, so a StatefulSet
  replacement reusing a name isn't mistaken for the pod being evicted.

`DrainResult` gained `pending` (evicted pods still running at the deadline) and
`timedOut`; the dialog reports refusal, per-pod eviction failure, and timeout as
three distinct messages.
