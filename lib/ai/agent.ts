import { generateText, jsonSchema, type ModelMessage } from 'ai'
import { createProvider } from './provider'
import { browserTools } from './tools'
import type { AIConfig, AgentState, AgentStep } from './types'

// Define tools using jsonSchema from AI SDK (avoids Zod bundler issues)
// Pass the JSON schema directly from browserTools
const tools = {
  navigate: {
    description: browserTools.navigate.description,
    inputSchema: jsonSchema(browserTools.navigate.parameters),
    execute: async ({ url }: { url: string }) => browserTools.navigate.execute({ url }),
  },
  createTab: {
    description: browserTools.createTab.description,
    inputSchema: jsonSchema(browserTools.createTab.parameters),
    execute: async ({ url, active }: { url?: string; active?: boolean }) =>
      browserTools.createTab.execute({ url, active }),
  },
  closeTab: {
    description: browserTools.closeTab.description,
    inputSchema: jsonSchema(browserTools.closeTab.parameters),
    execute: async ({ tabId }: { tabId: number }) => browserTools.closeTab.execute({ tabId }),
  },
  getTabs: {
    description: browserTools.getTabs.description,
    inputSchema: jsonSchema(browserTools.getTabs.parameters),
    execute: async () => browserTools.getTabs.execute(),
  },
  getActiveTab: {
    description: browserTools.getActiveTab.description,
    inputSchema: jsonSchema(browserTools.getActiveTab.parameters),
    execute: async () => browserTools.getActiveTab.execute(),
  },
  switchTab: {
    description: browserTools.switchTab.description,
    inputSchema: jsonSchema(browserTools.switchTab.parameters),
    execute: async ({ tabId }: { tabId: number }) => browserTools.switchTab.execute({ tabId }),
  },
  screenshot: {
    description: browserTools.screenshot.description,
    inputSchema: jsonSchema(browserTools.screenshot.parameters),
    execute: async ({ format }: { format?: 'png' | 'jpeg' }) => browserTools.screenshot.execute({ format }),
  },
  executeScript: {
    description: browserTools.executeScript.description,
    inputSchema: jsonSchema(browserTools.executeScript.parameters),
    execute: async ({ code }: { code: string }) => browserTools.executeScript.execute({ code }),
  },
  // New DOM-aware tools
  getPageDOM: {
    description: 'Get the page DOM as a structured accessibility tree. Use this BEFORE any click/type actions to see what elements are available. Each element has an [id] you can use with clickElement/typeInElement.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {},
      required: [],
    }),
    execute: async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) return { success: false, error: 'No active tab' }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // DOM serialization logic - runs in page context
            let nextElementId = 1
            const elementIdAttr = 'data-deer-id'

            function isElementVisible(element: Element): boolean {
              const style = window.getComputedStyle(element)
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false
              }
              const rect = element.getBoundingClientRect()
              if (rect.width === 0 && rect.height === 0) {
                return false
              }
              return true
            }

            function isInteractiveElement(element: Element): boolean {
              const tagName = element.tagName.toLowerCase()
              const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'details', 'summary']
              if (interactiveTags.includes(tagName)) return true

              const role = element.getAttribute('role')
              const interactiveRoles = [
                'button', 'link', 'checkbox', 'radio', 'textbox', 'combobox',
                'listbox', 'menu', 'menuitem', 'option', 'tab', 'switch', 'slider',
              ]
              if (role && interactiveRoles.includes(role)) return true

              if (element.hasAttribute('onclick') || element.hasAttribute('tabindex')) return true
              if (element.getAttribute('contenteditable') === 'true') return true

              return false
            }

            function getInputRole(input: HTMLInputElement): string {
              const type = input.type?.toLowerCase() || 'text'
              const typeRoleMap: Record<string, string> = {
                text: 'textbox', email: 'textbox', password: 'textbox', search: 'searchbox',
                tel: 'textbox', url: 'textbox', number: 'spinbutton', range: 'slider',
                checkbox: 'checkbox', radio: 'radio', button: 'button', submit: 'button', reset: 'button',
              }
              return typeRoleMap[type] || 'textbox'
            }

            function getElementRole(element: Element): string {
              const explicitRole = element.getAttribute('role')
              if (explicitRole) return explicitRole

              const tagName = element.tagName.toLowerCase()
              const tagRoleMap: Record<string, string> = {
                a: 'link', button: 'button', input: getInputRole(element as HTMLInputElement),
                select: 'combobox', textarea: 'textbox', img: 'img', nav: 'navigation',
                main: 'main', header: 'banner', footer: 'contentinfo', aside: 'complementary',
                article: 'article', section: 'region', form: 'form', table: 'table',
                ul: 'list', ol: 'list', li: 'listitem',
                h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
                dialog: 'dialog',
              }
              return tagRoleMap[tagName] || tagName
            }

            function getDirectTextContent(element: Element): string {
              let text = ''
              for (const node of element.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                  text += node.textContent || ''
                }
              }
              return text.replace(/\s+/g, ' ').trim()
            }

            function getElementName(element: Element): string {
              const ariaLabel = element.getAttribute('aria-label')
              if (ariaLabel?.trim()) return ariaLabel.trim()

              const labelledBy = element.getAttribute('aria-labelledby')
              if (labelledBy) {
                const labelElement = document.getElementById(labelledBy)
                if (labelElement?.textContent?.trim()) return labelElement.textContent.trim()
              }

              if (element.tagName.toLowerCase() === 'input') {
                const input = element as HTMLInputElement
                if (input.id) {
                  const label = document.querySelector(`label[for="${input.id}"]`)
                  if (label?.textContent?.trim()) return label.textContent.trim()
                }
                if (input.placeholder?.trim()) return input.placeholder.trim()
              }

              const title = element.getAttribute('title')
              if (title?.trim()) return title.trim()

              if (element.tagName.toLowerCase() === 'img') {
                const alt = element.getAttribute('alt')
                if (alt?.trim()) return alt.trim()
              }

              if (isInteractiveElement(element)) {
                const text = getDirectTextContent(element)
                if (text) return text.slice(0, 100)
              }

              return ''
            }

            interface SerializedElement {
              id: string
              role: string
              name: string
              tagName: string
              isInteractive: boolean
              children: SerializedElement[]
            }

            function serializeElement(element: Element, depth: number = 0): SerializedElement | null {
              if (!isElementVisible(element)) return null

              const skipTags = ['script', 'style', 'noscript', 'template', 'svg', 'path', 'meta', 'link']
              if (skipTags.includes(element.tagName.toLowerCase())) return null

              // Assign ID to element for later reference
              let id = element.getAttribute(elementIdAttr)
              if (!id) {
                id = String(nextElementId++)
                element.setAttribute(elementIdAttr, id)
              }

              const role = getElementRole(element)
              const name = getElementName(element)
              const isInteractive = isInteractiveElement(element)

              const children: SerializedElement[] = []
              for (const child of element.children) {
                const serialized = serializeElement(child, depth + 1)
                if (serialized) children.push(serialized)
              }

              const hasInteractiveChild = children.some(
                (c) => c.isInteractive || c.children.some((gc) => gc.isInteractive)
              )
              if (!isInteractive && !name && !hasInteractiveChild && children.length === 0) {
                return null
              }

              return { id, role, name, tagName: element.tagName.toLowerCase(), isInteractive, children }
            }

            function formatTreeAsText(element: SerializedElement, indent: number = 0): string {
              const prefix = '  '.repeat(indent)
              const label = element.name ? `${element.role}: ${element.name}` : element.role
              let line = `${prefix}[${element.id}] ${label}`

              const childLines = element.children.map((c) => formatTreeAsText(c, indent + 1))
              if (childLines.length > 0) {
                return `${line}\n${childLines.join('\n')}`
              }
              return line
            }

            // Clean up old IDs first
            document.querySelectorAll(`[${elementIdAttr}]`).forEach(el => el.removeAttribute(elementIdAttr))
            nextElementId = 1

            const root = serializeElement(document.body)
            if (!root) {
              return { tree: '', elementCount: 0 }
            }
            return {
              tree: formatTreeAsText(root),
              elementCount: nextElementId - 1,
            }
          },
        })

        const result = results[0]?.result
        if (result) {
          return { success: true, tree: result.tree, elementCount: result.elementCount }
        }
        return { success: false, error: 'No result from page' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },
  clickElement: {
    description: 'Click an element by its ID from getPageDOM. First call getPageDOM to see available elements and their IDs.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        elementId: { type: 'string', description: 'The element ID from getPageDOM (e.g., "1", "23")' },
      },
      required: ['elementId'],
    }),
    execute: async ({ elementId }: { elementId: string }) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) return { success: false, error: 'No active tab' }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (id: string) => {
            const element = document.querySelector(`[data-deer-id="${id}"]`) as HTMLElement
            if (!element) {
              return { success: false, error: `Element with ID ${id} not found` }
            }

            // Highlight briefly
            const originalOutline = element.style.outline
            const originalOutlineOffset = element.style.outlineOffset
            element.style.outline = '3px solid #3b82f6'
            element.style.outlineOffset = '2px'
            setTimeout(() => {
              element.style.outline = originalOutline
              element.style.outlineOffset = originalOutlineOffset
            }, 1000)

            // Click the element
            element.click()
            return { success: true, clicked: id }
          },
          args: [elementId],
        })

        return results[0]?.result || { success: false, error: 'No result' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },
  typeInElement: {
    description: 'Type text into an input element by its ID from getPageDOM. First call getPageDOM to see available elements.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        elementId: { type: 'string', description: 'The element ID from getPageDOM' },
        text: { type: 'string', description: 'The text to type' },
        clear: { type: 'boolean', description: 'Whether to clear existing text first (default: false)' },
      },
      required: ['elementId', 'text'],
    }),
    execute: async ({ elementId, text, clear }: { elementId: string; text: string; clear?: boolean }) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) return { success: false, error: 'No active tab' }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (id: string, txt: string, clr: boolean) => {
            const element = document.querySelector(`[data-deer-id="${id}"]`) as HTMLInputElement | HTMLTextAreaElement
            if (!element) {
              return { success: false, error: `Element with ID ${id} not found` }
            }

            element.focus()
            if (clr) {
              element.value = ''
            }
            element.value += txt
            element.dispatchEvent(new Event('input', { bubbles: true }))
            element.dispatchEvent(new Event('change', { bubbles: true }))

            return { success: true, typed: txt.slice(0, 50) + (txt.length > 50 ? '...' : '') }
          },
          args: [elementId, text, clear || false],
        })

        return results[0]?.result || { success: false, error: 'No result' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },
  scrollToElement: {
    description: 'Scroll to an element by its ID from getPageDOM.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        elementId: { type: 'string', description: 'The element ID to scroll to' },
      },
      required: ['elementId'],
    }),
    execute: async ({ elementId }: { elementId: string }) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) return { success: false, error: 'No active tab' }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (id: string) => {
            const element = document.querySelector(`[data-deer-id="${id}"]`) as HTMLElement
            if (!element) {
              return { success: false, error: `Element with ID ${id} not found` }
            }

            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return { success: true, scrolledTo: id }
          },
          args: [elementId],
        })

        return results[0]?.result || { success: false, error: 'No result' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },
  // Keep legacy tools for backwards compatibility
  click: {
    description: browserTools.click.description,
    inputSchema: jsonSchema(browserTools.click.parameters),
    execute: async ({ selector }: { selector: string }) => browserTools.click.execute({ selector }),
  },
  type: {
    description: browserTools.type.description,
    inputSchema: jsonSchema(browserTools.type.parameters),
    execute: async ({ selector, text, clear }: { selector: string; text: string; clear?: boolean }) =>
      browserTools.type.execute({ selector, text, clear }),
  },
  getPageContent: {
    description: browserTools.getPageContent.description,
    inputSchema: jsonSchema(browserTools.getPageContent.parameters),
    execute: async ({ selector }: { selector?: string }) => browserTools.getPageContent.execute({ selector }),
  },
  scroll: {
    description: browserTools.scroll.description,
    inputSchema: jsonSchema(browserTools.scroll.parameters),
    execute: async ({
      direction,
      selector,
      pixels,
    }: {
      direction?: 'up' | 'down' | 'top' | 'bottom'
      selector?: string
      pixels?: number
    }) => browserTools.scroll.execute({ direction, selector, pixels }),
  },
  wait: {
    description: browserTools.wait.description,
    inputSchema: jsonSchema(browserTools.wait.parameters),
    execute: async ({ ms, selector, timeout }: { ms?: number; selector?: string; timeout?: number }) =>
      browserTools.wait.execute({ ms, selector, timeout }),
  },
}

