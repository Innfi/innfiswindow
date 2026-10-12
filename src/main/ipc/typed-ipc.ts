import { IpcMainEvent, IpcMainInvokeEvent, WebContents } from "electron"

import {
  IpcEventChannel,
  IpcEventMap,
  IpcInvokeArgs,
  IpcInvokeChannel,
  IpcInvokeResult,
  IpcSendChannel,
  IpcSendMap,
} from "../../shared/ipc"

/**
 * `ipcMain` narrowed to the channels in `src/shared/ipc.ts`: a handler for a
 * channel the map does not name, one that reads arguments the renderer does
 * not send, or one that answers with another shape does not compile. Plain
 * `ipcMain` (and the `withAuthRetry` wrapper) is assignable to it.
 */
export interface TypedIpcMain {
  handle<C extends IpcInvokeChannel>(
    channel: C,
    listener: (
      event: IpcMainInvokeEvent,
      ...args: IpcInvokeArgs<C>
    ) => IpcInvokeResult<C> | Promise<IpcInvokeResult<C>>,
  ): void
  on<C extends IpcSendChannel>(
    channel: C,
    listener: (event: IpcMainEvent, payload: IpcSendMap[C]) => void,
  ): unknown
}

/** `webContents.send`, held to the same contract as the handlers. */
export function sendToRenderer<C extends IpcEventChannel>(
  target: WebContents | null | undefined,
  channel: C,
  payload: IpcEventMap[C],
): void {
  target?.send(channel, payload)
}
