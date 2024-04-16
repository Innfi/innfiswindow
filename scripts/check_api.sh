#!/bin/sh
ENDPOINT=$(kubectl cluster-info | grep 'Kubernetes control plane' | awk '/http/ {print $NF}')
curl --cacert ~/.minikube/ca.crt --cert ~/.minikube/profiles/minikube/client.crt --key ~/.minikube/profiles/minikube/client.key ${ENDPOINT}
