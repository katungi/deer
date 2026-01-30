import * as React from "react"
import { cn } from "@/lib/utils"

interface SendIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string
}

/**
 * Pixel/block style send icon that adapts to current color
 */
export function SendIcon({ className, ...props }: SendIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-4", className)}
      {...props}
    >
      <path
        fill="currentColor"
        d="M12 18v4h4v-4h-4ZM16 14v4h4v-4h-4ZM20 10v4h4v-4h-4ZM16 6v4h4V6h-4ZM12 2v4h4V2h-4ZM12 10v4h4v-4h-4ZM8 10v4h4v-4H8ZM4 10v4h4v-4H4ZM0 10v4h4v-4H0Z"
      />
    </svg>
  )
}
