import { BrowserWindow, IpcMain } from "electron"
import { createConnection, Socket } from "net"

export function registerSocketStreamHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null,
): void {
  const activeSocketStreams = new Map<string, Socket>()

  ipcMain.handle(
    "stream:socket:start",
    (
      _e,
      { socketPath, sessionId }: { socketPath: string; sessionId: string },
    ) => {
      // Clean up any existing session with same id
      const existing = activeSocketStreams.get(sessionId)
      if (existing) {
        existing.destroy()
        activeSocketStreams.delete(sessionId)
      }

      const sock = createConnection(socketPath)
      activeSocketStreams.set(sessionId, sock)

      let buffer = ""
      sock.on("data", (chunk: Buffer) => {
        buffer += chunk.toString()
        const parts = buffer.split("\n")
        buffer = parts.pop() ?? ""
        for (const line of parts) {
          getMainWindow()?.webContents.send("stream:socket:data", {
            sessionId,
            line,
          })
        }
      })

      sock.on("error", (err) => {
        activeSocketStreams.delete(sessionId)
        getMainWindow()?.webContents.send("stream:socket:end", {
          sessionId,
          reason: err.message,
        })
      })

      sock.on("close", () => {
        activeSocketStreams.delete(sessionId)
        getMainWindow()?.webContents.send("stream:socket:end", {
          sessionId,
          reason: "",
        })
      })

      return { success: true }
    },
  )

  ipcMain.handle(
    "stream:socket:stop",
    (_e, { sessionId }: { sessionId: string }) => {
      const sock = activeSocketStreams.get(sessionId)
      if (sock) {
        sock.destroy()
        activeSocketStreams.delete(sessionId)
      }
      return { success: true }
    },
  )
}
