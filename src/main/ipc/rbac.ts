import { IpcMain } from "electron"
import { RbacAuthorizationV1Api } from "@kubernetes/client-node"

import {
  getClusterRole,
  getRole,
  listClusterRoleBindings,
  listClusterRoles,
  listRoleBindings,
  listRoles,
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
}
