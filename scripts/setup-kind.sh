#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="innfiswindow-test"
FIXTURES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/fixtures" && pwd)"

echo "==> Checking prerequisites..."
command -v kind  >/dev/null 2>&1 || { echo "ERROR: 'kind' not found. Install from https://kind.sigs.k8s.io/docs/user/quick-start/#installation"; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "ERROR: 'kubectl' not found. Install from https://kubernetes.io/docs/tasks/tools/"; exit 1; }

echo "==> Checking if cluster '${CLUSTER_NAME}' already exists..."
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "    Cluster '${CLUSTER_NAME}' already exists — skipping creation."
else
  echo "==> Creating kind cluster '${CLUSTER_NAME}'..."
  kind create cluster --name "${CLUSTER_NAME}" --config - <<'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
EOF
  echo "    Cluster created."
fi

echo "==> Waiting for all nodes to be Ready..."
kubectl --context "kind-${CLUSTER_NAME}" wait node --all --for=condition=Ready --timeout=120s

echo "==> Waiting for core system pods..."
kubectl --context "kind-${CLUSTER_NAME}" -n kube-system wait pod --all --for=condition=Ready --timeout=120s || true

echo "==> Applying fixture manifests..."
for manifest in "${FIXTURES_DIR}"/*.yaml; do
  echo "    Applying $(basename "${manifest}")..."
  kubectl --context "kind-${CLUSTER_NAME}" apply -f "${manifest}"
done

echo "==> Waiting for workloads to become ready..."
kubectl --context "kind-${CLUSTER_NAME}" -n test-ns-1 wait deployment nginx-deploy --for=condition=Available --timeout=120s || true
kubectl --context "kind-${CLUSTER_NAME}" -n test-ns-1 wait pod --all --for=condition=Ready --timeout=120s || true

echo ""
echo "Done! Cluster '${CLUSTER_NAME}' is running."
echo "Set your kubeconfig context with:"
echo "  kubectl config use-context kind-${CLUSTER_NAME}"
echo ""
echo "Or point the app at this context by selecting 'kind-${CLUSTER_NAME}' in the context picker."
