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

export type RefreshIntervalValue = 10 | 30 | 60 | 120 | "off"

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
  setSelectedResourceType: (type: string | null) => void
  setSelectedItem: (item: object | null) => void
  setSelectedNamespace: (ns: string | null) => void
  setSelectedContext: (ctx: string | null) => void
  setNameFilter: (filter: string) => void
  setThemeId: (id: string) => void
  setRefreshInterval: (interval: RefreshIntervalValue) => void
  openDrawerTab: (tab: DrawerTabInput) => void
  closeDrawerTab: (id: string) => void
  setActiveDrawerTab: (id: string) => void
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
      setSelectedResourceType: (type) =>
        set({ selectedResourceType: type, selectedItem: null }),
      setSelectedItem: (item) => set({ selectedItem: item }),
      setSelectedNamespace: (ns) => set({ selectedNamespace: ns }),
      setSelectedContext: (ctx) =>
        set({ selectedContext: ctx, selectedNamespace: null }),
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
    }),
    {
      name: "innfiswindow-app-store",
      partialize: (state) => ({
        themeId: state.themeId,
        refreshInterval: state.refreshInterval,
      }),
    },
  ),
)
