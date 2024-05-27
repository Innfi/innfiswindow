# innfiswindow

a monitoring tool for cloud env (mainly on AWS / EKS)

# TODO
---
- authentications
  - how to handle auth problems when accesssing eks, or other aws-based resources?
- plans
  - show relations among ingress - service - workloads
- define functionalities of the tool:
  - monitoring targets:
    - metrics from sources on AWS: cloudwatch, grafana on eks, etc
    - external resources (maybe for health check)
    - custom metrics

# DONE
---
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