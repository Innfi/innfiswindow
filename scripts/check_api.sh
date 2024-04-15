#!/bin/sh
curl --cacert ~/.minikube/ca.crt --cert ~/.minikube/profiles/minikube/client.crt --key ~/.minikube/profiles/minikube/client.key $1
