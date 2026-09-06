import {
  AuthorizationV1Api,
  CoreV1Api,
  RbacAuthorizationV1Api,
  V1NonResourceAttributes,
  V1PolicyRule,
  V1ResourceAttributes,
} from "@kubernetes/client-node"

import {
  implicitGroups,
  matchesSubject,
  serviceAccountUsername,
  subjectMatchers,
} from "../../shared/access"
import {
  AccessReviewRequest,
  AccessReviewResult,
  AccessRule,
  AccessSubject,
  ClusterRoleBindingInfo,
  ClusterRoleInfo,
  ClusterRoleSummary,
  EffectiveAccessRule,
  RbacRule,
  RbacSubject,
  RoleBindingInfo,
  RoleInfo,
  RoleSubjectBinding,
  RoleSummary,
  SelfRulesResult,
  SubjectBinding,
  SubjectPermissions,
  UpdateClusterRoleBindingResult,
  UpdateClusterRoleResult,
  UpdateRoleBindingResult,
  UpdateRoleResult,
  UpdateServiceAccountResult,
} from "./types"

function mapRules(rules: V1PolicyRule[] | undefined): RbacRule[] {
  return (rules ?? []).map((rule) => ({
    apiGroups: rule.apiGroups ?? [],
    resources: rule.resources ?? [],
    verbs: rule.verbs ?? [],
  }))
}

export async function listRoles(
  api: RbacAuthorizationV1Api,
  namespace?: string,
): Promise<RoleSummary[]> {
  const res = namespace
    ? await api.listNamespacedRole({ namespace })
    : await api.listRoleForAllNamespaces()
  return res.items.map((r) => ({
    name: r.metadata?.name ?? "",
    namespace: r.metadata?.namespace ?? "",
    rulesCount: (r.rules ?? []).length,
    creationTimestamp: r.metadata?.creationTimestamp?.toISOString() ?? "",
  }))
}

export async function getRole(
  api: RbacAuthorizationV1Api,
  namespace: string,
  name: string,
): Promise<RoleInfo> {
  const r = await api.readNamespacedRole({ name, namespace })
  return {
    name: r.metadata?.name ?? "",
    namespace: r.metadata?.namespace ?? "",
    rulesCount: (r.rules ?? []).length,
    creationTimestamp: r.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: r.metadata?.labels ?? {},
    annotations: r.metadata?.annotations ?? {},
    rules: mapRules(r.rules),
  }
}

export async function listClusterRoles(
  api: RbacAuthorizationV1Api,
): Promise<ClusterRoleSummary[]> {
  const res = await api.listClusterRole()
  return res.items.map((r) => ({
    name: r.metadata?.name ?? "",
    rulesCount: (r.rules ?? []).length,
    creationTimestamp: r.metadata?.creationTimestamp?.toISOString() ?? "",
  }))
}

