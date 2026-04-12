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
      type: "pod-log"
      namespace: string
      podName: string
      containers: K8sPodContainer[]
    }
  | {
      id: string
      type: "new-resource"
      resourceKind: string
    }

export type DrawerTabInput =
  | {
      type: "pod-log"
      namespace: string
      podName: string
      containers: K8sPodContainer[]
    }
  | { type: "new-resource"; resourceKind: string }

interface AppState {
  selectedResourceType: string | null
  selectedItem: object | null
  themeId: string
  drawerTabs: DrawerTab[]
  activeTabId: string | null
  setSelectedResourceType: (type: string | null) => void
  setSelectedItem: (item: object | null) => void
  setThemeId: (id: string) => void
  openDrawerTab: (tab: DrawerTabInput) => void
  closeDrawerTab: (id: string) => void
  setActiveDrawerTab: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedResourceType: null,
      selectedItem: null,
      themeId: "default",
      drawerTabs: [],
      activeTabId: null,
      setSelectedResourceType: (type) =>
        set({ selectedResourceType: type, selectedItem: null }),
      setSelectedItem: (item) => set({ selectedItem: item }),
      setThemeId: (id) => set({ themeId: id }),
      openDrawerTab: (tabData: DrawerTabInput) => {
        const { drawerTabs } = get()
        // Find existing tab of same type with same identity
        let existing: DrawerTab | undefined
        if (tabData.type === "pod-log") {
          existing = drawerTabs.find(
            (t) =>
              t.type === "pod-log" &&
              t.namespace === tabData.namespace &&
              t.podName === tabData.podName,
          )
        } else if (tabData.type === "new-resource") {
          existing = drawerTabs.find(
            (t) =>
              t.type === "new-resource" &&
              t.resourceKind === tabData.resourceKind,
          )
        }
        if (existing) {
          set({ activeTabId: existing.id })
          return
        }
        const id = `${tabData.type}-${Date.now()}`
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
      partialize: (state) => ({ themeId: state.themeId }),
    },
  ),
)
