import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_end",
}

const GLOW_ID = "deer-agent-glow-overlay"

function createGlowOverlay(): HTMLDivElement {
  const existing = document.getElementById(GLOW_ID)
  if (existing) return existing as HTMLDivElement

  const overlay = document.createElement("div")
  overlay.id = GLOW_ID
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 2147483646;
    opacity: 0;
    transition: opacity 0.3s ease;
    box-shadow: inset 0 0 60px 20px rgba(59, 130, 246, 0.5),
                inset 0 0 100px 40px rgba(59, 130, 246, 0.3),
                inset 0 0 140px 60px rgba(59, 130, 246, 0.1);
    border: 3px solid rgba(59, 130, 246, 0.6);
    border-radius: 0;
  `
  document.body.appendChild(overlay)
  return overlay
}

function showGlow(color?: string) {
  const overlay = createGlowOverlay()

  // Allow custom color
  if (color) {
    overlay.style.boxShadow = `
      inset 0 0 60px 20px ${color}80,
      inset 0 0 100px 40px ${color}4D,
      inset 0 0 140px 60px ${color}1A
    `
    overlay.style.borderColor = `${color}99`
  }

  // Trigger reflow for animation
  overlay.offsetHeight
  overlay.style.opacity = "1"
}

function hideGlow() {
  const overlay = document.getElementById(GLOW_ID)
  if (overlay) {
    overlay.style.opacity = "0"
    // Remove after animation
    setTimeout(() => {
      overlay.remove()
    }, 300)
  }
}

function pulseGlow() {
  const overlay = document.getElementById(GLOW_ID)
  if (overlay) {
    overlay.style.animation = "deer-glow-pulse 2s ease-in-out infinite"
  }
}

// Add pulse animation style
const style = document.createElement("style")
style.textContent = `
  @keyframes deer-glow-pulse {
    0%, 100% {
      opacity: 1;
      box-shadow: inset 0 0 60px 20px rgba(59, 130, 246, 0.5),
                  inset 0 0 100px 40px rgba(59, 130, 246, 0.3),
                  inset 0 0 140px 60px rgba(59, 130, 246, 0.1);
    }
    50% {
      opacity: 0.7;
      box-shadow: inset 0 0 40px 15px rgba(59, 130, 246, 0.4),
                  inset 0 0 70px 30px rgba(59, 130, 246, 0.2),
                  inset 0 0 100px 45px rgba(59, 130, 246, 0.1);
    }
  }
`
document.head.appendChild(style)

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DEER_AGENT_GLOW") {
    if (message.action === "show") {
      showGlow(message.color)
      if (message.pulse) {
        pulseGlow()
      }
    } else if (message.action === "hide") {
      hideGlow()
    }
    sendResponse({ success: true })
  }
  return true
})

// Export for use by other scripts
export { showGlow, hideGlow, pulseGlow }
