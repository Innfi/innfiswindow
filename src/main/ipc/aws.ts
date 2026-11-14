import { BrowserWindow } from "electron"

import type { AwsResourceKind, AwsRowByKind, AwsScope } from "../../shared/aws"
import type { ContextArgs } from "../../shared/ipc"
import { checkAwsCredentials } from "../aws-handlers"
import {
  awsInventory,
  getAwsInventoryConfig,
  setAwsInventoryChangeListener,
  setAwsInventoryDatabaseUrl,
} from "../aws-inventory"
import { parseEksClusterArn } from "../handlers/cluster"
import { GetKubeConfig } from "./context-clients"
import { sendToRenderer, TypedIpcMain } from "./typed-ipc"

export function registerAwsHandlers(
  ipcMain: TypedIpcMain,
  getKubeConfig: GetKubeConfig,
  getMainWindow: () => BrowserWindow | null,
): void {
  /**
   * The EKS account and region of `contextName`'s cluster, from its ARN;
   * null when the cluster name is not one. Read from the default kubeconfig,
   * which lists every context.
   */
  function scopeOf(contextName: string): AwsScope | null {
    const cluster = getKubeConfig().getContextObject(contextName)?.cluster
    const arn = cluster ? parseEksClusterArn(cluster) : null
    return arn ? { accountId: arn.awsAccountId, region: arn.awsRegion } : null
  }

  /** Snapshot reads only: `useK8sResource` polls these on every tick. */
  function lister<K extends AwsResourceKind>(kind: K) {
    return (_e: unknown, args?: ContextArgs): AwsRowByKind[K][] => {
      if (!args?.contextName) return awsInventory.list(kind)
      const scope = scopeOf(args.contextName)
      return scope ? awsInventory.list(kind, scope) : []
    }
  }

  setAwsInventoryChangeListener(() =>
    sendToRenderer(
      getMainWindow()?.webContents,
      "aws:inventory:changed",
      awsInventory.getStatus(),
    ),
  )

  ipcMain.handle("aws:credentials:check", () => checkAwsCredentials())
  ipcMain.handle("aws:config:get", () => getAwsInventoryConfig())
  ipcMain.handle("aws:config:set", (_e, { databaseUrl }) =>
    setAwsInventoryDatabaseUrl(databaseUrl),
  )

  ipcMain.handle("aws:inventory:status", (_e, args) => {
    const contextName = args?.contextName
    if (!contextName) return awsInventory.getStatus()
    return awsInventory.getStatus({
      contextName,
      scope: scopeOf(contextName) ?? undefined,
    })
  })
  ipcMain.handle("aws:inventory:scan", () => {
    awsInventory.startScan()
    return awsInventory.getStatus()
  })
  ipcMain.handle("aws:inventory:cancel", () => {
    awsInventory.cancelScan()
    return awsInventory.getStatus()
  })

  ipcMain.handle("aws:vpcs:list", lister("vpcs"))
  ipcMain.handle("aws:subnets:list", lister("subnets"))
  ipcMain.handle("aws:routetables:list", lister("routeTables"))
  ipcMain.handle("aws:natgateways:list", lister("natGateways"))
  ipcMain.handle("aws:internetgateways:list", lister("internetGateways"))
  ipcMain.handle("aws:egressonlygateways:list", lister("egressOnlyGateways"))
  ipcMain.handle("aws:transitgateways:list", lister("transitGateways"))
  ipcMain.handle("aws:iamprincipals:list", lister("iamPrincipals"))
}
