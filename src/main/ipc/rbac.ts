import { IpcMain } from "electron"
import { RbacAuthorizationV1Api } from "@kubernetes/client-node"

import { AccessReviewRequest, AccessSubject } from "../handlers/types"
import {
  checkAccess,
  getClusterRole,
  getRole,
  getRoleSubjects,
  getSubjectPermissions,
  listClusterRoleBindings,
  listClusterRoles,
  listRoleBindings,
  listRoles,
  listSelfRules,
  updateClusterRole,
  updateClusterRoleBinding,
  updateRole,
  updateRoleBinding,
} from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerRbacHandlers(
  ipcMain: IpcMain,
  rbacV1Api: RbacAuthorizationV1Api,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle(
    "k8s:roles:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listRoles(getContextClients(args?.contextName).rbacV1, args?.namespace),
  )
  ipcMain.handle(
    "k8s:clusterroles:list",
    (_e, args?: { contextName?: string }) =>
      listClusterRoles(getContextClients(args?.contextName).rbacV1),
  )
  ipcMain.handle(
    "k8s:rolebindings:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listRoleBindings(
        getContextClients(args?.contextName).rbacV1,
        args?.namespace,
      ),
  )
  ipcMain.handle(
    "k8s:clusterrolebindings:list",
    (_e, args?: { contextName?: string }) =>
      listClusterRoleBindings(getContextClients(args?.contextName).rbacV1),
  )

  // The list handlers above return rule counts; these fetch the rules.
  ipcMain.handle(
    "k8s:role:get",
    (_e, args: { contextName?: string; namespace: string; name: string }) =>
      getRole(
        getContextClients(args.contextName).rbacV1,
        args.namespace,
        args.name,
      ),
  )
  ipcMain.handle(
    "k8s:clusterrole:get",
    (_e, args: { contextName?: string; name: string }) =>
      getClusterRole(getContextClients(args.contextName).rbacV1, args.name),
  )

  ipcMain.handle(
    "k8s:role:update",
    (
      _e,
      namespace: string,
      name: string,
      rules: Array<{
        apiGroups: string[]
        resources: string[]
        verbs: string[]
      }>,
    ) => updateRole(rbacV1Api, namespace, name, rules),
  )
  ipcMain.handle(
    "k8s:clusterrole:update",
    (
      _e,
      name: string,
      rules: Array<{
        apiGroups: string[]
        resources: string[]
        verbs: string[]
      }>,
    ) => updateClusterRole(rbacV1Api, name, rules),
  )
  ipcMain.handle(
    "k8s:rolebinding:update",
    (
      _e,
      namespace: string,
      name: string,
      subjects: Array<{ kind: string; name: string; namespace?: string }>,
    ) => updateRoleBinding(rbacV1Api, namespace, name, subjects),
  )
  ipcMain.handle(
    "k8s:clusterrolebinding:update",
    (
      _e,
      name: string,
      subjects: Array<{ kind: string; name: string; namespace?: string }>,
    ) => updateClusterRoleBinding(rbacV1Api, name, subjects),
  )

  // Access review. The first two are answered by the API server's authorizer,
  // the last two by walking the bindings ourselves.
  ipcMain.handle(
    "k8s:access:review",
    (_e, args: { contextName?: string; request: AccessReviewRequest }) =>
      checkAccess(
        getContextClients(args.contextName).authorizationV1,
        args.request,
      ),
  )
  ipcMain.handle(
    "k8s:access:selfrules",
    (_e, args: { contextName?: string; namespace: string }) =>
      listSelfRules(
        getContextClients(args.contextName).authorizationV1,
        args.namespace,
      ),
  )
  ipcMain.handle(
    "k8s:access:subject",
    (_e, args: { contextName?: string; subject: AccessSubject }) =>
      getSubjectPermissions(
        getContextClients(args.contextName).rbacV1,
        args.subject,
      ),
  )
  ipcMain.handle(
    "k8s:access:rolesubjects",
    (
      _e,
      args: {
        contextName?: string
        kind: "Role" | "ClusterRole"
        name: string
        namespace: string
      },
    ) =>
      getRoleSubjects(getContextClients(args.contextName).rbacV1, {
        kind: args.kind,
        name: args.name,
        namespace: args.namespace,
      }),
  )
}
