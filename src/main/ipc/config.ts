import { IpcMain } from "electron"
import { CoreV1Api } from "@kubernetes/client-node"

import {
  getConfigMap,
  getSecret,
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
  ipcMain.handle(
    "k8s:configmaps:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listConfigMaps(
        getContextClients(args?.contextName).coreV1,
        args?.namespace,
      ),
  )
  ipcMain.handle(
    "k8s:secrets:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listSecrets(getContextClients(args?.contextName).coreV1, args?.namespace),
  )
  ipcMain.handle(
    "k8s:serviceaccounts:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listServiceAccounts(
        getContextClients(args?.contextName).coreV1,
        args?.namespace,
      ),
  )

  // Only these fetch `data`; the list handlers above return key names alone.
  ipcMain.handle(
    "k8s:configmap:get",
    (_e, args: { contextName?: string; namespace: string; name: string }) =>
      getConfigMap(
        getContextClients(args.contextName).coreV1,
        args.namespace,
        args.name,
      ),
  )
  ipcMain.handle(
    "k8s:secret:get",
    (_e, args: { contextName?: string; namespace: string; name: string }) =>
      getSecret(
        getContextClients(args.contextName).coreV1,
        args.namespace,
        args.name,
      ),
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
    "k8s:configmap:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceConfigMapFromYaml(coreV1Api, namespace, name, yaml),
  )

  ipcMain.handle(
    "k8s:secret:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceSecretFromYaml(coreV1Api, namespace, name, yaml),
  )
}
