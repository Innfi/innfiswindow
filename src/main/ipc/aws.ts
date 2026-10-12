import { checkAwsCredentials } from "../aws-handlers"

export function registerAwsHandlers(ipcMain: TypedIpcMain): void {
  ipcMain.handle("aws:credentials:check", () => checkAwsCredentials())
}
import { TypedIpcMain } from "./typed-ipc"
