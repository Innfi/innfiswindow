import { create } from "zustand"
import { persist } from "zustand/middleware"

interface K8sPodContainer {
  name: string
  image: string
  restartCount: number
}

export type DrawerTab =
  | {
      id: string
      tabKey: string
      type: "pod-log"
      namespace: string
      podName: string
      containers: K8sPodContainer[]
      restored?: boolean
    }
  | {
      id: string
      tabKey: string
      type: "new-resource"
      resourceKind: string
    }
  | {
      id: string
      tabKey: string
      type: "pod-shell"
      sessionId: string
      namespace: string
      podName: string
      containerName: string
      restored?: boolean
    }
  | {
      id: string
      tabKey: string
      type: "edit-resource"
      resourceKind:
        | "Role"
        | "ClusterRole"
        | "RoleBinding"
        | "ClusterRoleBinding"
        | "ServiceAccount"
      resourceName: string
      namespace?: string
      initialYaml: string
      roleRef?: { kind: string; name: string }
    }
  | {
      id: string
      tabKey: string
      type: "yaml-edit"
      resourceKind:
        | "Deployment"
        | "Service"
        | "Ingress"
        | "DaemonSet"
        | "StatefulSet"
        | "ConfigMap"
        | "Secret"
      resourceName: string
      namespace: string
      initialYaml: string
    }
  | {
      id: string
      tabKey: string
      type: "custom-stream"
      socketPath: string
      label: string
    }
  | {
      id: string
      tabKey: string
      type: "port-forward"
      resourceKind: "Pod" | "Service"
      resourceName: string
      namespace: string
      localPort: number
      targetPort: number
    }

export type DrawerTabInput =
  | {
      tabKey: string
      type: "pod-log"
      namespace: string
      podName: string
      containers: K8sPodContainer[]
    }
  | { tabKey: string; type: "new-resource"; resourceKind: string }
  | {
      tabKey: string
      type: "pod-shell"
      sessionId: string
      namespace: string
      podName: string
      containerName: string
    }
  | {
      tabKey: string
      type: "edit-resource"
      resourceKind:
        | "Role"
        | "ClusterRole"
        | "RoleBinding"
        | "ClusterRoleBinding"
        | "ServiceAccount"
      resourceName: string
      namespace?: string
      initialYaml: string
      roleRef?: { kind: string; name: string }
    }
  | {
      tabKey: string
      type: "yaml-edit"
      resourceKind:
        | "Deployment"
        | "Service"
        | "Ingress"
        | "DaemonSet"
        | "StatefulSet"
        | "ConfigMap"
        | "Secret"
      resourceName: string
      namespace: string
      initialYaml: string
    }
  | {
      tabKey: string
      type: "custom-stream"
      socketPath: string
      label: string
    }
  | {
      tabKey: string
      type: "port-forward"
      resourceKind: "Pod" | "Service"
      resourceName: string
      namespace: string
      localPort: number
      targetPort: number
    }

export type RefreshIntervalValue = 10 | 30 | 60 | 120 | "off"

export interface ContextState {
  selectedResourceType: string | null
  selectedItem: object | null
  selectedNamespace: string | null
  nameFilter: string
  drawerTabs: DrawerTab[]
  activeTabId: string | null
}

