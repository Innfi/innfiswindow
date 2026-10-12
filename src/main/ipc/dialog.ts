import { BrowserWindow, dialog } from "electron"

import type { SelectPathResult } from "../../shared/ipc"

export function registerDialogHandlers(
  ipcMain: TypedIpcMain,
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle(
    "dialog:path:select",
    async (
      _e,
      args: { mode: "file" | "directory"; title?: string },
    ): Promise<SelectPathResult> => {
      const parent = getMainWindow()
      const options: Electron.OpenDialogOptions = {
        title: args.title,
        properties: [
          args.mode === "file" ? "openFile" : "openDirectory",
          "dontAddToRecent",
        ],
      }
      // Modal to the app window when there is one, so the picker can't end up
      // behind it.
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0)
        return { path: null }
      return { path: result.filePaths[0] }
    },
  )
}
import { TypedIpcMain } from "./typed-ipc"