const AGENT_SYSTEM_PROMPT = `You are Deer, an intelligent browser automation agent. Your job is to help users accomplish tasks on web pages.

## CRITICAL WORKFLOW
For ANY task that involves interacting with a web page, you MUST follow this workflow:

1. FIRST: Call getPageDOM to see the page structure and available elements
2. ANALYZE: Look at the DOM tree to find the element(s) you need
3. ACT: Use clickElement, typeInElement, or scrollToElement with the element ID
4. VERIFY: After each action, call getPageDOM again to see the result
5. CONTINUE: Keep taking actions until the task is complete

## AVAILABLE TOOLS
- getPageDOM: Get the page structure as an accessibility tree. ALWAYS call this first!
- clickElement: Click an element by ID (from getPageDOM)
- typeInElement: Type text into an element by ID
- scrollToElement: Scroll to an element by ID
- navigate: Go to a URL
- createTab/closeTab/getTabs/switchTab: Manage browser tabs
- screenshot: Capture a screenshot
- wait: Wait for time or changes

## DOM TREE FORMAT
The DOM tree shows elements like:
[1] button: Sign In
[2] textbox: Email address
[3] link: Forgot password?

Use the number in brackets as the elementId for click/type/scroll actions.

## IMPORTANT RULES
- NEVER guess element IDs - always get them from getPageDOM first
- After clicking something that changes the page, call getPageDOM again
- If an element is not visible, try scrolling first
- Be persistent - if one approach fails, try another
- Report your progress after each action

## EXAMPLE
User: "Log into my account with email test@example.com"

1. First I'll get the page DOM to see what's available...
   [calls getPageDOM]
2. I see a textbox [2] for email. Let me type the email...
   [calls typeInElement with elementId="2", text="test@example.com"]
3. Now let me check the page again to find the submit button...
   [calls getPageDOM]
4. I see a button [5] for Sign In. Let me click it...
   [calls clickElement with elementId="5"]
5. Done! The login form was submitted.

Always think step by step and keep working until the task is complete!`

