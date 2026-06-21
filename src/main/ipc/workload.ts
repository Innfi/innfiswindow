import { IpcMain } from "electron"
import { AppsV1Api, CoreV1Api } from "@kubernetes/client-node"

import {
  createDaemonSet,
  createDeployment,
  createStatefulSet,
  deleteDaemonSet,
  deleteDeployment,
  deletePod,
  deleteStatefulSet,
  listDaemonSets,
  listDeploymentHistory,
  listDeployments,
  listPods,
  listReplicaSets,
  listStatefulSets,
  replaceDaemonSetFromYaml,
  replaceDeploymentFromYaml,
  replaceStatefulSetFromYaml,
  rollbackDeployment,
} from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerWorkloadHandlers(
  ipcMain: IpcMain,
  appsV1Api: AppsV1Api,
  coreV1Api: CoreV1Api,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle(
    "k8s:deployments:list",
    (_e, args?: { contextName?: string }) =>
      listDeployments(getContextClients(args?.contextName).appsV1),
  )
  ipcMain.handle(
    "k8s:replicasets:list",
    (_e, args?: { contextName?: string }) =>
      listReplicaSets(getContextClients(args?.contextName).appsV1),
  )
  ipcMain.handle("k8s:pods:list", (_e, args?: { contextName?: string }) =>
    listPods(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:daemonsets:list", (_e, args?: { contextName?: string }) =>
    listDaemonSets(getContextClients(args?.contextName).appsV1),
  )
  ipcMain.handle(
    "k8s:statefulsets:list",
    (_e, args?: { contextName?: string }) =>
      listStatefulSets(getContextClients(args?.contextName).appsV1),
  )

  ipcMain.handle(
    "k8s:deployment:create",
    (_e, namespace: string, name: string, image: string, replicas: number) =>
      createDeployment(appsV1Api, namespace, name, image, replicas),
  )
  ipcMain.handle(
    "k8s:deployment:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceDeploymentFromYaml(appsV1Api, namespace, name, yaml),
  )
  ipcMain.handle(
    "k8s:deployment:delete",
    (_e, namespace: string, name: string) =>
      deleteDeployment(appsV1Api, namespace, name),
  )
  ipcMain.handle(
    "k8s:deployment:history",
    (
      _e,
      args: {
        contextName?: string
        namespace: string
        name: string
        selector: Record<string, string>
      },
    ) =>
      listDeploymentHistory(
        getContextClients(args.contextName).appsV1,
        args.namespace,
        args.name,
        args.selector,
      ),
  )
  ipcMain.handle(
    "k8s:deployment:rollback",
    (
      _e,
      args: {
        contextName?: string
        namespace: string
        name: string
        revision: number
      },
    ) =>
      rollbackDeployment(
        getContextClients(args.contextName).appsV1,
        args.namespace,
        args.name,
        args.revision,
      ),
  )

  ipcMain.handle(
    "k8s:statefulset:create",
    (
      _e,
      namespace: string,
      name: string,
      image: string,
      replicas: number,
      serviceName: string,
    ) =>
      createStatefulSet(
        appsV1Api,
        namespace,
        name,
        image,
        replicas,
        serviceName,
      ),
  )
  ipcMain.handle(
    "k8s:statefulset:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceStatefulSetFromYaml(appsV1Api, namespace, name, yaml),
  )
  ipcMain.handle(
    "k8s:statefulset:delete",
    (_e, namespace: string, name: string) =>
      deleteStatefulSet(appsV1Api, namespace, name),
  )

  ipcMain.handle(
    "k8s:daemonset:create",
    (_e, namespace: string, name: string, image: string) =>
      createDaemonSet(appsV1Api, namespace, name, image),
  )
  ipcMain.handle(
    "k8s:daemonset:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceDaemonSetFromYaml(appsV1Api, namespace, name, yaml),
  )
  ipcMain.handle(
    "k8s:daemonset:delete",
    (_e, namespace: string, name: string) =>
      deleteDaemonSet(appsV1Api, namespace, name),
  )

  ipcMain.handle("k8s:pod:delete", (_e, namespace: string, name: string) =>
    deletePod(coreV1Api, namespace, name),
  )
}
