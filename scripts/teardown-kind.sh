#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="innfiswindow-test"

echo "==> Checking prerequisites..."
command -v kind >/dev/null 2>&1 || { echo "ERROR: 'kind' not found."; exit 1; }

echo "==> Deleting kind cluster '${CLUSTER_NAME}'..."
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  kind delete cluster --name "${CLUSTER_NAME}"
  echo "    Cluster '${CLUSTER_NAME}' deleted."
else
  echo "    Cluster '${CLUSTER_NAME}' does not exist — nothing to do."
fi