export interface AgentCallbacks {
  onStep?: (step: AgentStep) => void
  onStateChange?: (state: AgentState) => void
  onText?: (text: string) => void
}

export class BrowserAgent {
  private config: AIConfig
  private state: AgentState
  private callbacks: AgentCallbacks

  constructor(config: AIConfig, callbacks: AgentCallbacks = {}) {
    this.config = config
    this.callbacks = callbacks
    this.state = {
      isRunning: false,
      currentStep: '',
      steps: [],
    }
  }

  private updateState(updates: Partial<AgentState>) {
    this.state = { ...this.state, ...updates }
    this.callbacks.onStateChange?.(this.state)
  }

  private addStep(step: Omit<AgentStep, 'id'>): AgentStep {
    const newStep: AgentStep = {
      ...step,
      id: Date.now().toString(),
    }
    this.state.steps.push(newStep)
    this.callbacks.onStep?.(newStep)
    return newStep
  }

  private updateStep(stepId: string, updates: Partial<AgentStep>) {
    const step = this.state.steps.find((s) => s.id === stepId)
    if (step) {
      Object.assign(step, updates)
      this.callbacks.onStep?.(step)
    }
  }

  async run(messages: ModelMessage[], maxSteps = 20): Promise<string> {
    this.updateState({
      isRunning: true,
      currentStep: 'Processing...',
      steps: [],
    })

    try {
      const model = createProvider(this.config)

      const result = await generateText({
        model,
        system: AGENT_SYSTEM_PROMPT,
        messages,
        tools,
        maxSteps, // Use maxSteps directly instead of stopWhen for better multi-step handling
        toolChoice: 'auto', // Let the model decide when to use tools
        onStepFinish: ({ text, toolCalls, toolResults }) => {
          // Handle text output
          if (text) {
            this.callbacks.onText?.(text)
          }

          // Handle tool calls
          if (toolCalls && toolCalls.length > 0) {
            for (const tc of toolCalls as any[]) {
              const step = this.addStep({
                action: `${tc.toolName}: ${JSON.stringify(tc.args)}`,
                status: 'running',
              })

              // Find corresponding result
              const correspondingResult = (toolResults as any[])?.find(
                (tr) => tr.toolCallId === tc.toolCallId
              )

              if (correspondingResult) {
                const resultStr = typeof correspondingResult.result === 'object'
                  ? JSON.stringify(correspondingResult.result)
                  : String(correspondingResult.result)

                this.updateStep(step.id, {
                  status: correspondingResult.result?.success === false ? 'failed' : 'completed',
                  result: resultStr.slice(0, 500), // Truncate long results for display
                  error: correspondingResult.result?.error,
                })
              }
            }
          }
        },
      })

      this.updateState({
        isRunning: false,
        currentStep: 'Done',
      })

      // Combine all text outputs
      const fullText = result.text || 'Task completed.'
      return fullText
    } catch (error) {
      console.error('Agent error:', error)
      this.updateState({
        isRunning: false,
        currentStep: 'Error',
      })
      throw error
    }
  }

  stop() {
    this.updateState({
      isRunning: false,
      currentStep: 'Stopped',
    })
  }

  getState(): AgentState {
    return { ...this.state }
  }
}

// Convenience function for one-shot agent tasks
export async function runAgent(
  config: AIConfig,
  task: string,
  callbacks?: AgentCallbacks
): Promise<string> {
  const agent = new BrowserAgent(config, callbacks)
  return agent.run([{ role: 'user', content: task }])
}
