// Access review — what a `kubectl auth can-i` question is made of, and which
// binding subjects a given subject is reached by. Shared so the dialogs, the
// handlers, and the tests read a subject the same way.

import { AccessSubject, RbacSubject } from "./k8s"

/** The verbs the API server understands, plus the wildcard a rule can carry.
 *  `impersonate`, `bind` and `escalate` are real verbs too, but they only
 *  appear on the RBAC resources themselves. */
export const ACCESS_VERBS = [
  "get",
  "list",
  "watch",
  "create",
  "update",
  "patch",
  "delete",
  "deletecollection",
  "*",
] as const

/** Resource names offered as suggestions in the review form. Not a closed set
 *  — the field takes any plural, including a CRD's. */
export const COMMON_RESOURCES = [
  "pods",
  "pods/log",
  "pods/exec",
  "deployments",
  "statefulsets",
  "daemonsets",
  "replicasets",
  "jobs",
  "cronjobs",
  "services",
  "ingresses",
  "configmaps",
  "secrets",
  "serviceaccounts",
  "namespaces",
  "nodes",
  "persistentvolumeclaims",
  "roles",
  "rolebindings",
  "clusterroles",
  "clusterrolebindings",
  "events",
] as const

/** The username the API server sees for a ServiceAccount's token. */
export function serviceAccountUsername(
  namespace: string,
  name: string,
): string {
  return `system:serviceaccount:${namespace}:${name}`
}

/** Groups a subject carries without any binding naming them. A ServiceAccount
 *  is in the all-service-accounts group and its namespace's, and every
 *  authenticated request is in `system:authenticated` — which is where a
 *  surprising amount of read access (discovery, for one) actually comes from.
 *  Anonymous requests are `system:unauthenticated` instead, so a User typed in
 *  by hand is assumed authenticated. */
export function implicitGroups(subject: AccessSubject): string[] {
  if (subject.kind === "ServiceAccount") {
    return [
      "system:serviceaccounts",
      `system:serviceaccounts:${subject.namespace}`,
      "system:authenticated",
    ]
  }
  if (subject.kind === "User") return ["system:authenticated"]
  return []
}

/** Every binding subject that grants to `subject`: the subject itself, then
 *  the groups it belongs to implicitly. */
export function subjectMatchers(subject: AccessSubject): RbacSubject[] {
  const self: RbacSubject = {
    kind: subject.kind === "current-user" ? "User" : subject.kind,
    name: subject.name,
    namespace: subject.kind === "ServiceAccount" ? subject.namespace : "",
  }
  return [
    self,
    ...implicitGroups(subject).map((name) => ({
      kind: "Group",
      name,
      namespace: "",
    })),
  ]
}

/** Whether a subject listed on a binding is the one being looked up. A
 *  ServiceAccount is only the same account when the namespace matches too. */
export function matchesSubject(
  bindingSubject: RbacSubject,
  matcher: RbacSubject,
): boolean {
  if (bindingSubject.kind !== matcher.kind) return false
  if (bindingSubject.name !== matcher.name) return false
  if (matcher.kind !== "ServiceAccount") return true
  return (bindingSubject.namespace ?? "") === matcher.namespace
}

/** How a subject reads in a header or a source line. */
export function formatSubject(subject: AccessSubject): string {
  if (subject.kind === "current-user") return "current user"
  if (subject.kind === "ServiceAccount") {
    return `ServiceAccount ${subject.namespace}/${subject.name}`
  }
  return `${subject.kind} ${subject.name}`
}

/** A message naming what is wrong with the subject, or null when it is fine. */
export function validateSubject(subject: AccessSubject): string | null {
  if (subject.kind === "current-user") return null
  if (subject.name.trim() === "") return `A ${subject.kind} needs a name.`
  if (subject.kind === "ServiceAccount" && subject.namespace.trim() === "") {
    return "A ServiceAccount needs the namespace it lives in."
  }
  return null
}

/** What the access review form must have filled in before it can be run. */
export function validateAccessRequest(request: {
  subject: AccessSubject
  verb: string
  resource: string
  nonResourceURL: string
}): string | null {
  const subjectProblem = validateSubject(request.subject)
  if (subjectProblem) return subjectProblem
  if (request.verb.trim() === "") return "Pick a verb."
  if (request.nonResourceURL.trim() !== "") {
    if (!request.nonResourceURL.startsWith("/")) {
      return "A non-resource URL is a path — it starts with a slash, like /healthz."
    }
    return null
  }
  if (request.resource.trim() === "") {
    return "Name a resource (the plural, like pods) or a non-resource URL."
  }
  return null
}

/** The `kubectl auth can-i` invocation the review is equivalent to, shown so
 *  the answer can be checked against kubectl itself. */
export function canICommand(request: {
  subject: AccessSubject
  verb: string
  group: string
  resource: string
  subresource: string
  name: string
  namespace: string
  nonResourceURL: string
}): string {
  const parts = ["kubectl", "auth", "can-i", request.verb]
  if (request.nonResourceURL.trim() !== "") {
    parts.push(request.nonResourceURL)
  } else {
    let target = request.resource
    if (request.group) target += `.${request.group}`
    if (request.name) target += `/${request.name}`
    parts.push(target)
    if (request.subresource) parts.push(`--subresource=${request.subresource}`)
  }
  if (request.namespace) parts.push(`-n ${request.namespace}`)
  else parts.push("--all-namespaces")
  if (request.subject.kind === "ServiceAccount") {
    parts.push(
      `--as=${serviceAccountUsername(request.subject.namespace, request.subject.name)}`,
    )
  } else if (request.subject.kind === "User") {
    parts.push(`--as=${request.subject.name}`)
  } else if (request.subject.kind === "Group") {
    parts.push(`--as-group=${request.subject.name}`)
  }
  return parts.join(" ")
}
