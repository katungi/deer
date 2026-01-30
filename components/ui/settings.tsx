import * as React from "react"
import { cn } from "@/lib/utils"
import { X, Settings as SettingsIcon, Bell, Shield, Palette, Moon, Search, Camera, Lock, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "./button"
import { searchEngines } from "@/lib/inputDetection"

interface PermissionStatus {
  activeTab: boolean
  tabs: boolean
}

async function checkPermissions(): Promise<PermissionStatus> {
  if (typeof chrome === 'undefined' || !chrome.permissions) {
    return { activeTab: false, tabs: false }
  }

  const [activeTab, tabs] = await Promise.all([
    chrome.permissions.contains({ permissions: ['activeTab'] }),
    chrome.permissions.contains({ permissions: ['tabs'] })
  ])

  return { activeTab, tabs }
}

async function requestPermission(permission: string): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions) {
    return false
  }

  try {
    return await chrome.permissions.request({ permissions: [permission] })
  } catch (error) {
    console.error('Permission request failed:', error)
    return false
  }
}

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
  darkMode: boolean
  onDarkModeChange: (enabled: boolean) => void
  searchEngine: string
  onSearchEngineChange: (engineId: string) => void
}

export function Settings({
  isOpen,
  onClose,
  selectedColor,
  onColorChange,
  darkMode,
  onDarkModeChange,
  searchEngine,
  onSearchEngineChange
}: SettingsProps) {
  const [permissions, setPermissions] = React.useState<PermissionStatus>({ activeTab: false, tabs: false })
  const [requestingPermission, setRequestingPermission] = React.useState<string | null>(null)

  // Check permissions when settings open
  React.useEffect(() => {
    if (isOpen) {
      checkPermissions().then(setPermissions)
    }
  }, [isOpen])

  const handleRequestPermission = async (permission: 'activeTab' | 'tabs') => {
    setRequestingPermission(permission)
    const granted = await requestPermission(permission)
    if (granted) {
      setPermissions(prev => ({ ...prev, [permission]: true }))
    }
    setRequestingPermission(null)
  }

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
        <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
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

          {/* Search Engine Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-stone-300">
              <Search className="h-4 w-4" />
              <span className="text-sm font-medium">Default Search Engine</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {searchEngines.map((engine) => (
                <button
                  key={engine.id}
                  onClick={() => onSearchEngineChange(engine.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    searchEngine === engine.id
                      ? "text-white"
                      : "bg-stone-700 text-stone-300 hover:bg-stone-600"
                  )}
                  style={searchEngine === engine.id ? {
                    backgroundColor: themeColors.find(c => c.id === selectedColor)?.value || 'var(--theme-color)'
                  } : undefined}
                >
                  <SearchEngineIcon engineId={engine.id} />
                  {engine.name}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-stone-800" />

          {/* Appearance Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-stone-300">
              <Moon className="h-4 w-4" />
              <span className="text-sm font-medium">Appearance</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-lg">
              <span className="text-sm text-stone-300">Dark mode</span>
              <ToggleSwitch
                checked={darkMode}
                onChange={onDarkModeChange}
                themeColor={themeColors.find(c => c.id === selectedColor)?.value}
              />
            </div>
          </div>

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

          {/* Permissions Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-stone-300">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-medium">Permissions</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-stone-400" />
                <div>
                  <span className="text-sm text-stone-300">Screenshot capture</span>
                  <p className="text-xs text-stone-500">Required for capturing tab screenshots</p>
                </div>
              </div>
              {permissions.activeTab ? (
                <div className="flex items-center gap-1.5 text-green-400 text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Granted</span>
                </div>
              ) : (
                <button
                  onClick={() => handleRequestPermission('activeTab')}
                  disabled={requestingPermission === 'activeTab'}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-700 text-stone-300 hover:bg-stone-600 transition-colors disabled:opacity-50"
                >
                  {requestingPermission === 'activeTab' ? 'Requesting...' : 'Grant'}
                </button>
              )}
            </div>
            <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4 text-stone-400" />
                <div>
                  <span className="text-sm text-stone-300">Tab access</span>
                  <p className="text-xs text-stone-500">Required for reading tab info</p>
                </div>
              </div>
              {permissions.tabs ? (
                <div className="flex items-center gap-1.5 text-green-400 text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Granted</span>
                </div>
              ) : (
                <button
                  onClick={() => handleRequestPermission('tabs')}
                  disabled={requestingPermission === 'tabs'}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-700 text-stone-300 hover:bg-stone-600 transition-colors disabled:opacity-50"
                >
                  {requestingPermission === 'tabs' ? 'Requesting...' : 'Grant'}
                </button>
              )}
            </div>
            {(!permissions.activeTab || !permissions.tabs) && (
              <p className="text-xs text-stone-500 flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Some features may not work without required permissions. Grant permissions to enable all features.
              </p>
            )}
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

function SearchEngineIcon({ engineId }: { engineId: string }) {
  const iconClass = "w-4 h-4"

  switch (engineId) {
    case 'google':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      )
    case 'duckduckgo':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.182a9.818 9.818 0 110 19.636 9.818 9.818 0 010-19.636z" fill="#DE5833"/>
          <circle cx="12" cy="12" r="8" fill="#DE5833"/>
          <ellipse cx="9.5" cy="10" rx="2" ry="2.5" fill="white"/>
          <ellipse cx="14.5" cy="10" rx="2" ry="2.5" fill="white"/>
          <circle cx="9.5" cy="10.5" r="1" fill="#2D4F8E"/>
          <circle cx="14.5" cy="10.5" r="1" fill="#2D4F8E"/>
          <path d="M9 15c1.5 2 4.5 2 6 0" stroke="#65382A" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      )
    case 'bing':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 3v16.5l4.5 2.5 8-4.5v-5l-6-2.5V5L5 3z" fill="#00897B"/>
          <path d="M9.5 10v9l8-4.5v-5l-8 .5z" fill="#00ACC1"/>
          <path d="M5 3l6.5 2v5l-2-1V5L5 3z" fill="#00897B"/>
        </svg>
      )
    case 'brave':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z" fill="#FB542B"/>
          <path d="M12 4l-7 3.1v4.9c0 4.42 3.07 8.56 7 9.58V4z" fill="#FF7139"/>
          <path d="M12 4v17.58c3.93-1.02 7-5.16 7-9.58V7.1L12 4z" fill="#FB542B"/>
        </svg>
      )
    default:
      return <Search className={iconClass} />
  }
}

interface ToggleSwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  themeColor?: string
}

function ToggleSwitch({ checked, defaultChecked = false, onChange, themeColor }: ToggleSwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked)

  const isChecked = checked !== undefined ? checked : internalChecked

  const handleClick = () => {
    const newValue = !isChecked
    if (onChange) {
      onChange(newValue)
    } else {
      setInternalChecked(newValue)
    }
  }

  return (
    <button
      onClick={handleClick}
      className="relative w-11 h-6 rounded-full transition-colors duration-200"
      style={{
        backgroundColor: isChecked ? (themeColor || 'var(--theme-color)') : '#57534e'
      }}
    >
      <div
        className={cn(
          "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
          isChecked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  )
}
