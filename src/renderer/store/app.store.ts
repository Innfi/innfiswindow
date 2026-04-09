import { create } from "zustand"
import { persist } from "zustand/middleware"

interface AppState {
  selectedResourceType: string | null
  selectedItem: object | null
  themeId: string
  setSelectedResourceType: (type: string | null) => void
  setSelectedItem: (item: object | null) => void
  setThemeId: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedResourceType: null,
      selectedItem: null,
      themeId: "default",
      setSelectedResourceType: (type) =>
        set({ selectedResourceType: type, selectedItem: null }),
      setSelectedItem: (item) => set({ selectedItem: item }),
      setThemeId: (id) => set({ themeId: id }),
    }),
    {
      name: "innfiswindow-app-store",
      partialize: (state) => ({ themeId: state.themeId }),
    },
  ),
)
