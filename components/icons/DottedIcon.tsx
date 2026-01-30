import * as React from "react"
import { cn } from "@/lib/utils"

interface DottedIconProps {
  children: React.ReactNode
  className?: string
  dotSize?: number
  gap?: number
}

/**
 * Wrapper component that applies a dotted/pixelated effect to icons
 * Uses CSS filter and mask to create a dot-matrix appearance
 */
export function DottedIcon({
  children,
  className,
  dotSize = 2,
  gap = 1
}: DottedIconProps) {
  const patternId = React.useId()
  const maskId = React.useId()

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {/* SVG pattern definition for the dot mask */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <pattern
            id={patternId}
            x="0"
            y="0"
            width={dotSize + gap}
            height={dotSize + gap}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={dotSize / 2}
              cy={dotSize / 2}
              r={dotSize / 2}
              fill="white"
            />
          </pattern>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
          </mask>
        </defs>
      </svg>

      {/* Icon with dotted effect applied via inline style */}
      <div
        style={{
          WebkitMask: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='dots' x='0' y='0' width='${dotSize + gap}' height='${dotSize + gap}' patternUnits='userSpaceOnUse'%3E%3Ccircle cx='${dotSize / 2}' cy='${dotSize / 2}' r='${dotSize / 2}' fill='white'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23dots)'/%3E%3C/svg%3E")`,
          mask: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='dots' x='0' y='0' width='${dotSize + gap}' height='${dotSize + gap}' patternUnits='userSpaceOnUse'%3E%3Ccircle cx='${dotSize / 2}' cy='${dotSize / 2}' r='${dotSize / 2}' fill='white'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23dots)'/%3E%3C/svg%3E")`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Alternative approach: CSS-based dotted effect using background
 * This creates a more subtle dotted overlay effect
 */
export function DottedIconAlt({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("relative inline-flex items-center justify-center dotted-icon", className)}>
      {children}
    </div>
  )
}
