import * as React from "react"
import { cn } from "@/lib/utils"
import { X, Settings as SettingsIcon, Bell, Shield, Palette } from "lucide-react"
import { Button } from "./button"

export interface ThemeColor {
  id: string
  name: string
  value: string
  class: string
}

export const themeColors: ThemeColor[] = [
  { id: "white", name: "White", value: "#ffffff", class: "bg-white border-2 border-stone-300" },
  { id: "teal", name: "Teal", value: "#0d9488", class: "bg-teal-600" },
  { id: "blue", name: "Blue", value: "#2563eb", class: "bg-blue-600" },
  { id: "purple", name: "Purple", value: "#7c3aed", class: "bg-violet-600" },
  { id: "orange", name: "Orange", value: "#ea580c", class: "bg-orange-600" },
  { id: "pink", name: "Pink", value: "#db2777", class: "bg-pink-600" },
  { id: "rose", name: "Rose", value: "#e11d48", class: "bg-rose-600" },
  { id: "red-orange", name: "Red Orange", value: "#dc2626", class: "bg-red-600" },
]

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  selectedColor: string
  onColorChange: (colorId: string) => void
}

export function Settings({ isOpen, onClose, selectedColor, onColorChange }: SettingsProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Settings Panel */}
      <div className="relative bg-stone-900 rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-800">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-stone-400 hover:text-white hover:bg-stone-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Theme Color Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-stone-300">
              <Palette className="h-4 w-4" />
              <span className="text-sm font-medium">Theme Color</span>
            </div>

            {/* Color Preview */}
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-full shadow-lg transition-all duration-300"
                style={{
                  backgroundColor: themeColors.find(c => c.id === selectedColor)?.value || themeColors[6].value,
                  transform: 'translateY(-8px)'
                }}
              />
            </div>

            {/* Color Picker */}
            <div className="flex items-center justify-center gap-3">
              {themeColors.map((color) => (
                <button
                  key={color.id}
                  onClick={() => onColorChange(color.id)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all duration-200 hover:scale-110",
                    color.class,
                    selectedColor === color.id
                      ? "ring-2 ring-offset-2 ring-offset-stone-900 ring-white scale-110"
                      : ""
                  )}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-stone-800" />

          {/* Notifications Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-stone-300">
              <Bell className="h-4 w-4" />
              <span className="text-sm font-medium">Notifications</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-lg">
              <span className="text-sm text-stone-300">Enable notifications</span>
              <ToggleSwitch />
            </div>
          </div>

          {/* Privacy Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-stone-300">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Privacy</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-lg">
              <span className="text-sm text-stone-300">Save chat history</span>
              <ToggleSwitch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-lg">
              <span className="text-sm text-stone-300">Anonymous usage data</span>
              <ToggleSwitch />
            </div>
          </div>

          {/* General Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-stone-300">
              <SettingsIcon className="h-4 w-4" />
              <span className="text-sm font-medium">General</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-lg">
              <span className="text-sm text-stone-300">Auto-expand tabs</span>
              <ToggleSwitch defaultChecked />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToggleSwitch({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = React.useState(defaultChecked)

  return (
    <button
      onClick={() => setChecked(!checked)}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors duration-200",
        checked ? "bg-rose-600" : "bg-stone-600"
      )}
    >
      <div
        className={cn(
          "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  )
}
