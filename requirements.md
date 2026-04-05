# overall requirements

- the tool is for managing k8s resources.
- user should be able to list, view detail, and modify the k8s resources
- for now the list of resource is as follows:
  - namespaces
  - nodes
  - deployments
  - pods
- the tool should be able to read ~/.kube/config for local k8s configuration and connect its api server
- the tool should be able to request addotional privileges for managed clusters such as eks, aks
- the tool should run as a standalone app
- the tool should utilize k8s api to communicate the cluster described in ~/.kube/config

# layout requirements

- the layout of the tools should follow typical form of backoffice or crm
- the tree view should be able show represent k8s resource types and enable user to select each of it
- the tree view should presend on the leftmost side of the app
- the resource view may fill the remain area of the app
- the resource view should represent the list of the selected resource
- when user click a specific resource, user should be able to check the detail of the resource
- the list view should present only brief information of the resource
  - for example of pod, the original deployment, app name, pod status should suffice
