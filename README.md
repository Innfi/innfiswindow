# innfiswindow
a monitoring tool for cloud env (mainly on AWS / EKS)

# TODO
--------------------------------------------------------------------------------
* plans
  - show relations among ingress - service - workloads
  - show resource details

* define functionalities of the tool:
  - is it for monitoring purpose only? or should control functions required?
  - monitoring targets:

    - metrics from sources on AWS: cloudwatch, grafana on eks, etc
    - external resources (maybe for health check)
    - custom metrics
* milestones

# DONE
--------------------------------------------------------------------------------
* plans
  - deploy a simplest settings to access k8s api
  - handle authentication / CORS issues
  - get the namespace list
  - get the deployment list

