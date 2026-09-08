import { IpcMain } from "electron"

import { CustomResourceRef } from "../handlers/types"
import {
  getCustomResource,
  listCRDs,
  listCustomResources,
} from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerCustomResourceHandlers(
  ipcMain: IpcMain,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle(
    "k8s:crds:list",
    (_e, args?: { contextName?: string; labelSelector?: string }) =>
      listCRDs(
        getContextClients(args?.contextName).apiextensionsV1,
        args?.labelSelector,
      ),
  )
  ipcMain.handle(
    "k8s:customresources:list",
    (
      _e,
      args: {
        contextName?: string
        namespace?: string
        ref: CustomResourceRef
        printerColumns?: string[]
        labelSelector?: string
      },
    ) =>
      listCustomResources(
        getContextClients(args.contextName).customObjects,
        args.ref,
        args.printerColumns ?? [],
        args.namespace,
        args.labelSelector,
      ),
  )
  ipcMain.handle(
    "k8s:customresource:get",
    (
      _e,
      args: {
        contextName?: string
        namespace?: string
        name: string
        ref: CustomResourceRef
        printerColumns?: string[]
      },
    ) =>
      getCustomResource(
        getContextClients(args.contextName).customObjects,
        args.ref,
        args.name,
        args.printerColumns ?? [],
        args.namespace,
      ),
  )
}
