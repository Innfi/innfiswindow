import { IpcMain } from "electron"

import { WatchStartArgs } from "../../shared/watch"
import {
  InformerDeps,
  isWatchResource,
  startWatch,
  stopWatch,
} from "../informers"

export function registerWatchHandlers(
  ipcMain: IpcMain,
  deps: InformerDeps,
): void {
  // Rejects when the watch can't be established; the renderer treats that as
  // "poll instead" rather than as an error to show.
  ipcMain.handle("k8s:watch:start", (e, args: WatchStartArgs) => {
    if (!isWatchResource(args?.resource)) {
      throw new Error(`Cannot watch ${String(args?.resource)}`)
    }
    return startWatch(deps, args, e.sender)
  })

  ipcMain.handle("k8s:watch:stop", (_e, args: { subId: string }) => {
    stopWatch(args.subId)
    return { success: true }
  })
}
