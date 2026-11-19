import { V1ObjectMeta } from "@kubernetes/client-node"

import { ResourceRef } from "./types"

/** The name/namespace a write handler hands back for the object it wrote. */
export function toResourceRef(obj: { metadata?: V1ObjectMeta }): ResourceRef {
  return {
    name: obj.metadata?.name ?? "",
    namespace: obj.metadata?.namespace ?? "",
  }
}
