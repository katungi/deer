import { cn } from "@/lib/utils"

interface DeerMascotProps {
  className?: string
}

export function DeerMascot({ className }: DeerMascotProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("w-20 h-20", className)}
      style={{ imageRendering: "pixelated" }}
    >
      <style>{`
        @keyframes headBob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-0.5px) rotate(1deg); }
          75% { transform: translateY(0.5px) rotate(-1deg); }
        }
        @keyframes eyeBlink {
          0%, 90%, 100% { opacity: 1; }
          95% { opacity: 0; }
        }
        @keyframes earWiggle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-0.5px); }
        }
        .deer-head {
          animation: headBob 4s ease-in-out infinite;
          transform-origin: 20px 16px;
        }
        .deer-eye {
          animation: eyeBlink 5s ease-in-out infinite;
        }
        .deer-eye-right {
          animation: eyeBlink 5s ease-in-out infinite 0.1s;
        }
        .deer-ear-left {
          animation: earWiggle 3s ease-in-out infinite;
        }
        .deer-ear-right {
          animation: earWiggle 3s ease-in-out infinite 0.5s;
        }
      `}</style>

      {/* Body (static) */}
      <g className="deer-body">
        {/* Body fill */}
        <rect x="12" y="18" width="12" height="8" fill="#FFFEF0" />
        {/* Body outline */}
        <rect x="11" y="17" width="1" height="10" fill="#2D2D2D" />
        <rect x="24" y="17" width="1" height="9" fill="#2D2D2D" />
        <rect x="12" y="17" width="12" height="1" fill="#2D2D2D" />
        {/* Legs */}
        <rect x="12" y="26" width="3" height="4" fill="#FFFEF0" />
        <rect x="11" y="26" width="1" height="4" fill="#2D2D2D" />
        <rect x="15" y="26" width="1" height="4" fill="#2D2D2D" />
        <rect x="12" y="30" width="3" height="1" fill="#2D2D2D" />

        <rect x="20" y="26" width="3" height="4" fill="#FFFEF0" />
        <rect x="19" y="26" width="1" height="4" fill="#2D2D2D" />
        <rect x="23" y="26" width="1" height="4" fill="#2D2D2D" />
        <rect x="20" y="30" width="3" height="1" fill="#2D2D2D" />

        {/* Tail */}
        <rect x="8" y="17" width="3" height="1" fill="#2D2D2D" />
        <rect x="8" y="18" width="1" height="2" fill="#2D2D2D" />
      </g>

      {/* Head group (animated) */}
      <g className="deer-head">
        {/* Antlers */}
        <g className="deer-ear-left">
          <rect x="16" y="3" width="1" height="3" fill="#2D2D2D" />
          <rect x="14" y="3" width="2" height="1" fill="#2D2D2D" />
          <rect x="14" y="4" width="1" height="2" fill="#2D2D2D" />
        </g>
        <g className="deer-ear-right">
          <rect x="22" y="3" width="1" height="3" fill="#2D2D2D" />
          <rect x="23" y="3" width="2" height="1" fill="#2D2D2D" />
          <rect x="25" y="4" width="1" height="2" fill="#2D2D2D" />
        </g>

        {/* Head fill */}
        <rect x="16" y="6" width="8" height="6" fill="#FFFEF0" />
        <rect x="18" y="12" width="6" height="6" fill="#FFFEF0" />

        {/* Head outline */}
        <rect x="15" y="6" width="1" height="6" fill="#2D2D2D" />
        <rect x="16" y="5" width="8" height="1" fill="#2D2D2D" />
        <rect x="24" y="6" width="1" height="4" fill="#2D2D2D" />
        <rect x="24" y="10" width="1" height="2" fill="#FFFEF0" />
        <rect x="25" y="10" width="1" height="8" fill="#2D2D2D" />
        <rect x="17" y="12" width="1" height="4" fill="#2D2D2D" />
        <rect x="18" y="18" width="6" height="1" fill="#2D2D2D" />
        <rect x="17" y="16" width="1" height="2" fill="#2D2D2D" />

        {/* Eyes */}
        <rect x="18" y="8" width="2" height="2" fill="#2D2D2D" className="deer-eye" />
        <rect x="22" y="8" width="2" height="2" fill="#2D2D2D" className="deer-eye deer-eye-right" />

        {/* Nose */}
        <rect x="22" y="14" width="2" height="2" fill="#2D2D2D" />
      </g>
    </svg>
  )
}
