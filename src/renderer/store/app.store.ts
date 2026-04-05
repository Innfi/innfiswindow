import { create } from "zustand"

interface AppState {
  selectedResourceType: string | null
  selectedItem: object | null
  setSelectedResourceType: (type: string | null) => void
  setSelectedItem: (item: object | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedResourceType: null,
  selectedItem: null,
  setSelectedResourceType: (type) =>
    set({ selectedResourceType: type, selectedItem: null }),
  setSelectedItem: (item) => set({ selectedItem: item }),
}))
