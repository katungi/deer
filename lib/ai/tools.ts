// Browser automation tools that the AI agent can use
// Using direct JSON schema format for Anthropic compatibility

export const browserTools = {
  navigate: {
    description: 'Navigate the current tab to a specified URL',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to navigate to' },
      },
      required: ['url'],
    },
    execute: async ({ url }: { url: string }) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url })
        return { success: true, url }
      }
      return { success: false, error: 'No active tab found' }
    },
  },

  createTab: {
    description: 'Create a new browser tab with an optional URL',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL for the new tab' },
        active: { type: 'boolean', description: 'Whether to make the new tab active' },
      },
      required: [],
    },
    execute: async ({ url, active = true }: { url?: string; active?: boolean }) => {
      const tab = await chrome.tabs.create({ url, active })
      return { success: true, tabId: tab.id, url: tab.url }
    },
  },

  closeTab: {
    description: 'Close a browser tab by its ID',
    parameters: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: 'The ID of the tab to close' },
      },
      required: ['tabId'],
    },
    execute: async ({ tabId }: { tabId: number }) => {
      await chrome.tabs.remove(tabId)
      return { success: true, closedTabId: tabId }
    },
  },

  getTabs: {
    description: 'Get a list of all open browser tabs',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      const tabs = await chrome.tabs.query({})
      return {
        tabs: tabs.map((t) => ({
          id: t.id,
          title: t.title,
          url: t.url,
          active: t.active,
          favIconUrl: t.favIconUrl,
        })),
      }
    },
  },

  getActiveTab: {
    description: 'Get information about the currently active tab',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab) {
        return {
          id: tab.id,
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl,
        }
      }
      return { error: 'No active tab found' }
    },
  },

  switchTab: {
    description: 'Switch to a specific tab by its ID',
    parameters: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: 'The ID of the tab to switch to' },
      },
      required: ['tabId'],
    },
    execute: async ({ tabId }: { tabId: number }) => {
      await chrome.tabs.update(tabId, { active: true })
      const tab = await chrome.tabs.get(tabId)
      return { success: true, tab: { id: tab.id, title: tab.title, url: tab.url } }
    },
  },

  screenshot: {
    description: 'Capture a screenshot of the currently visible tab',
    parameters: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['png', 'jpeg'], description: 'Image format' },
      },
      required: [],
    },
    execute: async ({ format = 'png' }: { format?: 'png' | 'jpeg' }) => {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
          format,
          quality: 90,
        })
        return { success: true, dataUrl }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },

  executeScript: {
    description: 'Execute JavaScript code in the current tab. Use this to interact with page content.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to execute in the page context' },
      },
      required: ['code'],
    },
    execute: async ({ code }: { code: string }) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        return { success: false, error: 'No active tab' }
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (codeStr: string) => {
            try {
              return { result: eval(codeStr) }
            } catch (e) {
              return { error: String(e) }
            }
          },
          args: [code],
        })

        return results[0]?.result || { error: 'No result' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },

  click: {
    description: 'Click an element on the page using a CSS selector',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the element to click' },
      },
      required: ['selector'],
    },
    execute: async ({ selector }: { selector: string }) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        return { success: false, error: 'No active tab' }
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (sel: string) => {
            const el = document.querySelector(sel) as HTMLElement
            if (el) {
              el.click()
              return { success: true, clicked: sel }
            }
            return { success: false, error: `Element not found: ${sel}` }
          },
          args: [selector],
        })

        return results[0]?.result || { error: 'No result' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },

  type: {
    description: 'Type text into an input field using a CSS selector',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the input element' },
        text: { type: 'string', description: 'Text to type into the input' },
        clear: { type: 'boolean', description: 'Whether to clear existing text first' },
      },
      required: ['selector', 'text'],
    },
    execute: async ({ selector, text, clear = false }: { selector: string; text: string; clear?: boolean }) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        return { success: false, error: 'No active tab' }
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (sel: string, txt: string, clr: boolean) => {
            const el = document.querySelector(sel) as HTMLInputElement
            if (el) {
              if (clr) el.value = ''
              el.value += txt
              el.dispatchEvent(new Event('input', { bubbles: true }))
              el.dispatchEvent(new Event('change', { bubbles: true }))
              return { success: true, selector: sel }
            }
            return { success: false, error: `Element not found: ${sel}` }
          },
          args: [selector, text, clear],
        })

        return results[0]?.result || { error: 'No result' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },

  getPageContent: {
    description: 'Get the text content of the current page or a specific element',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for a specific element (omit for entire page)' },
      },
      required: [],
    },
    execute: async ({ selector }: { selector?: string }) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        return { success: false, error: 'No active tab' }
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (sel?: string) => {
            const el = sel ? document.querySelector(sel) : document.body
            if (el) {
              return {
                success: true,
                content: el.textContent?.slice(0, 10000),
                title: document.title,
                url: window.location.href,
              }
            }
            return { success: false, error: sel ? `Element not found: ${sel}` : 'No body element' }
          },
          args: [selector],
        })

        return results[0]?.result || { error: 'No result' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },

  scroll: {
    description: 'Scroll the page by a specified amount or to an element',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom'], description: 'Direction to scroll' },
        selector: { type: 'string', description: 'CSS selector of element to scroll to' },
        pixels: { type: 'number', description: 'Number of pixels to scroll' },
      },
      required: [],
    },
    execute: async ({ direction, selector, pixels }: { direction?: string; selector?: string; pixels?: number }) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        return { success: false, error: 'No active tab' }
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (dir?: string, sel?: string, px?: number) => {
            if (sel) {
              const el = document.querySelector(sel)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                return { success: true, scrolledTo: sel }
              }
              return { success: false, error: `Element not found: ${sel}` }
            }

            const scrollAmount = px || 500
            switch (dir) {
              case 'up':
                window.scrollBy(0, -scrollAmount)
                break
              case 'down':
                window.scrollBy(0, scrollAmount)
                break
              case 'top':
                window.scrollTo(0, 0)
                break
              case 'bottom':
                window.scrollTo(0, document.body.scrollHeight)
                break
              default:
                window.scrollBy(0, scrollAmount)
            }
            return { success: true, direction: dir || 'down' }
          },
          args: [direction, selector, pixels],
        })

        return results[0]?.result || { error: 'No result' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },

  wait: {
    description: 'Wait for a specified duration or for an element to appear',
    parameters: {
      type: 'object',
      properties: {
        ms: { type: 'number', description: 'Milliseconds to wait' },
        selector: { type: 'string', description: 'CSS selector to wait for' },
        timeout: { type: 'number', description: 'Maximum time to wait in ms (default 5000)' },
      },
      required: [],
    },
    execute: async ({ ms, selector, timeout = 5000 }: { ms?: number; selector?: string; timeout?: number }) => {
      if (ms) {
        await new Promise((resolve) => setTimeout(resolve, ms))
        return { success: true, waited: ms }
      }

      if (selector) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) {
          return { success: false, error: 'No active tab' }
        }

        const startTime = Date.now()
        while (Date.now() - startTime < timeout) {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (sel: string) => !!document.querySelector(sel),
            args: [selector],
          })

          if (results[0]?.result) {
            return { success: true, found: selector }
          }
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        return { success: false, error: `Timeout waiting for: ${selector}` }
      }

      return { success: false, error: 'Must specify ms or selector' }
    },
  },
}

export type BrowserToolName = keyof typeof browserTools
