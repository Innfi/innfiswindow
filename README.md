[![action.ci](https://github.com/Innfi/innfiswindow/actions/workflows/action.yaml/badge.svg)](https://github.com/Innfi/innfiswindow/actions/workflows/action.yaml)

# innfiswindow

a monitoring tool for cloud env (mainly on AWS / EKS)

## TODO

- list information
  - ingress] name / loadbalancers rules age
  - workloads other than deployments
  - configMap
  - events

- refactoring
  - merge each recoil atoms with selector
  - replace list table with material react table

- authentications
  - how to handle auth problems when accesssing eks, or other aws-based resources?

- refactoring
  - remove duplicating table settings

- plans
  - show relations among ingress - service - workloads

- define functionalities of the tool:
  - monitoring targets:
    - metrics from sources on AWS: cloudwatch, grafana on eks, etc
    - external resources (maybe for health check)
    - custom metrics

## DONE

- plans
  - deploy a simplest settings to access k8s api
  - handle authentication / CORS issues
  - get the namespace list
  - get the deployment list
  - show resource details

- define functionalities of the tool:
  - is it for monitoring purpose only? or should control functions required?
    - monitoring only will do, for now 
  - monitoring targets:
    - k8s resources

- recoil
  - check atom persistency 
  - handle react query error (which is invoked by axios error)
  - let resource page refresh itself when the namespace is changed

- refactoring
  - invert the referencing from pathfinder to each page routes (unavailable)
  - common ui to visualize error

- list information
  - pod] name / invoked resource (replcaset / daemonset) / age / status 
  - deployment] name / pods count / replicas count  / age status
  - service] type / cluter ip / ports / (status unavailable)
