export const RESOURCE_TYPES = [
  "Namespaces",
  "Nodes",
  "Deployments",
  "ReplicaSets",
  "StatefulSets",
  "DaemonSets",
  "ConfigMaps",
  "Secrets",
  "Pods",
  "Services",
  "Ingresses",
  "IngressClasses",
  "NetworkPolicies",
  "Endpoints",
  "EndpointSlices",
  "Events",
  "HPAs",
  "ServiceAccounts",
  "Roles",
  "ClusterRoles",
  "RoleBindings",
  "ClusterRoleBindings",
  "access-review",
  "PersistentVolumes",
  "PersistentVolumeClaims",
  "StorageClasses",
  "VolumeSnapshots",
  "VolumeSnapshotClasses",
  "CustomResourceDefinitions",
  "custom-resources",
  "api-resources",
  "Jobs",
  "CronJobs",
  "ResourceQuotas",
  "LimitRanges",
  "PodDisruptionBudgets",
  "PriorityClasses",
  "overview",
  "custom-stream",
  "history",
  "helm-repositories",
  "helm-releases",
  "alarm-rules",
  "alarm-active",
] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]

export function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value)
}

/**
 * The view that lists a given Kubernetes kind. Keyed by the kind as the API
 * server spells it (not by the `resourceGvk` table's shorter aliases), since
 * these lookups start from an ownerReference or a spec field. Kinds with no
 * view of their own are absent, and a link to one renders as plain text.
 */
const RESOURCE_TYPE_BY_KIND: Record<string, ResourceType> = {
  Namespace: "Namespaces",
  Node: "Nodes",
  Deployment: "Deployments",
  ReplicaSet: "ReplicaSets",
  StatefulSet: "StatefulSets",
  DaemonSet: "DaemonSets",
  ConfigMap: "ConfigMaps",
  Secret: "Secrets",
  Pod: "Pods",
  Service: "Services",
  Ingress: "Ingresses",
  IngressClass: "IngressClasses",
  NetworkPolicy: "NetworkPolicies",
  Endpoints: "Endpoints",
  EndpointSlice: "EndpointSlices",
  Event: "Events",
  HorizontalPodAutoscaler: "HPAs",
  ServiceAccount: "ServiceAccounts",
  Role: "Roles",
  ClusterRole: "ClusterRoles",
  RoleBinding: "RoleBindings",
  ClusterRoleBinding: "ClusterRoleBindings",
  PersistentVolume: "PersistentVolumes",
  PersistentVolumeClaim: "PersistentVolumeClaims",
  StorageClass: "StorageClasses",
  VolumeSnapshot: "VolumeSnapshots",
  VolumeSnapshotClass: "VolumeSnapshotClasses",
  CustomResourceDefinition: "CustomResourceDefinitions",
  Job: "Jobs",
  CronJob: "CronJobs",
  ResourceQuota: "ResourceQuotas",
  LimitRange: "LimitRanges",
  PodDisruptionBudget: "PodDisruptionBudgets",
  PriorityClass: "PriorityClasses",
}

export function resourceTypeForKind(kind: string): ResourceType | null {
  return RESOURCE_TYPE_BY_KIND[kind] ?? null
}