export async function getClusterRole(
  api: RbacAuthorizationV1Api,
  name: string,
): Promise<ClusterRoleInfo> {
  const r = await api.readClusterRole({ name })
  return {
    name: r.metadata?.name ?? "",
    rulesCount: (r.rules ?? []).length,
    creationTimestamp: r.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: r.metadata?.labels ?? {},
    annotations: r.metadata?.annotations ?? {},
    rules: mapRules(r.rules),
  }
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
    labels: rb.metadata?.labels ?? {},
    annotations: rb.metadata?.annotations ?? {},
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
    labels: crb.metadata?.labels ?? {},
    annotations: crb.metadata?.annotations ?? {},
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
    rules: mapRules(res.rules),
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
    rules: mapRules(res.rules),
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

// ---------------------------------------------------------------------------
// Access review — `kubectl auth can-i`, and the reverse lookups around it.
// ---------------------------------------------------------------------------

/** The user and groups the API server should answer for. A ServiceAccount is
 *  a username plus the groups its token carries, which is what impersonation
 *  reconstructs. */
function reviewIdentity(subject: AccessSubject): {
  user?: string
  groups?: string[]
} {
  if (subject.kind === "Group") return { groups: [subject.name] }
  if (subject.kind === "ServiceAccount") {
    return {
      user: serviceAccountUsername(subject.namespace, subject.name),
      groups: implicitGroups(subject),
    }
  }
  return { user: subject.name, groups: implicitGroups(subject) }
}

function reviewAttributes(request: AccessReviewRequest): {
  resourceAttributes?: V1ResourceAttributes
  nonResourceAttributes?: V1NonResourceAttributes
} {
  if (request.nonResourceURL.trim() !== "") {
    return {
      nonResourceAttributes: {
        path: request.nonResourceURL.trim(),
        verb: request.verb,
      },
    }
  }
  return {
    resourceAttributes: {
      // An empty namespace means "in any namespace" for a namespaced kind and
      // is the only correct value for a cluster-scoped one, so it is left off.
      ...(request.namespace ? { namespace: request.namespace } : {}),
      verb: request.verb,
      group: request.group,
      resource: request.resource,
      ...(request.subresource ? { subresource: request.subresource } : {}),
      ...(request.name ? { name: request.name } : {}),
    },
  }
}

/**
 * Asks the API server whether a verb is allowed — a SelfSubjectAccessReview
 * for the kubeconfig's own identity, which needs no extra rights, and a
 * SubjectAccessReview for anyone else, which needs `create` on
 * subjectaccessreviews (cluster-admin has it, a read-only role does not).
 */
export async function checkAccess(
  api: AuthorizationV1Api,
  request: AccessReviewRequest,
): Promise<AccessReviewResult> {
  const spec = reviewAttributes(request)
  if (request.subject.kind === "current-user") {
    const res = await api.createSelfSubjectAccessReview({ body: { spec } })
    return {
      allowed: res.status?.allowed ?? false,
      denied: res.status?.denied ?? false,
      reason: res.status?.reason ?? "",
      evaluationError: res.status?.evaluationError ?? "",
      reviewKind: "SelfSubjectAccessReview",
      checkedAs: "current user",
    }
  }
  const identity = reviewIdentity(request.subject)
  const res = await api.createSubjectAccessReview({
    body: { spec: { ...spec, ...identity } },
  })
  return {
    allowed: res.status?.allowed ?? false,
    denied: res.status?.denied ?? false,
    reason: res.status?.reason ?? "",
    evaluationError: res.status?.evaluationError ?? "",
    reviewKind: "SubjectAccessReview",
    checkedAs: identity.user ?? `Group ${request.subject.name}`,
  }
}

function mapAccessRule(rule: {
  apiGroups?: string[]
  resources?: string[]
  resourceNames?: string[]
  verbs?: string[]
  nonResourceURLs?: string[]
}): AccessRule {
  return {
    apiGroups: rule.apiGroups ?? [],
    resources: rule.resources ?? [],
    resourceNames: rule.resourceNames ?? [],
    verbs: rule.verbs ?? [],
    nonResourceURLs: rule.nonResourceURLs ?? [],
  }
}

/**
 * Everything the kubeconfig user may do in a namespace, as the API server
 * itself computes it (SelfSubjectRulesReview). Only answerable for the current
 * user — there is no such review for another subject, which is why the reverse
 * lookup below walks the bindings by hand instead.
 */
export async function listSelfRules(
  api: AuthorizationV1Api,
  namespace: string,
): Promise<SelfRulesResult> {
  const res = await api.createSelfSubjectRulesReview({
    body: { spec: { namespace } },
  })
  return {
    namespace,
    incomplete: res.status?.incomplete ?? false,
    evaluationError: res.status?.evaluationError ?? "",
    resourceRules: (res.status?.resourceRules ?? []).map(mapAccessRule),
    nonResourceRules: (res.status?.nonResourceRules ?? []).map(mapAccessRule),
  }
}

/** Reads the roles a reverse lookup references: one bulk list when the user
 *  may make it, a targeted read per role otherwise. Either way a role that
 *  cannot be read becomes an error on its binding, not a failed lookup. */
function createRoleResolver(api: RbacAuthorizationV1Api): {
  prime: () => Promise<void>
  resolve: (
    kind: string,
    name: string,
    namespace: string,
  ) => Promise<{ rules: AccessRule[]; error: string }>
} {
  const cache = new Map<string, { rules: AccessRule[]; error: string }>()
  const key = (kind: string, name: string, namespace: string): string =>
    kind === "ClusterRole" ? `ClusterRole/${name}` : `Role/${namespace}/${name}`

  async function prime(): Promise<void> {
    const [roles, clusterRoles] = await Promise.allSettled([
      api.listRoleForAllNamespaces(),
      api.listClusterRole(),
    ])
    if (roles.status === "fulfilled") {
      for (const r of roles.value.items) {
        cache.set(
          key("Role", r.metadata?.name ?? "", r.metadata?.namespace ?? ""),
          { rules: (r.rules ?? []).map(mapAccessRule), error: "" },
        )
      }
    }
    if (clusterRoles.status === "fulfilled") {
      for (const r of clusterRoles.value.items) {
        cache.set(key("ClusterRole", r.metadata?.name ?? "", ""), {
          rules: (r.rules ?? []).map(mapAccessRule),
          error: "",
        })
      }
    }
  }

  async function resolve(
    kind: string,
    name: string,
    namespace: string,
  ): Promise<{ rules: AccessRule[]; error: string }> {
    const cacheKey = key(kind, name, namespace)
    const cached = cache.get(cacheKey)
    if (cached) return cached
    let result: { rules: AccessRule[]; error: string }
    try {
      const role =
        kind === "ClusterRole"
          ? await api.readClusterRole({ name })
          : await api.readNamespacedRole({ name, namespace })
      result = { rules: (role.rules ?? []).map(mapAccessRule), error: "" }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result = {
        rules: [],
        error: `${kind} ${name} could not be read: ${message}`,
      }
    }
    cache.set(cacheKey, result)
    return result
  }

  return { prime, resolve }
}

/** Identifies a rule for deduplication: two bindings granting the same rule in
 *  the same scope collapse into one row naming both sources. */
function ruleIdentity(scope: string, rule: AccessRule): string {
  return JSON.stringify([
    scope,
    [...rule.apiGroups].sort(),
    [...rule.resources].sort(),
    [...rule.resourceNames].sort(),
    [...rule.verbs].sort(),
    [...rule.nonResourceURLs].sort(),
  ])
}

/** Cluster-wide grants first, then namespaces in name order: the widest grant
 *  is the one that decides what the subject can reach. */
function compareScope(a: string, b: string): number {
  if (a === b) return 0
  if (a === "*") return -1
  if (b === "*") return 1
  return a.localeCompare(b)
}

/**
 * What a subject can do, worked out the way RBAC grants it: every RoleBinding
 * and ClusterRoleBinding naming the subject — or naming a group it belongs to
 * without being listed, `system:authenticated` above all — resolved to the
 * rules of the role it references.
 *
 * This is the union RBAC grants, not the last word: a webhook or the Node
 * authorizer can allow more, so `checkAccess` stays the authority on any one
 * question.
 */
export async function getSubjectPermissions(
  api: RbacAuthorizationV1Api,
  subject: AccessSubject,
): Promise<SubjectPermissions> {
  const matchers = subjectMatchers(subject)
  const resolver = createRoleResolver(api)
  const [roleBindings, clusterRoleBindings] = await Promise.all([
    api.listRoleBindingForAllNamespaces(),
    api.listClusterRoleBinding(),
    resolver.prime(),
  ])

  const bindings: SubjectBinding[] = []

  async function collect(
    bindingKind: "RoleBinding" | "ClusterRoleBinding",
    binding: {
      metadata?: { name?: string; namespace?: string }
      roleRef?: { kind?: string; name?: string }
      subjects?: { kind?: string; name?: string; namespace?: string }[]
    },
  ): Promise<void> {
    const bindingNamespace = binding.metadata?.namespace ?? ""
    const listed = (binding.subjects ?? []).map((s) => ({
      kind: s.kind ?? "",
      name: s.name ?? "",
      namespace: s.namespace ?? "",
    }))
    const matcher = matchers.find((m) =>
      listed.some((s) => matchesSubject(s, m)),
    )
    if (!matcher) return
    const roleKind = binding.roleRef?.kind ?? ""
    const roleName = binding.roleRef?.name ?? ""
    const { rules, error } = await resolver.resolve(
      roleKind,
      roleName,
      bindingNamespace,
    )
    bindings.push({
      bindingKind,
      bindingName: binding.metadata?.name ?? "",
      bindingNamespace,
      roleKind,
      roleName,
      // A ClusterRoleBinding grants everywhere; a RoleBinding grants only in
      // its own namespace, even when it references a ClusterRole.
      scope: bindingKind === "ClusterRoleBinding" ? "*" : bindingNamespace,
      via:
        matcher.kind === "ServiceAccount"
          ? `ServiceAccount ${matcher.namespace}/${matcher.name}`
          : `${matcher.kind} ${matcher.name}`,
      rules,
      error,
    })
  }

  for (const binding of roleBindings.items) {
    await collect("RoleBinding", binding)
  }
  for (const binding of clusterRoleBindings.items) {
    await collect("ClusterRoleBinding", binding)
  }

  const merged = new Map<string, EffectiveAccessRule>()
  for (const binding of bindings) {
    const bindingRef = binding.bindingNamespace
      ? `${binding.bindingNamespace}/${binding.bindingName}`
      : binding.bindingName
    const source = `${binding.bindingKind} ${bindingRef} → ${binding.roleKind} ${binding.roleName}`
    for (const rule of binding.rules) {
      const id = ruleIdentity(binding.scope, rule)
      const existing = merged.get(id)
      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source)
        continue
      }
      merged.set(id, { ...rule, scope: binding.scope, sources: [source] })
    }
  }

  return {
    subject,
    bindings: bindings.sort(
      (a, b) =>
        compareScope(a.scope, b.scope) ||
        a.bindingName.localeCompare(b.bindingName),
    ),
    effectiveRules: [...merged.values()].sort((a, b) =>
      compareScope(a.scope, b.scope),
    ),
    incomplete: bindings.some((b) => b.error !== ""),
  }
}

