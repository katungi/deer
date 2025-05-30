// Listen for clicks on the extension icon
chrome.action.onClicked.addListener(async (tab) => {
  // Open the side panel for the current tab
  try {
    await chrome.sidePanel.open({ tabId: tab.id })
  } catch (error) {
    console.error('Failed to open side panel:', error)
  }
})

// Optional: Set the side panel behavior to be available on all tabs
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Failed to set panel behavior:', error))
}) 