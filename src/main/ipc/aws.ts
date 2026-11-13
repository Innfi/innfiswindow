import { checkAwsCredentials } from "../aws-handlers"
import {
  getAwsInventoryConfig,
  setAwsInventoryDatabaseUrl,
} from "../aws-inventory"
import { TypedIpcMain } from "./typed-ipc"

export function registerAwsHandlers(ipcMain: TypedIpcMain): void {
  ipcMain.handle("aws:credentials:check", () => checkAwsCredentials())
  ipcMain.handle("aws:config:get", () => getAwsInventoryConfig())
  ipcMain.handle("aws:config:set", (_e, { databaseUrl }) =>
    setAwsInventoryDatabaseUrl(databaseUrl),
  )
}
