// Utility functions to control the agent glow effect on the active tab

export async function showAgentGlow(options?: { color?: string; pulse?: boolean }) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    const color = options?.color || '#e11d48'
    const pulse = options?.pulse ?? true

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      // @ts-ignore - runs in page context
      func: (glowColor, shouldPulse) => {
        // Remove existing glow
        const existing = document.getElementById('deer-agent-glow')
        if (existing) existing.remove()

        // Create glow overlay
        const glow = document.createElement('div')
        glow.id = 'deer-agent-glow'
        glow.style.cssText = `
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 2147483647;
          box-shadow: inset 0 0 100px 20px ${glowColor}40;
          transition: opacity 0.3s ease;
        `

        if (shouldPulse) {
          const style = document.createElement('style')
          style.id = 'deer-agent-glow-style'
          style.textContent = `
            @keyframes deer-glow-pulse {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
            #deer-agent-glow {
              animation: deer-glow-pulse 2s ease-in-out infinite;
            }
          `
          document.head.appendChild(style)
        }

        document.body.appendChild(glow)
      },
      args: [color, pulse],
    })
  } catch (error) {
    console.debug('Could not show glow:', error)
  }
}

export async function hideAgentGlow() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const glow = document.getElementById('deer-agent-glow')
        if (glow) glow.remove()
        const style = document.getElementById('deer-agent-glow-style')
        if (style) style.remove()
      },
    })
  } catch (error) {
    console.debug('Could not hide glow:', error)
  }
}

// Show glow on all selected tabs
export async function showGlowOnTabs(tabIds: number[], options?: { color?: string; pulse?: boolean }) {
  const color = options?.color || '#e11d48'
  const pulse = options?.pulse ?? true

  const promises = tabIds.map(async (tabId) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        // @ts-ignore
        func: (glowColor, shouldPulse) => {
          const existing = document.getElementById('deer-agent-glow')
          if (existing) existing.remove()

          const glow = document.createElement('div')
          glow.id = 'deer-agent-glow'
          glow.style.cssText = `
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 2147483647;
            box-shadow: inset 0 0 100px 20px ${glowColor}40;
          `

          if (shouldPulse) {
            const style = document.createElement('style')
            style.id = 'deer-agent-glow-style'
            style.textContent = `
              @keyframes deer-glow-pulse {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
              }
              #deer-agent-glow {
                animation: deer-glow-pulse 2s ease-in-out infinite;
              }
            `
            document.head.appendChild(style)
          }

          document.body.appendChild(glow)
        },
        args: [color, pulse],
      })
    } catch {
      // Ignore errors for individual tabs
    }
  })
  await Promise.all(promises)
}

// Hide glow on all tabs
export async function hideGlowOnAllTabs() {
  try {
    const tabs = await chrome.tabs.query({})
    const promises = tabs.map(async (tab) => {
      if (tab.id) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const glow = document.getElementById('deer-agent-glow')
              if (glow) glow.remove()
              const style = document.getElementById('deer-agent-glow-style')
              if (style) style.remove()
            },
          })
        } catch {
          // Ignore errors for individual tabs
        }
      }
    })
    await Promise.all(promises)
  } catch (error) {
    console.debug('Could not hide glow on all tabs:', error)
  }
}
