import { Palette } from "lucide-react"

import { THEMES } from "../lib/themes"
import { useAppStore } from "../store/app.store"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"

export function ThemePicker(): JSX.Element {
  const themeId = useAppStore((s) => s.themeId)
  const setThemeId = useAppStore((s) => s.setThemeId)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--accent)] transition-colors"
          title="Switch color theme"
        >
          <Palette className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-3">
        <p className="text-xs font-semibold mb-2 text-[var(--muted-foreground)]">
          Color Theme
        </p>
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              title={theme.name}
              onClick={() => setThemeId(theme.id)}
              className={`w-7 h-7 rounded-full transition-all ${
                themeId === theme.id
                  ? "ring-2 ring-offset-2 ring-[var(--ring)]"
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: theme.light["--primary"] }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
