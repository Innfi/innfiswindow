import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { ResourceGvk, ResourceKind } from "../lib/resource-gvk"
import type { ResourceType } from "../src/types/resource"

interface K8sPodContainer {
  name: string
  image: string
  restartCount: number
}

export interface AlarmRule {
  id: string
  name: string
  severity: "critical" | "warning" | "info"
  conditionType:
    | "pod-not-running"
    | "deployment-unavailable"
    | "warning-event"
    | "node-not-ready"
  context: string
  namespace?: string
  resourceNameFilter?: string
}

export interface AlarmEntry {
  id: string
  ruleId: string
  ruleName: string
  severity: "critical" | "warning" | "info"
  context: string
  sourceKind: string
  sourceName: string
  namespace: string | null
  message: string
  triggeredAt: string
}

export interface ErrorEntry {
  id: string
  message: string
  timestamp: string
  source?: string
}

export interface HistoryEntry {
  id: string
  timestamp: string
  action:
    | "create"
    | "update"
    | "delete"
    | "evict"
    | "expand"
    | "apply"
    | "restart"
    | "scale"
    | "suspend"
    | "resume"
    | "pause"
    | "cordon"
    | "uncordon"
    | "drain"
    | "label"
    | "taint"
    | "debug"
    | "copy"
  resourceKind: string
  resourceName: string
  namespace: string | null
  context: string
  success: boolean
  error?: string
  yamlSnapshot?: string
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
      /** The context the session was opened against, so a reconnect after a
       *  context switch still lands on the same cluster. */
      contextName?: string
      restored?: boolean
    }
  | {
      id: string
      tabKey: string
      type: "yaml-edit"
      resourceKind: ResourceKind
      /** Required for a kind outside the built-in GVK table — a custom
       *  resource, whose group/version only its CRD knows. */
      gvk?: ResourceGvk
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
      contextName?: string
    }
  | {
      tabKey: string
      type: "yaml-edit"
      resourceKind: ResourceKind
      /** Required for a kind outside the built-in GVK table — a custom
       *  resource, whose group/version only its CRD knows. */
      gvk?: ResourceGvk
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

/** Which CRD version the generic custom-resource browser is pointed at. Held
 *  as a CRD name rather than a resolved ref so the printer columns are always
 *  re-read from the live CRD, which an operator upgrade can change. */
export interface CustomResourceTarget {
  crdName: string
  version: string
}

export interface ContextState {
  selectedResourceType: ResourceType | null
  customResourceTarget: CustomResourceTarget | null
  selectedItem: object | null
  selectedNamespace: string | null
  nameFilter: string
  drawerTabs: DrawerTab[]
  activeTabId: string | null
}

interface AppState {
  selectedResourceType: ResourceType | null
  customResourceTarget: CustomResourceTarget | null
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
  contextAliases: Record<string, string>
  writeHistory: HistoryEntry[]
  alarmRules: AlarmRule[]
  alarmEntries: AlarmEntry[]
  globalErrors: ErrorEntry[]
  unreadErrorCount: number
  setSelectedResourceType: (type: ResourceType | null) => void
  setCustomResourceTarget: (target: CustomResourceTarget | null) => void
  browseCustomResource: (target: CustomResourceTarget) => void
  setSelectedItem: (item: object | null) => void
  navigateToResource: (type: ResourceType, item: object) => void
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
  setContextAlias: (contextName: string, alias: string) => void
  appendHistory: (entry: Omit<HistoryEntry, "id" | "timestamp">) => void
  clearHistory: () => void
  addAlarmRule: (rule: Omit<AlarmRule, "id">) => void
  deleteAlarmRule: (id: string) => void
  appendAlarmEntries: (entries: AlarmEntry[]) => void
  clearAlarmEntries: () => void
  addGlobalError: (message: string, source?: string) => void
  clearGlobalErrors: () => void
  resetUnreadErrorCount: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedResourceType: null,
      customResourceTarget: null,
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
      contextAliases: {},
      writeHistory: [],
      alarmRules: [],
      alarmEntries: [],
      globalErrors: [],
      unreadErrorCount: 0,
      setSelectedResourceType: (type) =>
        set({ selectedResourceType: type, selectedItem: null }),
      setCustomResourceTarget: (target) =>
        set({ customResourceTarget: target, selectedItem: null }),
      // Point the generic browser at a kind and show it, in one step: the
      // browser reads the target on mount, so setting it after the view
      // switched would render one frame of the previous kind.
      browseCustomResource: (target) =>
        set({
          customResourceTarget: target,
          selectedResourceType: "custom-resources",
          selectedItem: null,
        }),
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
            customResourceTarget: state.customResourceTarget,
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
            customResourceTarget: saved.customResourceTarget,
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
            customResourceTarget: null,
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
        const { contextStates, contextNamespaces, contextAliases } = get()
        const cleaned: Record<string, ContextState> = {}
        const cleanedNs: Record<string, string | null> = {}
        const cleanedAliases: Record<string, string> = {}
        for (const name of activeContextNames) {
          if (contextStates[name]) cleaned[name] = contextStates[name]
          if (name in contextNamespaces)
            cleanedNs[name] = contextNamespaces[name]
          if (name in contextAliases)
            cleanedAliases[name] = contextAliases[name]
        }
        set({
          contextStates: cleaned,
          contextNamespaces: cleanedNs,
          contextAliases: cleanedAliases,
        })
      },
      setContextAlias: (contextName, alias) => {
        const { contextAliases } = get()
        if (alias.trim() === "") {
          const updated = { ...contextAliases }
          delete updated[contextName]
          set({ contextAliases: updated })
        } else {
          set({
            contextAliases: {
              ...contextAliases,
              [contextName]: alias.slice(0, 64),
            },
          })
        }
      },
      appendHistory: (entry) => {
        const { writeHistory } = get()
        const newEntry: HistoryEntry = {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: new Date().toISOString(),
        }
        set({ writeHistory: [...writeHistory, newEntry].slice(-500) })
      },
      clearHistory: () => set({ writeHistory: [] }),
      addAlarmRule: (rule) => {
        const { alarmRules } = get()
        const newRule: AlarmRule = {
          ...rule,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }
        set({ alarmRules: [...alarmRules, newRule] })
      },
      deleteAlarmRule: (id) => {
        const { alarmRules } = get()
        set({ alarmRules: alarmRules.filter((r) => r.id !== id) })
      },
      appendAlarmEntries: (entries) => {
        const { alarmEntries } = get()
        const nowMinute = new Date().toISOString().slice(0, 16)
        const dedupedNew = entries.filter((newEntry) => {
          const duplicate = alarmEntries.find(
            (e) =>
              e.ruleId === newEntry.ruleId &&
              e.sourceName === newEntry.sourceName &&
              e.namespace === newEntry.namespace &&
              e.triggeredAt.slice(0, 16) === nowMinute,
          )
          return !duplicate
        })
        set({
          alarmEntries: [...alarmEntries, ...dedupedNew].slice(-1000),
        })
      },
      clearAlarmEntries: () => set({ alarmEntries: [] }),
      addGlobalError: (message, source) => {
        const { globalErrors, unreadErrorCount } = get()
        const entry: ErrorEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          message,
          timestamp: new Date().toISOString(),
          source,
        }
        set({
          globalErrors: [...globalErrors, entry].slice(-100),
          unreadErrorCount: unreadErrorCount + 1,
        })
      },
      clearGlobalErrors: () => set({ globalErrors: [], unreadErrorCount: 0 }),
      resetUnreadErrorCount: () => set({ unreadErrorCount: 0 }),
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
        contextAliases: state.contextAliases,
        writeHistory: state.writeHistory,
        alarmRules: state.alarmRules,
        alarmEntries: state.alarmEntries,
      }),
    },
  ),
)
