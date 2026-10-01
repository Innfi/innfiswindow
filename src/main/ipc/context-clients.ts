import {
  AdmissionregistrationV1Api,
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

import { installExecAuth } from "../exec-auth"

export interface ApiClients {
  coreV1: CoreV1Api
  admissionregistrationV1: AdmissionregistrationV1Api
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

/** Forgets a context's exec credentials so the next request re-runs the
 *  credential plugin (e.g. `aws eks get-token`). Named contexts are also
 *  rebuilt from a freshly read kubeconfig. */
export type InvalidateContext = (contextName?: string | null) => void

/** Resolves the KubeConfig for a context, for APIs that need the config itself
 *  (KubernetesObjectApi) rather than a typed client. */
export type GetKubeConfig = (contextName?: string | null) => KubeConfig

export function makeApiClients(kc: KubeConfig): ApiClients {
  return {
    coreV1: kc.makeApiClient(CoreV1Api),
    admissionregistrationV1: kc.makeApiClient(AdmissionregistrationV1Api),
    apiextensionsV1: kc.makeApiClient(ApiextensionsV1Api),
    appsV1: kc.makeApiClient(AppsV1Api),
    authorizationV1: kc.makeApiClient(AuthorizationV1Api),
    discoveryV1: kc.makeApiClient(DiscoveryV1Api),
    networkingV1: kc.makeApiClient(NetworkingV1Api),
    rbacV1: kc.makeApiClient(RbacAuthorizationV1Api),
    autoscalingV2: kc.makeApiClient(AutoscalingV2Api),
    batchV1: kc.makeApiClient(BatchV1Api),
    customObjects: kc.makeApiClient(CustomObjectsApi),
    policyV1: kc.makeApiClient(PolicyV1Api),
    schedulingV1: kc.makeApiClient(SchedulingV1Api),
    storageV1: kc.makeApiClient(StorageV1Api),
  }
}

interface ContextEntry {
  kc: KubeConfig
  clients: ApiClients | null
}

/**
 * One KubeConfig per context, shared by typed clients, watches, streams and
 * apply — so they share one exec credential cache and one invalidation point.
 * `defaultClients` must be built from `defaultKc`.
 */
export function createContextCache(
  defaultKc: KubeConfig,
  defaultClients: ApiClients,
): {
  getKubeConfig: GetKubeConfig
  getContextClients: GetContextClients
  invalidateContext: InvalidateContext
} {
  const clearDefaultAuth = installExecAuth(defaultKc)
  const entries = new Map<string, ContextEntry>()

  function entryFor(contextName: string): ContextEntry {
    const cached = entries.get(contextName)
    if (cached) return cached
    const kc = new KubeConfig()
    kc.loadFromDefault()
    kc.setCurrentContext(contextName)
    installExecAuth(kc)
    const entry: ContextEntry = { kc, clients: null }
    entries.set(contextName, entry)
    return entry
  }

  function getKubeConfig(contextName?: string | null): KubeConfig {
    return contextName ? entryFor(contextName).kc : defaultKc
  }

  function getContextClients(contextName?: string | null): ApiClients {
    if (!contextName) return defaultClients
    const entry = entryFor(contextName)
    entry.clients ??= makeApiClients(entry.kc)
    return entry.clients
  }

  function invalidateContext(contextName?: string | null): void {
    // The default clients are handed out at startup and can't be swapped, so
    // only their credentials are dropped. Long-lived holders of a named
    // context's old KubeConfig (open watches, streams) keep working on their
    // own early-refreshing credentials.
    if (contextName) entries.delete(contextName)
    else clearDefaultAuth()
  }

  return { getKubeConfig, getContextClients, invalidateContext }
}
