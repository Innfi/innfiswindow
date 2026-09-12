import { IpcMain } from "electron"

import {
  getMutatingWebhookConfiguration,
  getValidatingWebhookConfiguration,
  listLimitRanges,
  listMutatingWebhookConfigurations,
  listPDBs,
  listPriorityClasses,
  listResourceQuotas,
  listValidatingWebhookConfigurations,
} from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerGovernanceHandlers(
  ipcMain: IpcMain,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle(
    "k8s:resourcequotas:list",
    (
      _e,
      args?: {
        contextName?: string
        namespace?: string
        labelSelector?: string
      },
    ) =>
      listResourceQuotas(
        getContextClients(args?.contextName).coreV1,
        args?.namespace,
        args?.labelSelector,
      ),
  )
  ipcMain.handle(
    "k8s:limitranges:list",
    (
      _e,
      args?: {
        contextName?: string
        namespace?: string
        labelSelector?: string
      },
    ) =>
      listLimitRanges(
        getContextClients(args?.contextName).coreV1,
        args?.namespace,
        args?.labelSelector,
      ),
  )
  ipcMain.handle(
    "k8s:pdbs:list",
    (
      _e,
      args?: {
        contextName?: string
        namespace?: string
        labelSelector?: string
      },
    ) =>
      listPDBs(
        getContextClients(args?.contextName).policyV1,
        args?.namespace,
        args?.labelSelector,
      ),
  )
  ipcMain.handle(
    "k8s:priorityclasses:list",
    (_e, args?: { contextName?: string; labelSelector?: string }) =>
      listPriorityClasses(
        getContextClients(args?.contextName).schedulingV1,
        args?.labelSelector,
      ),
  )
  ipcMain.handle(
    "k8s:validatingwebhookconfigurations:list",
    (_e, args?: { contextName?: string; labelSelector?: string }) =>
      listValidatingWebhookConfigurations(
        getContextClients(args?.contextName).admissionregistrationV1,
        args?.labelSelector,
      ),
  )
  ipcMain.handle(
    "k8s:validatingwebhookconfiguration:get",
    (_e, args: { contextName?: string; name: string }) =>
      getValidatingWebhookConfiguration(
        getContextClients(args?.contextName).admissionregistrationV1,
        args.name,
      ),
  )
  ipcMain.handle(
    "k8s:mutatingwebhookconfigurations:list",
    (_e, args?: { contextName?: string; labelSelector?: string }) =>
      listMutatingWebhookConfigurations(
        getContextClients(args?.contextName).admissionregistrationV1,
        args?.labelSelector,
      ),
  )
  ipcMain.handle(
    "k8s:mutatingwebhookconfiguration:get",
    (_e, args: { contextName?: string; name: string }) =>
      getMutatingWebhookConfiguration(
        getContextClients(args?.contextName).admissionregistrationV1,
        args.name,
      ),
  )
}
