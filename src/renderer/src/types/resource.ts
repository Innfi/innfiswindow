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
  "NetworkPolicies",
  "Endpoints",
  "Events",
  "HPAs",
  "ServiceAccounts",
  "Roles",
  "ClusterRoles",
  "RoleBindings",
  "ClusterRoleBindings",
  "PersistentVolumes",
  "PersistentVolumeClaims",
  "StorageClasses",
  "VolumeSnapshots",
  "Jobs",
  "CronJobs",
  "ResourceQuotas",
  "LimitRanges",
  "PodDisruptionBudgets",
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
