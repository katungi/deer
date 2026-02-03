import { cn } from "@/lib/utils"
import { Check, Loader2, X, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import type { AgentStep } from "@/lib/ai/types"

interface AgentStepsProps {
  steps: AgentStep[]
  isRunning?: boolean
  className?: string
}

function getToolIcon(action: string): string {
  if (action.includes("getPageDOM")) return "🔍"
  if (action.includes("clickElement")) return "👆"
  if (action.includes("typeInElement")) return "⌨️"
  if (action.includes("scrollToElement")) return "📜"
  if (action.includes("navigate")) return "🌐"
  if (action.includes("screenshot")) return "📸"
  if (action.includes("wait")) return "⏳"
  if (action.includes("Tab")) return "📑"
  return "🔧"
}

function getToolName(action: string): string {
  // Extract tool name from action string like "getPageDOM: {}"
  const match = action.match(/^(\w+):/)
  return match ? match[1] : action.slice(0, 30)
}

function formatResult(result: string | undefined): string {
  if (!result) return ""
  // Truncate long results
  if (result.length > 100) {
    return result.slice(0, 100) + "..."
  }
  return result
}

export function AgentSteps({ steps, isRunning, className }: AgentStepsProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  if (steps.length === 0 && !isRunning) {
    return null
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {steps.map((step, index) => {
        const isExpanded = expandedStep === step.id
        const toolName = getToolName(step.action)
        const icon = getToolIcon(step.action)

        return (
          <div
            key={step.id}
            className={cn(
              "rounded-lg border text-xs transition-all",
              step.status === "completed" && "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
              step.status === "running" && "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
              step.status === "failed" && "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
              step.status === "pending" && "border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800/50"
            )}
          >
            <button
              onClick={() => setExpandedStep(isExpanded ? null : step.id)}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
            >
              {/* Status icon */}
              <span className="flex-shrink-0">
                {step.status === "completed" && (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                {step.status === "running" && (
                  <Loader2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-spin" />
                )}
                {step.status === "failed" && (
                  <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                )}
                {step.status === "pending" && (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-stone-300 dark:border-stone-600" />
                )}
              </span>

              {/* Tool icon */}
              <span className="flex-shrink-0">{icon}</span>

              {/* Tool name */}
              <span className={cn(
                "flex-1 font-medium truncate",
                step.status === "completed" && "text-emerald-700 dark:text-emerald-300",
                step.status === "running" && "text-amber-700 dark:text-amber-300",
                step.status === "failed" && "text-red-700 dark:text-red-300",
                step.status === "pending" && "text-stone-600 dark:text-stone-400"
              )}>
                {toolName}
              </span>

              {/* Step number */}
              <span className="text-stone-400 dark:text-stone-500 text-[10px]">
                #{index + 1}
              </span>

              {/* Expand icon */}
              {(step.result || step.error) && (
                <span className="flex-shrink-0 text-stone-400">
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </span>
              )}
            </button>

            {/* Expanded content */}
            {isExpanded && (step.result || step.error) && (
              <div className="px-2.5 pb-2 pt-0">
                <div className="rounded bg-white/50 dark:bg-black/20 p-2 font-mono text-[10px] leading-relaxed overflow-x-auto">
                  {step.error ? (
                    <span className="text-red-600 dark:text-red-400">{step.error}</span>
                  ) : (
                    <span className="text-stone-600 dark:text-stone-300">
                      {formatResult(step.result)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Current action indicator */}
      {isRunning && steps.length > 0 && steps[steps.length - 1]?.status !== "running" && (
        <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-stone-500 dark:text-stone-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Processing...</span>
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
