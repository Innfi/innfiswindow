import { describe, expect, test } from "vitest"
import {
  AuthorizationV1Api,
  RbacAuthorizationV1Api,
} from "@kubernetes/client-node"

import { canICommand, subjectMatchers } from "../../shared/access"
import {
  checkAccess,
  getRoleSubjects,
  getSubjectPermissions,
  listSelfRules,
} from "../handlers/rbac"

// The access review is the body it sends and the walk it does over the
// bindings; a kind cluster would answer the same questions but tells us
// nothing about how the request was shaped.
type Call = { method: string; body: unknown }

function authStub(status: Record<string, unknown>): {
  calls: Call[]
  api: AuthorizationV1Api
} {
  const calls: Call[] = []
  const record =
    (method: string) =>
    (param: { body: unknown }): Promise<unknown> => {
      calls.push({ method, body: param.body })
      return Promise.resolve({ status })
    }
  const api = {
    createSelfSubjectAccessReview: record("createSelfSubjectAccessReview"),
    createSubjectAccessReview: record("createSubjectAccessReview"),
    createSelfSubjectRulesReview: record("createSelfSubjectRulesReview"),
  } as unknown as AuthorizationV1Api
  return { calls, api }
}

const BASE_REQUEST = {
  verb: "get",
  group: "",
  resource: "pods",
  subresource: "",
  name: "",
  namespace: "prod",
  nonResourceURL: "",
}

describe("checkAccess", () => {
  test("asks about the current user without impersonating anyone", async () => {
    const { calls, api } = authStub({ allowed: true, reason: "RBAC: allowed" })
    const result = await checkAccess(api, {
      ...BASE_REQUEST,
      subject: { kind: "current-user", name: "", namespace: "" },
    })

    expect(calls[0].method).toBe("createSelfSubjectAccessReview")
    expect(calls[0].body).toEqual({
      spec: {
        resourceAttributes: {
          namespace: "prod",
          verb: "get",
          group: "",
          resource: "pods",
        },
      },
    })
    expect(result.allowed).toBe(true)
    expect(result.reviewKind).toBe("SelfSubjectAccessReview")
  })

  test("impersonates a ServiceAccount as its username plus its groups", async () => {
    const { calls, api } = authStub({ allowed: false, denied: true })
    const result = await checkAccess(api, {
      ...BASE_REQUEST,
      subject: { kind: "ServiceAccount", name: "builder", namespace: "ci" },
    })

    expect(calls[0].method).toBe("createSubjectAccessReview")
    expect(calls[0].body).toEqual({
      spec: {
        resourceAttributes: {
          namespace: "prod",
          verb: "get",
          group: "",
          resource: "pods",
        },
        user: "system:serviceaccount:ci:builder",
        groups: [
          "system:serviceaccounts",
          "system:serviceaccounts:ci",
          "system:authenticated",
        ],
      },
    })
    expect(result.allowed).toBe(false)
    expect(result.denied).toBe(true)
    expect(result.checkedAs).toBe("system:serviceaccount:ci:builder")
  })

  test("an empty namespace is left off, so the question spans all of them", async () => {
    const { calls, api } = authStub({ allowed: true })
    await checkAccess(api, {
      ...BASE_REQUEST,
      namespace: "",
      subject: { kind: "current-user", name: "", namespace: "" },
    })

    const spec = (calls[0].body as { spec: { resourceAttributes: object } })
      .spec
    expect(spec.resourceAttributes).not.toHaveProperty("namespace")
  })

  test("a non-resource URL replaces the resource attributes", async () => {
    const { calls, api } = authStub({ allowed: true })
    await checkAccess(api, {
      ...BASE_REQUEST,
      nonResourceURL: "/healthz",
      subject: { kind: "User", name: "alice", namespace: "" },
    })

    expect(calls[0].body).toEqual({
      spec: {
        nonResourceAttributes: { path: "/healthz", verb: "get" },
        user: "alice",
        groups: ["system:authenticated"],
      },
    })
  })
})