/**
 * The other direction: which bindings reference a Role or ClusterRole, and who
 * they name. A ClusterRole is also counted where a RoleBinding references it,
 * which grants its rules inside that one namespace.
 */
export async function getRoleSubjects(
  api: RbacAuthorizationV1Api,
  role: { kind: "Role" | "ClusterRole"; name: string; namespace: string },
): Promise<RoleSubjectBinding[]> {
  const mapSubjects = (
    subjects:
      | { kind?: string; name?: string; namespace?: string }[]
      | undefined,
  ): RbacSubject[] =>
    (subjects ?? []).map((s) => ({
      kind: s.kind ?? "",
      name: s.name ?? "",
      namespace: s.namespace ?? "",
    }))

  const [roleBindings, clusterRoleBindings] = await Promise.all([
    api.listRoleBindingForAllNamespaces(),
    role.kind === "ClusterRole"
      ? api.listClusterRoleBinding()
      : Promise.resolve({ items: [] }),
  ])

  const result: RoleSubjectBinding[] = []
  for (const binding of roleBindings.items) {
    if (binding.roleRef?.kind !== role.kind) continue
    if (binding.roleRef?.name !== role.name) continue
    // A Role only exists inside its namespace, so a RoleBinding elsewhere
    // naming the same name references a different Role.
    if (
      role.kind === "Role" &&
      (binding.metadata?.namespace ?? "") !== role.namespace
    ) {
      continue
    }
    result.push({
      bindingKind: "RoleBinding",
      bindingName: binding.metadata?.name ?? "",
      bindingNamespace: binding.metadata?.namespace ?? "",
      subjects: mapSubjects(binding.subjects),
    })
  }
  for (const binding of clusterRoleBindings.items) {
    if (binding.roleRef?.name !== role.name) continue
    result.push({
      bindingKind: "ClusterRoleBinding",
      bindingName: binding.metadata?.name ?? "",
      bindingNamespace: "",
      subjects: mapSubjects(binding.subjects),
    })
  }
  return result
}
