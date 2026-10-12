import { ElectronAPI } from "@electron-toolkit/preload"

import type { Api } from "./api"

// `window.api` is whatever the preload actually exposes: `Api` is the type of
// the object in `./api.ts`, which is built from the channel map in
// `src/shared/ipc.ts`. Nothing is declared here by hand.
declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
