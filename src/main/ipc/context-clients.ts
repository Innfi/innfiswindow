import {
  AppsV1Api,
  AutoscalingV2Api,
  BatchV1Api,
  CoreV1Api,
  CustomObjectsApi,
  KubeConfig,
  NetworkingV1Api,
  PolicyV1Api,
  RbacAuthorizationV1Api,
} from "@kubernetes/client-node"

export interface ApiClients {
  coreV1: CoreV1Api
  appsV1: AppsV1Api
  networkingV1: NetworkingV1Api
  rbacV1: RbacAuthorizationV1Api
  autoscalingV2: AutoscalingV2Api
  batchV1: BatchV1Api
  customObjects: CustomObjectsApi
  policyV1: PolicyV1Api
}

export type GetContextClients = (contextName?: string | null) => ApiClients

export function createContextClientsCache(defaultClients: ApiClients): {
  getContextClients: GetContextClients
} {
  const clientCache = new Map<string, ApiClients>()

  function getContextClients(contextName?: string | null): ApiClients {
    if (!contextName) return defaultClients
    if (clientCache.has(contextName)) return clientCache.get(contextName)!
    const ctxKc = new KubeConfig()
    ctxKc.loadFromDefault()
    ctxKc.setCurrentContext(contextName)
    const clients: ApiClients = {
      coreV1: ctxKc.makeApiClient(CoreV1Api),
      appsV1: ctxKc.makeApiClient(AppsV1Api),
      networkingV1: ctxKc.makeApiClient(NetworkingV1Api),
      rbacV1: ctxKc.makeApiClient(RbacAuthorizationV1Api),
      autoscalingV2: ctxKc.makeApiClient(AutoscalingV2Api),
      batchV1: ctxKc.makeApiClient(BatchV1Api),
      customObjects: ctxKc.makeApiClient(CustomObjectsApi),
      policyV1: ctxKc.makeApiClient(PolicyV1Api),
    }
    clientCache.set(contextName, clients)
    return clients
  }

  return { getContextClients }
}
