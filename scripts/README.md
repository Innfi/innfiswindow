# Local Testing with kind

This directory contains scripts to spin up a local [kind](https://kind.sigs.k8s.io/) (Kubernetes IN Docker) cluster for testing the Innfiswindow app.

## Prerequisites

| Tool | Install |
|------|---------|
| **Docker** | https://docs.docker.com/get-docker/ |
| **kind** | https://kind.sigs.k8s.io/docs/user/quick-start/#installation |
| **kubectl** | https://kubernetes.io/docs/tasks/tools/ |

Verify they are on your `PATH`:

```sh
docker version
kind version
kubectl version --client
```

## Setup

Run the setup script from the repository root:

```sh
bash scripts/setup-kind.sh
```

This will:
1. Create a single-node kind cluster named `innfiswindow-test` (skips creation if it already exists).
2. Wait for the node and system pods to be Ready.
3. Apply all fixture manifests from `scripts/fixtures/` in order.

The script is **idempotent** — safe to run multiple times.

### What gets created

| Resource | Name | Namespace |
|----------|------|-----------|
| Namespace | test-ns-1 | — |
| Namespace | test-ns-2 | — |
| ConfigMap | app-config | test-ns-1 |
| ConfigMap | db-config | test-ns-1 |
| Secret (Opaque) | app-secret | test-ns-1 |
| Deployment (nginx, 2 replicas) | nginx-deploy | test-ns-1 |
| StatefulSet (1 replica) | postgres | test-ns-1 |
| DaemonSet (pause:3.9) | log-collector | test-ns-1 |
| Node | kind-control-plane | — (provided by kind) |

## Point the app at the kind cluster

The kind cluster is added to your kubeconfig automatically as context `kind-innfiswindow-test`.

**Switch kubectl to the kind context:**

```sh
kubectl config use-context kind-innfiswindow-test
```

**In the Innfiswindow app**, open the context picker in the top bar and select `kind-innfiswindow-test`.

**Verify fixtures are running:**

```sh
kubectl --context kind-innfiswindow-test get all -A
```

## Teardown

```sh
bash scripts/teardown-kind.sh
```

This deletes the `innfiswindow-test` cluster and removes it from your kubeconfig.

## Fixture images

Images used are intentionally lightweight to reduce pull time:

| Image | Used by |
|-------|---------|
| `nginx:alpine` | nginx-deploy Deployment |
| `busybox:latest` | postgres StatefulSet |
| `registry.k8s.io/pause:3.9` | log-collector DaemonSet |
