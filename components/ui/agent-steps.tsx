import { cn } from "@/lib/utils"
import { Check, Loader2, X, ChevronDown, ChevronRight, Circle } from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import type { AgentStep, StepCategory } from "@/lib/ai/types"

interface AgentStepsProps {
  steps: AgentStep[]
  isRunning?: boolean
  className?: string
  defaultCollapsed?: boolean
}

// Get human-readable description from action
function getStepDescription(step: AgentStep): string {
  if (step.description) return step.description

  const action = step.action

  // Extract tool name and args
  const match = action.match(/^(\w+):\s*(.*)$/)
  if (!match) return action.slice(0, 50)

  const [, toolName, argsStr] = match

  try {
    const args = argsStr ? JSON.parse(argsStr) : {}

    switch (toolName) {
      case 'navigate':
        return `Navigating to ${args.url ? new URL(args.url).hostname : 'page'}`
      case 'createTab':
        return args.url ? `Opening ${new URL(args.url).hostname}` : 'Creating new tab'
      case 'closeTab':
        return 'Closing tab'
      case 'getTabs':
        return 'Getting open tabs'
      case 'getActiveTab':
        return 'Getting active tab'
      case 'switchTab':
        return 'Switching tab'
      case 'getPageDOM':
        return 'Inspecting page'
      case 'clickElement':
        return 'Clicking'
      case 'typeInElement':
        return `Typing: ${args.text?.slice(0, 30) || '...'}`
      case 'scrollToElement':
        return 'Scrolling to element'
      case 'screenshot':
        return 'Taking screenshot'
      case 'wait':
        return args.ms ? `Waiting ${args.ms}ms` : 'Waiting'
      case 'scroll':
        return `Scrolling ${args.direction || 'down'}`
      case 'executeScript':
        return 'Executing script'
      case 'search':
        return `Searching: ${args.query?.slice(0, 30) || '...'}`
      default:
        return toolName
    }
  } catch {
    return toolName || action.slice(0, 30)
  }
}

// Get category from action
function getStepCategory(step: AgentStep): StepCategory {
  if (step.category) return step.category

  const action = step.action.toLowerCase()

  if (action.includes('plan') || action.includes('creating plan')) return 'planning'
  if (action.includes('navigate') || action.includes('tab')) return 'navigation'
  if (action.includes('click') || action.includes('type') || action.includes('scroll')) return 'interaction'
  if (action.includes('search')) return 'search'
  return 'other'
}

// Get icon for step
function getStepIcon(step: AgentStep): string {
  const action = step.action

  if (action.includes('getPageDOM')) return '🔍'
  if (action.includes('clickElement') || action.includes('click')) return '👆'
  if (action.includes('typeInElement') || action.includes('type')) return '⌨️'
  if (action.includes('scroll')) return '📜'
  if (action.includes('navigate')) return '🧭'
  if (action.includes('screenshot')) return '📸'
  if (action.includes('wait')) return '⏳'
  if (action.includes('Tab')) return '📑'
  if (action.includes('search')) return '🔎'
  if (action.includes('plan')) return '📋'
  return '🔧'
}

// Check if result contains a screenshot
function getScreenshotFromResult(result: unknown): string | null {
  if (!result) return null
  if (typeof result === 'string') {
    if (result.startsWith('data:image')) return result
    try {
      const parsed = JSON.parse(result)
      if (parsed.dataUrl && parsed.dataUrl.startsWith('data:image')) {
        return parsed.dataUrl
      }
    } catch {
      // Not JSON
    }
  }
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>
    if (typeof obj.dataUrl === 'string' && obj.dataUrl.startsWith('data:image')) {
      return obj.dataUrl
    }
  }
  return null
}