interface AppState {
  selectedResourceType: string | null
  selectedItem: object | null
  selectedNamespace: string | null
  selectedContext: string | null
  nameFilter: string
  themeId: string
  refreshInterval: RefreshIntervalValue
  drawerTabs: DrawerTab[]
  activeTabId: string | null
  contextStates: Record<string, ContextState>
  contextNamespaces: Record<string, string | null>
  setSelectedResourceType: (type: string | null) => void
  setSelectedItem: (item: object | null) => void
  navigateToResource: (type: string, item: object) => void
  setSelectedNamespace: (ns: string | null) => void
  setSelectedContext: (ctx: string | null) => void
  setNameFilter: (filter: string) => void
  setThemeId: (id: string) => void
  setRefreshInterval: (interval: RefreshIntervalValue) => void
  openDrawerTab: (tab: DrawerTabInput) => void
  closeDrawerTab: (id: string) => void
  setActiveDrawerTab: (id: string) => void
  cleanupContextStates: (activeContextNames: string[]) => void
  markTabReconnected: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedResourceType: null,
      selectedItem: null,
      selectedNamespace: null,
      selectedContext: null,
      nameFilter: "",
      themeId: "default",
      refreshInterval: 30,
      drawerTabs: [],
      activeTabId: null,
      contextStates: {},
      contextNamespaces: {},
      setSelectedResourceType: (type) =>
        set({ selectedResourceType: type, selectedItem: null }),
      setSelectedItem: (item) => set({ selectedItem: item }),
      navigateToResource: (type, item) =>
        set({ selectedResourceType: type, selectedItem: item }),
      setSelectedNamespace: (ns) => {
        const { selectedContext, contextNamespaces } = get()
        const updates: Partial<AppState> = { selectedNamespace: ns }
        if (selectedContext !== null) {
          updates.contextNamespaces = {
            ...contextNamespaces,
            [selectedContext]: ns,
          }
        }
        set(updates)
      },
      setSelectedContext: (ctx) => {
        const state = get()
        const prev = state.selectedContext

        // Save current context's navigation state
        const updatedContextStates = { ...state.contextStates }
        if (prev !== null) {
          updatedContextStates[prev] = {
            selectedResourceType: state.selectedResourceType,
            selectedItem: state.selectedItem,
            selectedNamespace: state.selectedNamespace,
            nameFilter: state.nameFilter,
            drawerTabs: state.drawerTabs,
            activeTabId: state.activeTabId,
          }
        }

        // Restore new context's navigation state or use defaults
        const saved = ctx !== null ? updatedContextStates[ctx] : undefined
        const { contextNamespaces } = state
        const restoredNamespace =
          ctx !== null && ctx in contextNamespaces
            ? contextNamespaces[ctx]
            : null
        if (saved) {
          // Mark stream tabs as restored so they don't auto-start
          const restoredTabs = saved.drawerTabs.map((tab) => {
            if (tab.type === "pod-log" || tab.type === "pod-shell") {
              return { ...tab, restored: true }
            }
            return tab
          })
          set({
            selectedContext: ctx,
            contextStates: updatedContextStates,
            selectedResourceType: saved.selectedResourceType,
            selectedItem: saved.selectedItem,
            selectedNamespace: restoredNamespace,
            nameFilter: saved.nameFilter,
            drawerTabs: restoredTabs,
            activeTabId: saved.activeTabId,
          })
        } else {
          set({
            selectedContext: ctx,
            contextStates: updatedContextStates,
            selectedResourceType: null,
            selectedItem: null,
            selectedNamespace: restoredNamespace,
            nameFilter: "",
            drawerTabs: [],
            activeTabId: null,
          })
        }
      },
      setNameFilter: (filter) => set({ nameFilter: filter }),
      setThemeId: (id) => set({ themeId: id }),
      setRefreshInterval: (interval) => set({ refreshInterval: interval }),
      openDrawerTab: (tabData: DrawerTabInput) => {
        const { drawerTabs } = get()
        const existing = drawerTabs.find((t) => t.tabKey === tabData.tabKey)
        if (existing) {
          set({ activeTabId: existing.id })
          return
        }
        const id = tabData.tabKey
        const newTab: DrawerTab = { id, ...tabData } as DrawerTab
        set({ drawerTabs: [...drawerTabs, newTab], activeTabId: id })
      },
      closeDrawerTab: (id) => {
        const { drawerTabs, activeTabId } = get()
        const remaining = drawerTabs.filter((t) => t.id !== id)
        let nextActive = activeTabId
        if (activeTabId === id) {
          const idx = drawerTabs.findIndex((t) => t.id === id)
          nextActive = remaining[idx]?.id ?? remaining[idx - 1]?.id ?? null
        }
        set({ drawerTabs: remaining, activeTabId: nextActive })
      },
      setActiveDrawerTab: (id) => set({ activeTabId: id }),
      cleanupContextStates: (activeContextNames) => {
        const { contextStates, contextNamespaces } = get()
        const cleaned: Record<string, ContextState> = {}
        const cleanedNs: Record<string, string | null> = {}
        for (const name of activeContextNames) {
          if (contextStates[name]) cleaned[name] = contextStates[name]
          if (name in contextNamespaces)
            cleanedNs[name] = contextNamespaces[name]
        }
        set({ contextStates: cleaned, contextNamespaces: cleanedNs })
      },
      markTabReconnected: (id) => {
        const { drawerTabs } = get()
        set({
          drawerTabs: drawerTabs.map((tab) =>
            tab.id === id &&
            (tab.type === "pod-log" || tab.type === "pod-shell")
              ? { ...tab, restored: false }
              : tab,
          ),
        })
      },
    }),
    {
      name: "innfiswindow-app-store",
      partialize: (state) => ({
        themeId: state.themeId,
        refreshInterval: state.refreshInterval,
        contextStates: state.contextStates,
        contextNamespaces: state.contextNamespaces,
      }),
    },
  ),
)
