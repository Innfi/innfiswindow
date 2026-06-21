import { IpcMain } from "electron"

import { checkAwsCredentials } from "../aws-handlers"

export function registerAwsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("aws:credentials:check", () => checkAwsCredentials())
}
