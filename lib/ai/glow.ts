// Utility functions to control the agent glow effect on the active tab

export async function showAgentGlow(options?: { color?: string; pulse?: boolean }) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: "DEER_AGENT_GLOW",
        action: "show",
        color: options?.color,
        pulse: options?.pulse ?? true,
      })
    }
  } catch (error) {
    // Content script might not be loaded yet, ignore
    console.debug("Could not show glow:", error)
  }
}

export async function hideAgentGlow() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: "DEER_AGENT_GLOW",
        action: "hide",
      })
    }
  } catch (error) {
    // Content script might not be loaded yet, ignore
    console.debug("Could not hide glow:", error)
  }
}

// Show glow on all selected tabs
export async function showGlowOnTabs(tabIds: number[], options?: { color?: string; pulse?: boolean }) {
  const promises = tabIds.map(async (tabId) => {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "DEER_AGENT_GLOW",
        action: "show",
        color: options?.color,
        pulse: options?.pulse ?? true,
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
          await chrome.tabs.sendMessage(tab.id, {
            type: "DEER_AGENT_GLOW",
            action: "hide",
          })
        } catch {
          // Ignore errors for individual tabs
        }
      }
    })
    await Promise.all(promises)
  } catch (error) {
    console.debug("Could not hide glow on all tabs:", error)
  }
}
