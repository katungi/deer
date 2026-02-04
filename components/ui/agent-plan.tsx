import { cn } from "@/lib/utils"
import { Check, Loader2, Circle, ChevronDown, ChevronRight } from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import type { AgentPlan, PlanItem } from "@/lib/ai/types"

interface AgentPlanProps {
  plan: AgentPlan
  className?: string
  defaultCollapsed?: boolean
}

export function AgentPlanDisplay({ plan, className, defaultCollapsed }: AgentPlanProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed ?? false)

  // Count completed items
  const completedCount = useMemo(() =>
    plan.items.filter(item => item.status === 'completed').length,
    [plan.items]
  )

  // Auto-collapse when all items are completed
  useEffect(() => {
    if (plan.items.length > 0 && completedCount === plan.items.length) {
      const timer = setTimeout(() => setIsCollapsed(true), 500)
      return () => clearTimeout(timer)
    }
  }, [plan.items.length, completedCount])

  if (plan.items.length === 0) {
    return null
  }

  const hasActiveItem = plan.items.some(item => item.status === 'in_progress')
  const allComplete = completedCount === plan.items.length

  return (
    <div className={cn(
      "rounded-xl overflow-hidden border transition-all duration-300",
      allComplete
        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
        : hasActiveItem
          ? "bg-stone-50 dark:bg-stone-800/50 border-theme glow-theme-subtle"
          : "bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700",
      className
    )}>
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/50 dark:hover:bg-stone-700/30 transition-colors"
      >
        <span className={cn(
          "flex-shrink-0",
          allComplete ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400 dark:text-stone-500"
        )}>
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>

        {/* Todo list icon */}
        <span className="text-sm">📋</span>

        <span className={cn(
          "flex-1 text-sm font-medium",
          allComplete
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-stone-700 dark:text-stone-200"
        )}>
          {allComplete ? (
            <>Plan completed</>
          ) : hasActiveItem ? (
            <>Executing plan...</>
          ) : (
            <>To-do list</>
          )}
        </span>

        {/* Progress indicator */}
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full",
          allComplete
            ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300"
            : "bg-stone-200 dark:bg-stone-600 text-stone-600 dark:text-stone-300"
        )}>
          {completedCount}/{plan.items.length}
        </span>
      </button>

      {/* Plan items */}
      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-1">
          {plan.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2.5 py-1.5"
            >
              {/* Status indicator */}
              <div className="flex-shrink-0 mt-0.5">
                {item.status === 'completed' && (
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </div>
                )}
                {item.status === 'in_progress' && (
                  <div className="w-4 h-4 rounded-full border-2 border-theme flex items-center justify-center glow-theme-subtle">
                    <Loader2 className="h-2.5 w-2.5 text-theme animate-spin" />
                  </div>
                )}
                {item.status === 'pending' && (
                  <div className="w-4 h-4 rounded-full border-2 border-stone-300 dark:border-stone-500" />
                )}
              </div>

              {/* Item text */}
              <span className={cn(
                "text-sm flex-1",
                item.status === 'completed' && "text-stone-500 dark:text-stone-400 line-through",
                item.status === 'in_progress' && "text-theme font-medium",
                item.status === 'pending' && "text-stone-600 dark:text-stone-300"
              )}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Helper to parse plan from markdown text
export function parsePlanFromText(text: string): AgentPlan | null {
  // Look for plan format: **Plan:**\n1. ...\n2. ... or similar variations
  const planMatch = text.match(/\*?\*?Plan:?\*?\*?\s*\n((?:\d+\.\s+.+(?:\n|$))+)/i)

  if (!planMatch) {
    // Try alternative format without "Plan:" header
    const numberedListMatch = text.match(/^(\d+\.\s+.+(?:\n\d+\.\s+.+)*)$/m)
    if (!numberedListMatch) return null
  }

  const planText = planMatch ? planMatch[1] : text

  // Extract numbered items
  const itemMatches = planText.matchAll(/(\d+)\.\s+(.+?)(?=\n\d+\.|\n*$)/g)
  const items: PlanItem[] = []

  for (const match of itemMatches) {
    items.push({
      id: `plan-${match[1]}`,
      text: match[2].trim(),
      status: 'pending'
    })
  }

  if (items.length === 0) return null

  return { items }
}
