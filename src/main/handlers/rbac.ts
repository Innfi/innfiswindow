import { CoreV1Api, RbacAuthorizationV1Api } from "@kubernetes/client-node"

import {
  ClusterRoleBindingInfo,
  ClusterRoleInfo,
  MutationResult,
  RoleBindingInfo,
  RoleInfo,
  UpdateClusterRoleBindingResult,
  UpdateClusterRoleResult,
  UpdateRoleBindingResult,
  UpdateRoleResult,
  UpdateServiceAccountResult,
} from "./types"

export async function listRoles(
  api: RbacAuthorizationV1Api,
  namespace?: string,
): Promise<RoleInfo[]> {
  const res = namespace
    ? await api.listNamespacedRole({ namespace })
    : await api.listRoleForAllNamespaces()
  return res.items.map((r) => ({
    name: r.metadata?.name ?? "",
    namespace: r.metadata?.namespace ?? "",
    rulesCount: (r.rules ?? []).length,
    creationTimestamp: r.metadata?.creationTimestamp?.toISOString() ?? "",
    rules: (r.rules ?? []).map((rule) => ({
      apiGroups: rule.apiGroups ?? [],
      resources: rule.resources ?? [],
      verbs: rule.verbs ?? [],
    })),
  }))
}

export async function listClusterRoles(
  api: RbacAuthorizationV1Api,
): Promise<ClusterRoleInfo[]> {
  const res = await api.listClusterRole()
  return res.items.map((r) => ({
    name: r.metadata?.name ?? "",
    rulesCount: (r.rules ?? []).length,
    creationTimestamp: r.metadata?.creationTimestamp?.toISOString() ?? "",
    rules: (r.rules ?? []).map((rule) => ({
      apiGroups: rule.apiGroups ?? [],
      resources: rule.resources ?? [],
      verbs: rule.verbs ?? [],
    })),
  }))
}

export async function listRoleBindings(
  api: RbacAuthorizationV1Api,
  namespace?: string,
): Promise<RoleBindingInfo[]> {
  const res = namespace
    ? await api.listNamespacedRoleBinding({ namespace })
    : await api.listRoleBindingForAllNamespaces()
  return res.items.map((rb) => ({
    name: rb.metadata?.name ?? "",
    namespace: rb.metadata?.namespace ?? "",
    roleRef: {
      kind: rb.roleRef?.kind ?? "",
      name: rb.roleRef?.name ?? "",
    },
    subjects: (rb.subjects ?? []).map((s) => ({
      kind: s.kind ?? "",
      name: s.name ?? "",
      namespace: s.namespace ?? "",
    })),
    subjectsCount: (rb.subjects ?? []).length,
    creationTimestamp: rb.metadata?.creationTimestamp?.toISOString() ?? "",
  }))
}

export async function listClusterRoleBindings(
  api: RbacAuthorizationV1Api,
): Promise<ClusterRoleBindingInfo[]> {
  const res = await api.listClusterRoleBinding()
  return res.items.map((crb) => ({
    name: crb.metadata?.name ?? "",
    roleRef: {
      kind: crb.roleRef?.kind ?? "",
      name: crb.roleRef?.name ?? "",
    },
    subjects: (crb.subjects ?? []).map((s) => ({
      kind: s.kind ?? "",
      name: s.name ?? "",
      namespace: s.namespace ?? "",
    })),
    subjectsCount: (crb.subjects ?? []).length,
    creationTimestamp: crb.metadata?.creationTimestamp?.toISOString() ?? "",
  }))
}

export async function updateRole(
  api: RbacAuthorizationV1Api,
  namespace: string,
  name: string,
  rules: Array<{ apiGroups: string[]; resources: string[]; verbs: string[] }>,
): Promise<UpdateRoleResult> {
  const body = { rules }
  const res = await api.patchNamespacedRole({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
    rules: (res.rules ?? []).map((rule) => ({
      apiGroups: rule.apiGroups ?? [],
      resources: rule.resources ?? [],
      verbs: rule.verbs ?? [],
    })),
  }
}

export async function updateClusterRole(
  api: RbacAuthorizationV1Api,
  name: string,
  rules: Array<{ apiGroups: string[]; resources: string[]; verbs: string[] }>,
): Promise<UpdateClusterRoleResult> {
  const body = { rules }
  const res = await api.patchClusterRole({ name, body })
  return {
    name: res.metadata?.name ?? "",
    rules: (res.rules ?? []).map((rule) => ({
      apiGroups: rule.apiGroups ?? [],
      resources: rule.resources ?? [],
      verbs: rule.verbs ?? [],
    })),
  }
}

export async function updateRoleBinding(
  api: RbacAuthorizationV1Api,
  namespace: string,
  name: string,
  subjects: Array<{ kind: string; name: string; namespace?: string }>,
): Promise<UpdateRoleBindingResult> {
  const body = { subjects }
  const res = await api.patchNamespacedRoleBinding({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
    subjects: (res.subjects ?? []).map((s) => ({
      kind: s.kind ?? "",
      name: s.name ?? "",
      namespace: s.namespace ?? "",
    })),
  }
}

export async function updateClusterRoleBinding(
  api: RbacAuthorizationV1Api,
  name: string,
  subjects: Array<{ kind: string; name: string; namespace?: string }>,
): Promise<UpdateClusterRoleBindingResult> {
  const body = { subjects }
  const res = await api.patchClusterRoleBinding({ name, body })
  return {
    name: res.metadata?.name ?? "",
    subjects: (res.subjects ?? []).map((s) => ({
      kind: s.kind ?? "",
      name: s.name ?? "",
      namespace: s.namespace ?? "",
    })),
  }
}

export async function updateServiceAccount(
  api: CoreV1Api,
  namespace: string,
  name: string,
  metadata: {
    labels?: Record<string, string>
    annotations?: Record<string, string>
  },
): Promise<UpdateServiceAccountResult> {
  const body = { metadata }
  const res = await api.patchNamespacedServiceAccount({ name, namespace, body })
  return {
    name: res.metadata?.name ?? "",
    namespace: res.metadata?.namespace ?? "",
    labels: res.metadata?.labels ?? {},
    annotations: res.metadata?.annotations ?? {},
  }
}

export async function deleteRole(
  api: RbacAuthorizationV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.deleteNamespacedRole({ name, namespace })
  return { success: true, name, namespace }
}

export async function deleteClusterRole(
  api: RbacAuthorizationV1Api,
  name: string,
): Promise<MutationResult> {
  await api.deleteClusterRole({ name })
  return { success: true, name }
}

export async function deleteRoleBinding(
  api: RbacAuthorizationV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.deleteNamespacedRoleBinding({ name, namespace })
  return { success: true, name, namespace }
}

export async function deleteClusterRoleBinding(
  api: RbacAuthorizationV1Api,
  name: string,
): Promise<MutationResult> {
  await api.deleteClusterRoleBinding({ name })
  return { success: true, name }
}

export async function deleteServiceAccount(
  api: CoreV1Api,
  namespace: string,
  name: string,
): Promise<MutationResult> {
  await api.deleteNamespacedServiceAccount({ name, namespace })
  return { success: true, name, namespace }
}
