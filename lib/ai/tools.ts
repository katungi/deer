import { tool } from 'ai'
import { z } from 'zod'

// Browser automation tools that the AI agent can use

export const browserTools = {
  // Navigate to a URL
  navigate: tool({
    description: 'Navigate the current tab to a specified URL',
    parameters: z.object({
      url: z.string().describe('The URL to navigate to'),
    }),
    execute: async ({ url }) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url })
        return { success: true, url }
      }
      return { success: false, error: 'No active tab found' }
    },
  }),

  // Create a new tab
  createTab: tool({
    description: 'Create a new browser tab with an optional URL',
    parameters: z.object({
      url: z.string().optional().describe('The URL for the new tab'),
      active: z.boolean().default(true).describe('Whether to make the new tab active'),
    }),
    execute: async ({ url, active }) => {
      const tab = await chrome.tabs.create({ url, active })
      return { success: true, tabId: tab.id, url: tab.url }
    },
  }),

  // Close a tab
  closeTab: tool({
    description: 'Close a browser tab by its ID',
    parameters: z.object({
      tabId: z.number().describe('The ID of the tab to close'),
    }),
    execute: async ({ tabId }) => {
      await chrome.tabs.remove(tabId)
      return { success: true, closedTabId: tabId }
    },
  }),

  // Get all open tabs
  getTabs: tool({
    description: 'Get a list of all open browser tabs',
    parameters: z.object({}),
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
  }),

  // Get the active tab
  getActiveTab: tool({
    description: 'Get information about the currently active tab',
    parameters: z.object({}),
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
  }),

  // Switch to a specific tab
  switchTab: tool({
    description: 'Switch to a specific tab by its ID',
    parameters: z.object({
      tabId: z.number().describe('The ID of the tab to switch to'),
    }),
    execute: async ({ tabId }) => {
      await chrome.tabs.update(tabId, { active: true })
      const tab = await chrome.tabs.get(tabId)
      return { success: true, tab: { id: tab.id, title: tab.title, url: tab.url } }
    },
  }),

  // Take a screenshot of the current tab
  screenshot: tool({
    description: 'Capture a screenshot of the currently visible tab',
    parameters: z.object({
      format: z.enum(['png', 'jpeg']).default('png').describe('Image format'),
    }),
    execute: async ({ format }) => {
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
  }),

  // Execute JavaScript in the current tab
  executeScript: tool({
    description: 'Execute JavaScript code in the current tab. Use this to interact with page content.',
    parameters: z.object({
      code: z.string().describe('JavaScript code to execute in the page context'),
    }),
    execute: async ({ code }) => {
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
  }),

  // Click an element on the page
  click: tool({
    description: 'Click an element on the page using a CSS selector',
    parameters: z.object({
      selector: z.string().describe('CSS selector for the element to click'),
    }),
    execute: async ({ selector }) => {
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
  }),

  // Type text into an input field
  type: tool({
    description: 'Type text into an input field using a CSS selector',
    parameters: z.object({
      selector: z.string().describe('CSS selector for the input element'),
      text: z.string().describe('Text to type into the input'),
      clear: z.boolean().default(false).describe('Whether to clear existing text first'),
    }),
    execute: async ({ selector, text, clear }) => {
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
  }),

  // Get page content/text
  getPageContent: tool({
    description: 'Get the text content of the current page or a specific element',
    parameters: z.object({
      selector: z.string().optional().describe('CSS selector for a specific element (omit for entire page)'),
    }),
    execute: async ({ selector }) => {
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
                content: el.textContent?.slice(0, 10000), // Limit content size
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
  }),

  // Scroll the page
  scroll: tool({
    description: 'Scroll the page by a specified amount or to an element',
    parameters: z.object({
      direction: z.enum(['up', 'down', 'top', 'bottom']).optional(),
      selector: z.string().optional().describe('CSS selector of element to scroll to'),
      pixels: z.number().optional().describe('Number of pixels to scroll'),
    }),
    execute: async ({ direction, selector, pixels }) => {
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
  }),

  // Wait for a condition
  wait: tool({
    description: 'Wait for a specified duration or for an element to appear',
    parameters: z.object({
      ms: z.number().optional().describe('Milliseconds to wait'),
      selector: z.string().optional().describe('CSS selector to wait for'),
      timeout: z.number().default(5000).describe('Maximum time to wait in ms'),
    }),
    execute: async ({ ms, selector, timeout }) => {
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
  }),
}

export type BrowserToolName = keyof typeof browserTools
