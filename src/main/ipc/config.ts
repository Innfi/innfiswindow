import { IpcMain } from "electron"
import { CoreV1Api } from "@kubernetes/client-node"

import {
  deleteConfigMap,
  deleteSecret,
  deleteServiceAccount,
  listConfigMaps,
  listSecrets,
  listServiceAccounts,
  replaceConfigMapFromYaml,
  replaceSecretFromYaml,
  updateServiceAccount,
} from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerConfigHandlers(
  ipcMain: IpcMain,
  coreV1Api: CoreV1Api,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle("k8s:configmaps:list", (_e, args?: { contextName?: string }) =>
    listConfigMaps(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:secrets:list", (_e, args?: { contextName?: string }) =>
    listSecrets(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle(
    "k8s:serviceaccounts:list",
    (_e, args?: { contextName?: string }) =>
      listServiceAccounts(getContextClients(args?.contextName).coreV1),
  )

  ipcMain.handle(
    "k8s:serviceaccount:update",
    (
      _e,
      namespace: string,
      name: string,
      metadata: {
        labels?: Record<string, string>
        annotations?: Record<string, string>
      },
    ) => updateServiceAccount(coreV1Api, namespace, name, metadata),
  )
  ipcMain.handle(
    "k8s:serviceaccount:delete",
    (_e, namespace: string, name: string) =>
      deleteServiceAccount(coreV1Api, namespace, name),
  )

  ipcMain.handle(
    "k8s:configmap:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceConfigMapFromYaml(coreV1Api, namespace, name, yaml),
  )
  ipcMain.handle(
    "k8s:configmap:delete",
    (_e, namespace: string, name: string) =>
      deleteConfigMap(coreV1Api, namespace, name),
  )

  ipcMain.handle(
    "k8s:secret:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceSecretFromYaml(coreV1Api, namespace, name, yaml),
  )
  ipcMain.handle("k8s:secret:delete", (_e, namespace: string, name: string) =>
    deleteSecret(coreV1Api, namespace, name),
  )
}