test("listSelfRules maps both rule kinds and the incomplete flag", async () => {
  const { calls, api } = authStub({
    incomplete: true,
    evaluationError: "no opinion",
    resourceRules: [{ verbs: ["get"], resources: ["pods"] }],
    nonResourceRules: [{ verbs: ["get"], nonResourceURLs: ["/healthz"] }],
  })
  const result = await listSelfRules(api, "prod")

  expect(calls[0].body).toEqual({ spec: { namespace: "prod" } })
  expect(result.incomplete).toBe(true)
  expect(result.resourceRules[0]).toEqual({
    apiGroups: [],
    resources: ["pods"],
    resourceNames: [],
    verbs: ["get"],
    nonResourceURLs: [],
  })
  expect(result.nonResourceRules[0].nonResourceURLs).toEqual(["/healthz"])
})

function rbacStub(fixture: {
  roleBindings?: unknown[]
  clusterRoleBindings?: unknown[]
  roles?: unknown[]
  clusterRoles?: unknown[]
  /** Makes the bulk role lists fail, as a namespace-scoped user would see. */
  refuseRoleLists?: boolean
}): RbacAuthorizationV1Api {
  const reject = (): Promise<never> =>
    Promise.reject(new Error("roles is forbidden"))
  return {
    listRoleBindingForAllNamespaces: () =>
      Promise.resolve({ items: fixture.roleBindings ?? [] }),
    listClusterRoleBinding: () =>
      Promise.resolve({ items: fixture.clusterRoleBindings ?? [] }),
    listRoleForAllNamespaces: fixture.refuseRoleLists
      ? reject
      : () => Promise.resolve({ items: fixture.roles ?? [] }),
    listClusterRole: fixture.refuseRoleLists
      ? reject
      : () => Promise.resolve({ items: fixture.clusterRoles ?? [] }),
    readNamespacedRole: ({ name, namespace }) => {
      const role = (fixture.roles ?? []).find(
        (r) =>
          (r as { metadata: { name: string; namespace: string } }).metadata
            .name === name &&
          (r as { metadata: { name: string; namespace: string } }).metadata
            .namespace === namespace,
      )
      return role
        ? Promise.resolve(role)
        : Promise.reject(new Error("roles not found"))
    },
    readClusterRole: ({ name }) => {
      const role = (fixture.clusterRoles ?? []).find(
        (r) => (r as { metadata: { name: string } }).metadata.name === name,
      )
      return role
        ? Promise.resolve(role)
        : Promise.reject(new Error("clusterroles not found"))
    },
  } as unknown as RbacAuthorizationV1Api
}

const READER_ROLE = {
  metadata: { name: "reader", namespace: "prod" },
  rules: [{ apiGroups: [""], resources: ["pods"], verbs: ["get", "list"] }],
}

const DISCOVERY_CLUSTER_ROLE = {
  metadata: { name: "system:discovery" },
  rules: [{ nonResourceURLs: ["/api"], verbs: ["get"] }],
}

const SA_BINDING = {
  metadata: { name: "reader-binding", namespace: "prod" },
  roleRef: { kind: "Role", name: "reader" },
  subjects: [{ kind: "ServiceAccount", name: "builder", namespace: "ci" }],
}

const AUTHENTICATED_BINDING = {
  metadata: { name: "discovery" },
  roleRef: { kind: "ClusterRole", name: "system:discovery" },
  subjects: [{ kind: "Group", name: "system:authenticated" }],
}