export function AgentSteps({ steps, isRunning, className, defaultCollapsed }: AgentStepsProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed ?? false)
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null)

  // Count completed steps
  const completedCount = useMemo(() =>
    steps.filter(s => s.status === 'completed').length,
    [steps]
  )

  // Auto-collapse when all done and not running
  useEffect(() => {
    if (!isRunning && steps.length > 0 && completedCount === steps.length) {
      // Delay collapse slightly so user sees completion
      const timer = setTimeout(() => setIsCollapsed(true), 500)
      return () => clearTimeout(timer)
    }
  }, [isRunning, steps.length, completedCount])

  if (steps.length === 0 && !isRunning) {
    return null
  }

  const hasActiveStep = steps.some(s => s.status === 'running')

  return (
    <div className={cn("rounded-xl bg-stone-50 dark:bg-stone-800/50 overflow-hidden", className)}>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-stone-100 dark:hover:bg-stone-700/50 transition-colors"
      >
        <span className="text-stone-400 dark:text-stone-500">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>

        <span className="flex-1 text-sm text-stone-600 dark:text-stone-300">
          {completedCount > 0 ? (
            <>{completedCount} step{completedCount !== 1 ? 's' : ''} completed</>
          ) : hasActiveStep ? (
            <>Processing...</>
          ) : (
            <>{steps.length} step{steps.length !== 1 ? 's' : ''}</>
          )}
        </span>

        {hasActiveStep && (
          <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
        )}
      </button>

      {/* Timeline Content */}
      {!isCollapsed && (
        <div className="px-3 pb-3">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-stone-200 dark:bg-stone-600" />

            {/* Steps */}
            <div className="space-y-0">
              {steps.map((step, index) => {
                const description = getStepDescription(step)
                const icon = getStepIcon(step)
                const screenshot = step.screenshot || getScreenshotFromResult(step.result)

                return (
                  <div key={step.id} className="relative pl-6 py-1.5 first:pt-0 last:pb-0">
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-1.5 flex items-center justify-center w-4 h-4">
                      {step.status === 'completed' && (
                        <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                      {step.status === 'running' && (
                        <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                          <Loader2 className="h-2.5 w-2.5 text-white animate-spin" />
                        </div>
                      )}
                      {step.status === 'failed' && (
                        <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                          <X className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                      {step.status === 'pending' && (
                        <Circle className="h-3 w-3 text-stone-300 dark:text-stone-500" />
                      )}
                    </div>

                    {/* Step content */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{icon}</span>
                        <span className={cn(
                          "text-sm truncate",
                          step.status === 'completed' && "text-stone-600 dark:text-stone-300",
                          step.status === 'running' && "text-amber-600 dark:text-amber-400 font-medium",
                          step.status === 'failed' && "text-red-600 dark:text-red-400",
                          step.status === 'pending' && "text-stone-400 dark:text-stone-500"
                        )}>
                          {description}
                        </span>
                      </div>

                      {/* Error message */}
                      {step.error && (
                        <div className="mt-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                          {step.error}
                        </div>
                      )}

                      {/* Screenshot */}
                      {screenshot && (
                        <div className="mt-2">
                          <img
                            src={screenshot}
                            alt="Step screenshot"
                            className="max-w-[280px] rounded-lg border border-stone-200 dark:border-stone-600 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setExpandedScreenshot(screenshot)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Running indicator at the end */}
            {isRunning && !hasActiveStep && (
              <div className="relative pl-6 py-1.5">
                <div className="absolute left-0 top-1.5 flex items-center justify-center w-4 h-4">
                  <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                </div>
                <span className="text-sm text-stone-400 dark:text-stone-500">
                  Processing...
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Screenshot modal */}
      {expandedScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedScreenshot(null)}
        >
          <img
            src={expandedScreenshot}
            alt="Expanded screenshot"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

export function AgentThinking({ currentStep }: { currentStep?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs">
      <Loader2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-spin" />
      <span className="text-amber-700 dark:text-amber-300 font-medium">
        {currentStep || "Thinking..."}
      </span>
    </div>
  )
}
