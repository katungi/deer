/**
 * Deer Background Service Worker
 *
 * Handles:
 * - Side panel management
 * - Message routing between content scripts and sidepanel
 * - Agent coordination
 */

// ============================================================================
// Side Panel Management
// ============================================================================

// Listen for clicks on the extension icon
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id })
    console.log('[Background] Side panel opened for tab:', tab.id)
  } catch (error) {
    console.error('[Background] Failed to open side panel:', error)
  }
})

// Set the side panel behavior to be available on all tabs
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('[Background] Failed to set panel behavior:', error))
})

// ============================================================================
// Message Routing
// ============================================================================

interface DeerMessage {
  type: string
  action?: string
  tabId?: number
  [key: string]: any
}

interface DeerResponse {
  success: boolean
  error?: string
  [key: string]: any
}

// Route messages between sidepanel and content scripts
chrome.runtime.onMessage.addListener((
  message: DeerMessage,
  sender,
  sendResponse: (response: DeerResponse) => void
) => {
  // Handle messages from sidepanel to content scripts
  if (message.type === 'DEER_TO_CONTENT') {
    handleSidepanelToContentMessage(message, sendResponse)
    return true // Keep the message channel open
  }

  // Handle messages from content scripts to sidepanel
  if (message.type === 'DEER_FROM_CONTENT') {
    handleContentToSidepanelMessage(message, sender, sendResponse)
    return true
  }

  // Handle agent coordination messages
  if (message.type === 'DEER_AGENT') {
    handleAgentMessage(message, sender, sendResponse)
    return true
  }

  return false
})

async function handleSidepanelToContentMessage(
  message: DeerMessage,
  sendResponse: (response: DeerResponse) => void
) {
  try {
    // Get the target tab
    let tabId = message.tabId
    if (!tabId) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      tabId = tab?.id
    }

    if (!tabId) {
      sendResponse({ success: false, error: 'No active tab found' })
      return
    }

    // Forward message to content script
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'DEER_DOM',
      action: message.action,
      ...message.data,
    })

    sendResponse(response)
  } catch (error) {
    console.error('[Background] Error forwarding message to content:', error)
    sendResponse({ success: false, error: String(error) })
  }
}

async function handleContentToSidepanelMessage(
  message: DeerMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: DeerResponse) => void
) {
  try {
    // Broadcast to all extension views (sidepanel, popup, etc.)
    const views = chrome.extension.getViews({ type: 'popup' })
    for (const view of views) {
      view.postMessage({
        type: 'DEER_CONTENT_UPDATE',
        tabId: sender.tab?.id,
        ...message.data,
      }, '*')
    }
    sendResponse({ success: true })
  } catch (error) {
    console.error('[Background] Error forwarding message to sidepanel:', error)
    sendResponse({ success: false, error: String(error) })
  }
}

async function handleAgentMessage(
  message: DeerMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: DeerResponse) => void
) {
  const { action } = message

  switch (action) {
    case 'getActiveTab':
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        sendResponse({
          success: true,
          tab: tab ? { id: tab.id, url: tab.url, title: tab.title } : null
        })
      } catch (error) {
        sendResponse({ success: false, error: String(error) })
      }
      break

    case 'executeInTab':
      try {
        const tabId = message.tabId
        if (!tabId) {
          sendResponse({ success: false, error: 'No tab ID provided' })
          return
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: new Function(`return (${message.code})()`) as () => any,
        })

        sendResponse({ success: true, result: results[0]?.result })
      } catch (error) {
        sendResponse({ success: false, error: String(error) })
      }
      break

    case 'screenshot':
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
          format: message.format || 'png',
          quality: message.quality || 90,
        })
        sendResponse({ success: true, dataUrl })
      } catch (error) {
        sendResponse({ success: false, error: String(error) })
      }
      break

    default:
      sendResponse({ success: false, error: `Unknown agent action: ${action}` })
  }
}

// ============================================================================
// Tab Event Listeners (for future use)
// ============================================================================

// Notify content script when tab becomes active
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // Could notify sidepanel about tab change
    console.log('[Background] Tab activated:', activeInfo.tabId)
  } catch (error) {
    console.error('[Background] Error handling tab activation:', error)
  }
})

// Handle tab updates (URL changes, loading states)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('[Background] Tab loaded:', tabId, tab.url)
    // Could notify sidepanel about page load
  }
})

console.log('[Background] Deer background service worker initialized')
