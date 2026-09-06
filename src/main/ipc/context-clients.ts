import {
  ApiextensionsV1Api,
  AppsV1Api,
  AuthorizationV1Api,
  AutoscalingV2Api,
  BatchV1Api,
  CoreV1Api,
  CustomObjectsApi,
  DiscoveryV1Api,
  KubeConfig,
  NetworkingV1Api,
  PolicyV1Api,
  RbacAuthorizationV1Api,
  SchedulingV1Api,
  StorageV1Api,
} from "@kubernetes/client-node"

export interface ApiClients {
  coreV1: CoreV1Api
  apiextensionsV1: ApiextensionsV1Api
  appsV1: AppsV1Api
  authorizationV1: AuthorizationV1Api
  discoveryV1: DiscoveryV1Api
  networkingV1: NetworkingV1Api
  rbacV1: RbacAuthorizationV1Api
  autoscalingV2: AutoscalingV2Api
  batchV1: BatchV1Api
  customObjects: CustomObjectsApi
  policyV1: PolicyV1Api
  schedulingV1: SchedulingV1Api
  storageV1: StorageV1Api
}

export type GetContextClients = (contextName?: string | null) => ApiClients

/** Drops cached clients so the next `getContextClients` rebuilds them from a
 *  fresh KubeConfig, re-running the exec credential plugin (e.g. for EKS). */
export type InvalidateContext = (contextName?: string | null) => void

/** Resolves the KubeConfig for a context, for APIs that need the config itself
 *  (KubernetesObjectApi) rather than a typed client. */
export type GetKubeConfig = (contextName?: string | null) => KubeConfig

export function createKubeConfigCache(defaultKc: KubeConfig): GetKubeConfig {
  const cache = new Map<string, KubeConfig>()
  return (contextName?: string | null): KubeConfig => {
    if (!contextName) return defaultKc
    const cached = cache.get(contextName)
    if (cached) return cached
    const ctxKc = new KubeConfig()
    ctxKc.loadFromDefault()
    ctxKc.setCurrentContext(contextName)
    cache.set(contextName, ctxKc)
    return ctxKc
  }
}

export function createContextClientsCache(defaultClients: ApiClients): {
  getContextClients: GetContextClients
  invalidateContext: InvalidateContext
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
      apiextensionsV1: ctxKc.makeApiClient(ApiextensionsV1Api),
      appsV1: ctxKc.makeApiClient(AppsV1Api),
      authorizationV1: ctxKc.makeApiClient(AuthorizationV1Api),
      discoveryV1: ctxKc.makeApiClient(DiscoveryV1Api),
      networkingV1: ctxKc.makeApiClient(NetworkingV1Api),
      rbacV1: ctxKc.makeApiClient(RbacAuthorizationV1Api),
      autoscalingV2: ctxKc.makeApiClient(AutoscalingV2Api),
      batchV1: ctxKc.makeApiClient(BatchV1Api),
      customObjects: ctxKc.makeApiClient(CustomObjectsApi),
      policyV1: ctxKc.makeApiClient(PolicyV1Api),
      schedulingV1: ctxKc.makeApiClient(SchedulingV1Api),
      storageV1: ctxKc.makeApiClient(StorageV1Api),
    }
    clientCache.set(contextName, clients)
    return clients
  }

  function invalidateContext(contextName?: string | null): void {
    // The default clients own a KubeConfig whose exec auth provider refreshes
    // credentials on its own, so only the per-context cache needs clearing.
    if (contextName) clientCache.delete(contextName)
  }

  return { getContextClients, invalidateContext }
}
