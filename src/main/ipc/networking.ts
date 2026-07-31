import { IpcMain } from "electron"
import { CoreV1Api, NetworkingV1Api } from "@kubernetes/client-node"

import {
  createIngress,
  createService,
  listEndpoints,
  listIngresses,
  listNetworkPolicies,
  listServices,
  replaceIngressFromYaml,
  replaceServiceFromYaml,
} from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerNetworkingHandlers(
  ipcMain: IpcMain,
  coreV1Api: CoreV1Api,
  networkingV1Api: NetworkingV1Api,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle(
    "k8s:services:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listServices(
        getContextClients(args?.contextName).coreV1,
        args?.namespace,
      ),
  )
  ipcMain.handle(
    "k8s:ingresses:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listIngresses(
        getContextClients(args?.contextName).networkingV1,
        args?.namespace,
      ),
  )
  ipcMain.handle(
    "k8s:networkpolicies:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listNetworkPolicies(
        getContextClients(args?.contextName).networkingV1,
        args?.namespace,
      ),
  )
  ipcMain.handle(
    "k8s:endpoints:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listEndpoints(
        getContextClients(args?.contextName).coreV1,
        args?.namespace,
      ),
  )

  ipcMain.handle(
    "k8s:service:create",
    (
      _e,
      namespace: string,
      name: string,
      type: string,
      ports: Array<{
        protocol: string
        port: number
        targetPort: number | string
      }>,
      selector: Record<string, string>,
    ) => createService(coreV1Api, namespace, name, type, ports, selector),
  )
  ipcMain.handle(
    "k8s:service:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceServiceFromYaml(coreV1Api, namespace, name, yaml),
  )

  ipcMain.handle(
    "k8s:ingress:create",
    (
      _e,
      namespace: string,
      name: string,
      ingressClassName: string,
      rules: Array<{
        host: string
        path: string
        pathType: string
        serviceName: string
        servicePort: number | string
      }>,
      tls: Array<{ hosts: string[]; secretName: string }>,
    ) =>
      createIngress(
        networkingV1Api,
        namespace,
        name,
        ingressClassName,
        rules,
        tls,
      ),
  )
  ipcMain.handle(
    "k8s:ingress:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceIngressFromYaml(networkingV1Api, namespace, name, yaml),
  )
}