describe("getSubjectPermissions", () => {
  test("follows both a direct binding and one reaching an implicit group", async () => {
    const api = rbacStub({
      roleBindings: [SA_BINDING],
      clusterRoleBindings: [AUTHENTICATED_BINDING],
      roles: [READER_ROLE],
      clusterRoles: [DISCOVERY_CLUSTER_ROLE],
    })
    const result = await getSubjectPermissions(api, {
      kind: "ServiceAccount",
      name: "builder",
      namespace: "ci",
    })

    expect(result.incomplete).toBe(false)
    expect(result.bindings.map((b) => b.bindingName)).toEqual([
      "discovery",
      "reader-binding",
    ])
    const direct = result.bindings.find(
      (b) => b.bindingName === "reader-binding",
    )
    expect(direct?.scope).toBe("prod")
    expect(direct?.via).toBe("ServiceAccount ci/builder")
    const viaGroup = result.bindings.find((b) => b.bindingName === "discovery")
    // A ClusterRoleBinding grants everywhere, whoever it reached the subject by.
    expect(viaGroup?.scope).toBe("*")
    expect(viaGroup?.via).toBe("Group system:authenticated")
    // Cluster-wide rules sort ahead of the namespaced one.
    expect(result.effectiveRules[0].scope).toBe("*")
    expect(result.effectiveRules[1].resources).toEqual(["pods"])
  })

  test("a ServiceAccount of the same name in another namespace is a different subject", async () => {
    const api = rbacStub({ roleBindings: [SA_BINDING], roles: [READER_ROLE] })
    const result = await getSubjectPermissions(api, {
      kind: "ServiceAccount",
      name: "builder",
      namespace: "other",
    })

    expect(result.bindings).toEqual([])
    expect(result.effectiveRules).toEqual([])
  })

  test("two bindings granting the same rule collapse into one row naming both", async () => {
    const api = rbacStub({
      roleBindings: [
        SA_BINDING,
        { ...SA_BINDING, metadata: { name: "second", namespace: "prod" } },
      ],
      roles: [READER_ROLE],
    })
    const result = await getSubjectPermissions(api, {
      kind: "ServiceAccount",
      name: "builder",
      namespace: "ci",
    })

    expect(result.effectiveRules).toHaveLength(1)
    expect(result.effectiveRules[0].sources).toHaveLength(2)
  })

  test("a role that cannot be read becomes an error on its binding", async () => {
    const api = rbacStub({
      roleBindings: [SA_BINDING],
      roles: [],
      refuseRoleLists: true,
    })
    const result = await getSubjectPermissions(api, {
      kind: "ServiceAccount",
      name: "builder",
      namespace: "ci",
    })

    expect(result.incomplete).toBe(true)
    expect(result.bindings[0].rules).toEqual([])
    expect(result.bindings[0].error).toContain("Role reader could not be read")
  })
})

describe("getRoleSubjects", () => {
  test("a RoleBinding in another namespace references a different Role", async () => {
    const api = rbacStub({
      roleBindings: [
        SA_BINDING,
        {
          ...SA_BINDING,
          metadata: { name: "elsewhere", namespace: "staging" },
        },
      ],
    })
    const result = await getRoleSubjects(api, {
      kind: "Role",
      name: "reader",
      namespace: "prod",
    })

    expect(result).toHaveLength(1)
    expect(result[0].bindingName).toBe("reader-binding")
    expect(result[0].subjects[0].name).toBe("builder")
  })

  test("a ClusterRole counts the RoleBindings that reference it too", async () => {
    const api = rbacStub({
      roleBindings: [
        {
          metadata: { name: "local-view", namespace: "prod" },
          roleRef: { kind: "ClusterRole", name: "view" },
          subjects: [{ kind: "User", name: "alice" }],
        },
      ],
      clusterRoleBindings: [
        {
          metadata: { name: "global-view" },
          roleRef: { kind: "ClusterRole", name: "view" },
          subjects: [{ kind: "Group", name: "devs" }],
        },
      ],
    })
    const result = await getRoleSubjects(api, {
      kind: "ClusterRole",
      name: "view",
      namespace: "",
    })

    expect(result.map((b) => b.bindingKind)).toEqual([
      "RoleBinding",
      "ClusterRoleBinding",
    ])
  })
})

describe("shared access helpers", () => {
  test("a ServiceAccount is matched by its own subject and by its groups", () => {
    expect(
      subjectMatchers({
        kind: "ServiceAccount",
        name: "builder",
        namespace: "ci",
      }),
    ).toEqual([
      { kind: "ServiceAccount", name: "builder", namespace: "ci" },
      { kind: "Group", name: "system:serviceaccounts", namespace: "" },
      { kind: "Group", name: "system:serviceaccounts:ci", namespace: "" },
      { kind: "Group", name: "system:authenticated", namespace: "" },
    ])
  })

  test("the shown command is the kubectl one the review stands in for", () => {
    expect(
      canICommand({
        subject: { kind: "ServiceAccount", name: "builder", namespace: "ci" },
        verb: "create",
        group: "apps",
        resource: "deployments",
        subresource: "",
        name: "",
        namespace: "prod",
        nonResourceURL: "",
      }),
    ).toBe(
      "kubectl auth can-i create deployments.apps -n prod --as=system:serviceaccount:ci:builder",
    )
    expect(
      canICommand({
        subject: { kind: "current-user", name: "", namespace: "" },
        verb: "get",
        group: "",
        resource: "pods",
        subresource: "log",
        name: "nginx",
        namespace: "",
        nonResourceURL: "",
      }),
    ).toBe(
      "kubectl auth can-i get pods/nginx --subresource=log --all-namespaces",
    )
  })
})
