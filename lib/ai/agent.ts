import { generateText, jsonSchema, stepCountIs, type ModelMessage } from 'ai'
import { createProvider } from './provider'
import { browserTools } from './tools'
import type { AIConfig, AgentState, AgentStep, AgentPlan, PlanItem } from './types'

// Custom error class for rate limits
export class RateLimitError extends Error {
  retryAfterMs?: number

  constructor(message: string, retryAfterMs?: number) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

// Helper to detect rate limit errors
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('rate limit') ||
           message.includes('429') ||
           message.includes('too many requests')
  }
  return false
}

// Max characters for DOM tree to prevent token overflow
const MAX_DOM_CHARS = 15000

// Custom retry wrapper for rate limit handling with longer delays
async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  initialDelayMs = 10000 // Start with 10 seconds for rate limits
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (!isRateLimitError(error) || attempt === maxRetries) {
        throw error
      }

      // Exponential backoff: 10s, 20s, 40s, 60s, 60s (capped)
      const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt), 60000)
      console.log(`[Agent] Rate limit hit, waiting ${delayMs / 1000}s before retry ${attempt + 1}/${maxRetries}...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

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
  // New DOM-aware tools using content script messaging (WeakRef-based for stable element references)
  getPageDOM: {
    description: 'Get the page DOM as a structured accessibility tree. Use this BEFORE any click/type actions to see what elements are available. Each element has a [ref=ref_N] you can use with clickElement/typeInElement.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['interactive', 'all'], description: 'Filter type: "interactive" for only interactive elements, "all" for all elements including off-screen' },
      },
      required: [],
    }),
    execute: async ({ filter }: { filter?: string } = {}) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) return { success: false, error: 'No active tab' }

        // Use content script messaging for better element tracking
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: 'DEER_DOM',
          action: 'serialize',
          filter,
        })

        console.log('[getPageDOM] result:', result)

        if (result?.success && result?.pageContent !== undefined) {
          let tree = result.pageContent
          let truncated = false

          // Truncate DOM tree if too large to prevent token overflow
          if (tree.length > MAX_DOM_CHARS) {
            tree = tree.substring(0, MAX_DOM_CHARS) + '\n... (truncated - page has many elements, use filter="interactive" for fewer results)'
            truncated = true
          }

          return {
            success: true,
            tree,
            elementCount: result.elementCount,
            viewport: result.viewport,
            truncated,
          }
        }

        return { success: false, error: result?.error || 'No result from page' }
      } catch (error) {
        console.error('[getPageDOM] error:', error)
        // Fallback: try with scripting API if content script not available
        return { success: false, error: `Content script not available: ${error}. Try refreshing the page.` }
      }
    },
  },
  getPageText: {
    description: 'Get the plain text content of the page without HTML. More efficient than getPageDOM for reading articles, documentation, or long content. Use this when you need to read/understand page content rather than interact with elements.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional CSS selector to scope text extraction (e.g., "article", "main", "#content")' },
        maxLength: { type: 'number', description: 'Maximum characters to return (default: 10000)' },
      },
      required: [],
    }),
    execute: async ({ selector, maxLength = 10000 }: { selector?: string; maxLength?: number } = {}) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) return { success: false, error: 'No active tab' }

        const result = await chrome.tabs.sendMessage(tab.id, {
          type: 'DEER_DOM',
          action: 'getText',
          selector,
          maxLength,
        })

        if (result?.success) {
          return {
            success: true,
            text: result.text,
            url: result.url,
            title: result.title,
            truncated: result.truncated || false,
          }
        }

        return { success: false, error: result?.error || 'No result from page' }
      } catch (error) {
        console.error('[getPageText] error:', error)
        return { success: false, error: `Content script not available: ${error}. Try refreshing the page.` }
      }
    },
  },
  clickElement: {
    description: 'Click an element by its ref from getPageDOM (e.g., "ref_1", "ref_23"). First call getPageDOM to see available elements.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        elementId: { type: 'string', description: 'The element ref from getPageDOM (e.g., "ref_1", "ref_23")' },
      },
      required: ['elementId'],
    }),
    execute: async ({ elementId }: { elementId: string }) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) return { success: false, error: 'No active tab' }

        // Normalize the ref format
        const ref = elementId.startsWith('ref_') ? elementId : `ref_${elementId}`

        const result = await chrome.tabs.sendMessage(tab.id, {
          type: 'DEER_DOM',
          action: 'click',
          ref,
        })

        return result || { success: false, error: 'No result' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },
  typeInElement: {
    description: 'Type text into an input element by its ref from getPageDOM. First call getPageDOM to see available elements.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        elementId: { type: 'string', description: 'The element ref from getPageDOM (e.g., "ref_1")' },
        text: { type: 'string', description: 'The text to type' },
        clear: { type: 'boolean', description: 'Whether to clear existing text first (default: false)' },
      },
      required: ['elementId', 'text'],
    }),
    execute: async ({ elementId, text, clear }: { elementId: string; text: string; clear?: boolean }) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) return { success: false, error: 'No active tab' }

        // Normalize the ref format
        const ref = elementId.startsWith('ref_') ? elementId : `ref_${elementId}`

        const result = await chrome.tabs.sendMessage(tab.id, {
          type: 'DEER_DOM',
          action: 'formInput',
          ref,
          value: text,
        })

        return result || { success: false, error: 'No result' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  },
  scrollToElement: {
    description: 'Scroll to an element by its ref from getPageDOM.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        elementId: { type: 'string', description: 'The element ref to scroll to (e.g., "ref_1")' },
      },
      required: ['elementId'],
    }),
    execute: async ({ elementId }: { elementId: string }) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) return { success: false, error: 'No active tab' }

        // Normalize the ref format
        const ref = elementId.startsWith('ref_') ? elementId : `ref_${elementId}`

        const result = await chrome.tabs.sendMessage(tab.id, {
          type: 'DEER_DOM',
          action: 'scroll',
          ref,
        })

        return result || { success: false, error: 'No result' }
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
  requestPermission: {
    description: 'Request user permission before performing sensitive actions. REQUIRED before: downloading files, submitting forms with personal data, sending messages/emails, accepting terms of service, posting on social media. Returns whether permission was granted.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Brief description of the action that needs permission (e.g., "Download report.pdf")' },
        reason: { type: 'string', description: 'Why this action is needed for the task' },
        details: { type: 'string', description: 'Optional additional details (file name, form data summary, etc.)' },
        category: {
          type: 'string',
          enum: ['download', 'form_submit', 'send_message', 'accept_terms', 'social_post', 'other'],
          description: 'Category of the sensitive action',
        },
      },
      required: ['action', 'reason', 'category'],
    }),
    execute: async ({
      action,
      reason,
      details,
      category,
    }: {
      action: string
      reason: string
      details?: string
      category: 'download' | 'form_submit' | 'send_message' | 'accept_terms' | 'social_post' | 'other'
    }) => {
      return new Promise((resolve) => {
        const requestId = `perm_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

        // Dispatch event to request permission from UI
        window.dispatchEvent(new CustomEvent('deer:permission-request', {
          detail: { requestId, action, reason, details, category }
        }))

        // Listen for response
        const handleResponse = (event: Event) => {
          const customEvent = event as CustomEvent
          if (customEvent.detail?.requestId === requestId) {
            window.removeEventListener('deer:permission-response', handleResponse)

            if (customEvent.detail.approved) {
              resolve({
                success: true,
                approved: true,
                message: `Permission granted for: ${action}`,
              })
            } else {
              resolve({
                success: true,
                approved: false,
                message: `Permission denied for: ${action}`,
                reason: customEvent.detail.reason || 'User declined',
              })
            }
          }
        }

        window.addEventListener('deer:permission-response', handleResponse)

        // Timeout after 60 seconds
        setTimeout(() => {
          window.removeEventListener('deer:permission-response', handleResponse)
          resolve({
            success: false,
            approved: false,
            message: 'Permission request timed out - user did not respond',
          })
        }, 60000)
      })
    },
  },
}

// Micro-planning prompt - plans only 2 steps at a time based on current state
const MICRO_PLANNING_PROMPT = `You are Deer, a browser automation agent. You work in small incremental steps.

Given the user's task and the CURRENT page state (DOM and/or screenshot), plan exactly 2 small concrete actions.

Rules:
- Plan ONLY 2 steps - no more
- Steps must be specific and actionable (e.g., "Click the search button", "Type 'query' in search box")
- Base your plan on what you can ACTUALLY see in the current DOM or screenshot
- If a screenshot is provided, use it to understand the visual layout when DOM is limited
- If task needs permission (downloads, forms, messages, terms), note it
- If page content isn't loading, first step should be to navigate or wait

Format your response as:
**Next Steps:**
1. [specific action based on current page]
2. [next specific action]

If the task appears COMPLETE based on current state, respond with:
**Task Complete**
[Brief summary of what was accomplished]

Do NOT use tools in this response - just plan.`

// Execution prompt - executes the 2 planned steps
const EXECUTION_PROMPT = `You are Deer, a browser automation agent. Execute the planned steps.

## WORKFLOW
1. Try getPageDOM first → find elements by [ref=ref_N] → act → verify
2. If getPageDOM fails or returns no elements, use screenshot for visual context

## TOOLS
- getPageDOM: Get page structure with refs. TRY THIS FIRST.
- screenshot: Capture visible page - USE AS FALLBACK if getPageDOM fails
- clickElement/typeInElement/scrollToElement: Use refs from getPageDOM
- navigate, createTab/closeTab/switchTab, wait
- requestPermission: Required before sensitive actions

## DOM FORMAT
Elements have refs like: button "Sign In" [ref=ref_1]
Use the ref value as elementId.

## FALLBACK STRATEGY
If getPageDOM fails or returns error:
1. Take a screenshot to see the current page state
2. Use navigate to go to the target URL if needed
3. Try getPageDOM again after navigation/page load

## SECURITY
PROHIBITED: Passwords, credit cards, SSN, API keys, purchases, account creation
REQUIRE PERMISSION: Downloads, forms with personal data, sending messages, accepting terms

## CRITICAL
- Execute ONLY the 2 planned steps, then STOP
- If DOM not available, take screenshot and adapt your approach
- Never guess refs - get them from getPageDOM or use screenshot for visual context`

export interface AgentCallbacks {
  onStep?: (step: AgentStep) => void
  onStateChange?: (state: AgentState) => void
  onText?: (text: string) => void
  onPlan?: (plan: AgentPlan) => void
  onPlanUpdate?: (plan: AgentPlan) => void
}

// Parse micro-plan (2 steps) from text
function parseMicroPlan(text: string): { steps: string[], isComplete: boolean, summary?: string } {
  // Check if task is complete
  if (text.includes('**Task Complete**') || text.toLowerCase().includes('task complete')) {
    const summaryMatch = text.match(/\*\*Task Complete\*\*\s*\n?([\s\S]*)/i)
    return {
      steps: [],
      isComplete: true,
      summary: summaryMatch?.[1]?.trim() || 'Task completed successfully.'
    }
  }

  // Parse the 2 steps
  const stepsMatch = text.match(/\*?\*?Next Steps:?\*?\*?\s*\n((?:\d+\.\s+.+(?:\n|$))+)/i)
  if (!stepsMatch) {
    // Try alternative format
    const numberedMatch = text.match(/(\d+\.\s+.+(?:\n\d+\.\s+.+)*)/m)
    if (numberedMatch) {
      const items = [...numberedMatch[1].matchAll(/\d+\.\s+(.+?)(?=\n\d+\.|\n*$)/g)]
      return {
        steps: items.map(m => m[1].trim()).slice(0, 2),
        isComplete: false
      }
    }
    return { steps: [], isComplete: false }
  }

  const items = [...stepsMatch[1].matchAll(/\d+\.\s+(.+?)(?=\n\d+\.|\n*$)/g)]
  return {
    steps: items.map(m => m[1].trim()).slice(0, 2),
    isComplete: false
  }
}

// Helper to take a screenshot fallback
async function takeScreenshotFallback(): Promise<{ dataUrl?: string; error?: string }> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
      format: 'png',
      quality: 90,
    })
    return { dataUrl }
  } catch (error) {
    console.error('[takeScreenshotFallback] Failed:', error)
    return { error: String(error) }
  }
}

// Get current page state for evaluation
async function getCurrentPageState(): Promise<{ dom: string, url: string, title: string, screenshot?: string }> {
  // Get basic tab info first - this always works
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url || ''
  const title = tab?.title || ''

  // Check if this is a restricted page where content scripts can't run
  if (!tab?.id || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    // Try screenshot fallback for restricted pages
    const screenshotResult = await takeScreenshotFallback()
    return {
      dom: '(Cannot read page content - this is a browser internal page. Navigate to a regular website first.)',
      url,
      title,
      screenshot: screenshotResult.dataUrl,
    }
  }

  // Try to get DOM from content script
  try {
    const result = await chrome.tabs.sendMessage(tab.id, {
      type: 'DEER_DOM',
      action: 'serialize',
      filter: 'interactive',
    })

    let dom = result?.pageContent || ''
    if (dom.length > MAX_DOM_CHARS) {
      dom = dom.substring(0, MAX_DOM_CHARS) + '\n... (truncated)'
    }

    // If DOM is empty or very short, take a screenshot as additional context
    if (!dom || dom.length < 100) {
      console.log('[getCurrentPageState] DOM too short, taking screenshot fallback')
      const screenshotResult = await takeScreenshotFallback()
      return {
        dom: dom || '(No interactive elements found on page)',
        url,
        title,
        screenshot: screenshotResult.dataUrl
      }
    }

    return { dom, url, title }
  } catch (error) {
    // Content script not ready - take screenshot as fallback
    console.log('[getCurrentPageState] Content script not ready, taking screenshot fallback')
    const screenshotResult = await takeScreenshotFallback()
    return {
      dom: '(Page content not yet available - the page may still be loading. Screenshot provided for visual context.)',
      url,
      title,
      screenshot: screenshotResult.dataUrl,
    }
  }
}

export class BrowserAgent {
  private config: AIConfig
  private state: AgentState
  private callbacks: AgentCallbacks
  private stepCounter = 0
  private plan: AgentPlan | null = null
  private completedPlanItems: PlanItem[] = []

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
      id: `${Date.now()}-${++this.stepCounter}`,
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

  // Update the plan display with current micro-plan + completed items
  private updatePlanDisplay(currentSteps: string[], activeIndex: number = 0) {
    // Build plan items: completed items + current micro-plan items
    const items: PlanItem[] = [
      ...this.completedPlanItems,
      ...currentSteps.map((text, i) => ({
        id: `current-${i}`,
        text,
        status: (i < activeIndex ? 'completed' : i === activeIndex ? 'in_progress' : 'pending') as PlanItem['status']
      }))
    ]

    this.plan = { items }
    this.state.plan = this.plan
    this.callbacks.onPlanUpdate?.(this.plan)
  }

  // Mark current micro-plan step as complete and move to next
  private completeCurrentStep(stepText: string) {
    // Add to completed items
    this.completedPlanItems.push({
      id: `completed-${this.completedPlanItems.length}`,
      text: stepText,
      status: 'completed'
    })
  }

  async run(messages: ModelMessage[], maxIterations = 10): Promise<string> {
    this.plan = null
    this.completedPlanItems = []

    this.updateState({
      isRunning: true,
      currentStep: 'Starting...',
      steps: [],
      plan: undefined,
    })

    try {
      const model = createProvider(this.config)
      let iteration = 0
      let finalSummary = ''

      // Main iterative loop
      while (iteration < maxIterations) {
        iteration++
        console.log(`[Agent] Starting iteration ${iteration}/${maxIterations}`)

        // Phase 1: Observe current state
        this.updateState({ currentStep: 'Observing page...' })
        const observeStep = this.addStep({
          action: 'Observing current page state...',
          status: 'running',
        })

        const pageState = await getCurrentPageState()

        this.updateStep(observeStep.id, {
          action: `Observed: ${pageState.title || pageState.url || 'current page'}`,
          status: 'completed',
          result: `URL: ${pageState.url}\nElements found: ${pageState.dom.length > 0 ? 'yes' : 'no'}${pageState.screenshot ? '\nScreenshot captured as fallback' : ''}`,
          screenshot: pageState.screenshot,
        })

        // Phase 2: Plan next 2 steps based on current state
        this.updateState({ currentStep: 'Planning next steps...' })
        const planStep = this.addStep({
          action: 'Planning next actions...',
          status: 'running',
        })

        // Build context with task + current state - use simple text content for reliability
        const contextText = `Current page state:
URL: ${pageState.url}
Title: ${pageState.title}

Interactive elements on page:
${pageState.dom || '(Unable to read page - may need to navigate first)'}
${pageState.screenshot ? '\n(Screenshot was captured for visual reference)' : ''}

${this.completedPlanItems.length > 0 ? `Already completed:\n${this.completedPlanItems.map((item, i) => `${i + 1}. ${item.text}`).join('\n')}\n\n` : ''}What are the next 2 specific steps to complete the task?`

        const planningMessages: ModelMessage[] = [
          ...messages,
          {
            role: 'user' as const,
            content: contextText,
          }
        ]

        let microPlan: { steps: string[], isComplete: boolean, summary?: string }

        try {
          console.log('[Agent] Starting planning call...')
          console.log('[Agent] Provider:', this.config.provider, 'Model:', this.config.model || 'default')

          // Add timeout to prevent hanging forever
          const planPromise = withRateLimitRetry(() => {
            console.log('[Agent] Calling generateText for planning...')
            return generateText({
              model,
              system: MICRO_PLANNING_PROMPT,
              messages: planningMessages,
              stopWhen: stepCountIs(1),
            })
          })

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              console.log('[Agent] Planning timeout triggered!')
              reject(new Error('Planning timeout after 30s'))
            }, 30000)
          })

          console.log('[Agent] Waiting for planning result...')
          const planResult = await Promise.race([planPromise, timeoutPromise])
          console.log('[Agent] Planning result received')

          const planText = planResult.text || ''
          microPlan = parseMicroPlan(planText)

          this.updateStep(planStep.id, {
            action: microPlan.isComplete ? 'Task complete!' : `Planned: ${microPlan.steps.length} steps`,
            status: 'completed',
            result: planText,
          })

          // Emit plan text
          if (planText) {
            this.callbacks.onText?.(planText + '\n\n')
          }
          console.log('[Agent] Planning completed successfully')
        } catch (planError) {
          console.error('[Agent] Planning failed:', planError)
          this.updateStep(planStep.id, {
            action: 'Planning failed - retrying with simpler approach',
            status: 'failed',
            error: String(planError),
          })

          // On planning failure, create a default recovery plan
          const errorMsg = String(planError)
          if (errorMsg.includes('timeout')) {
            // On timeout, try a simpler approach
            microPlan = {
              steps: ['Get page content using getPageDOM', 'Take action based on what is found'],
              isComplete: false
            }
            console.log('[Agent] Using fallback plan due to timeout')
          } else {
            // For other errors, try to continue with basic steps
            microPlan = {
              steps: ['Navigate to the target page or get current page state', 'Identify next action to take'],
              isComplete: false
            }
            console.log('[Agent] Using fallback plan due to error')
          }
        }

        // Check if task is complete
        if (microPlan.isComplete) {
          finalSummary = microPlan.summary || 'Task completed.'
          // Mark all remaining as complete
          this.updatePlanDisplay([], 0)
          break
        }

        // No steps planned - use fallback
        if (microPlan.steps.length === 0) {
          console.warn('[Agent] No steps planned, using fallback plan')
          microPlan = {
            steps: ['Get page DOM to understand current state', 'Execute appropriate action'],
            isComplete: false
          }
        }

        // Update plan display with current micro-plan
        this.updatePlanDisplay(microPlan.steps, 0)

        // Phase 3: Execute the 2 planned steps
        this.updateState({ currentStep: 'Executing...' })

        // Build execution context
        const executionMessages: ModelMessage[] = [
          ...messages,
          {
            role: 'assistant' as const,
            content: `**Next Steps:**\n${microPlan.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
          },
          {
            role: 'user' as const,
            content: 'Execute these 2 steps now. Start by calling getPageDOM to see current elements.'
          }
        ]

        let stepsExecuted = 0
        let toolCallCount = 0

        try {
          console.log('[Agent] Starting execution phase...')

          // Add timeout to prevent execution from hanging forever
          const execPromise = withRateLimitRetry(() => generateText({
            model,
            system: EXECUTION_PROMPT,
            messages: executionMessages,
            tools,
            stopWhen: stepCountIs(6), // Limited steps per micro-plan execution
            toolChoice: 'auto',
            onStepFinish: ({ text, toolCalls, toolResults }) => {
              // Handle text output
              if (text) {
                this.callbacks.onText?.(text)
              }

              // Handle tool calls
              if (toolCalls && toolCalls.length > 0) {
                const resultMap = new Map<string, any>()
                if (toolResults && Array.isArray(toolResults)) {
                  for (const tr of toolResults as any[]) {
                    if (tr.toolCallId) {
                      resultMap.set(tr.toolCallId, tr)
                    }
                  }
                }

                for (const tc of toolCalls as any[]) {
                  toolCallCount++
                  const step = this.addStep({
                    action: `${tc.toolName}: ${JSON.stringify(tc.args)}`,
                    status: 'running',
                  })

                  const correspondingResult = resultMap.get(tc.toolCallId)

                  if (correspondingResult && correspondingResult.result !== undefined) {
                    const result = correspondingResult.result
                    const resultStr = typeof result === 'object'
                      ? JSON.stringify(result)
                      : String(result)

                    let status: 'completed' | 'failed' = 'completed'
                    let errorMsg: string | undefined

                    if (typeof result === 'object' && result !== null) {
                      if (result.success === false) {
                        status = 'failed'
                        errorMsg = result.error || result.message || 'Action failed'
                      } else if (result.error) {
                        status = 'failed'
                        errorMsg = result.error
                      }
                    }

                    // Check for screenshot
                    const hasScreenshot = typeof result === 'object' && result !== null &&
                      'dataUrl' in result && typeof (result as any).dataUrl === 'string' &&
                      (result as any).dataUrl.startsWith('data:image')

                    this.updateStep(step.id, {
                      status,
                      result: hasScreenshot ? resultStr : resultStr.slice(0, 500),
                      screenshot: hasScreenshot ? (result as any).dataUrl : undefined,
                      error: errorMsg,
                    })

                    // Track significant actions to know when a plan step is done
                    // Also count tool execution attempts after getPageDOM (which is typically the first call)
                    const toolName = tc.toolName.toLowerCase()
                    const significantActions = ['navigate', 'createtab', 'clickelement', 'typeinelement', 'click', 'type', 'scroll', 'scrolltoelement']
                    const isSignificantAction = significantActions.includes(toolName)

                    // Count as step executed if: significant action completed, OR significant action was attempted (even if failed)
                    if (isSignificantAction) {
                      stepsExecuted++
                      console.log(`[Agent] Step executed: ${toolName}, total: ${stepsExecuted}`)

                      // Update plan display to show progress
                      if (stepsExecuted <= microPlan.steps.length) {
                        // Complete the step that was just executed
                        if (stepsExecuted === 1 && microPlan.steps[0]) {
                          this.completeCurrentStep(microPlan.steps[0])
                          this.updatePlanDisplay(microPlan.steps.slice(1), 0)
                        } else if (stepsExecuted === 2 && microPlan.steps[1]) {
                          this.completeCurrentStep(microPlan.steps[1])
                          this.updatePlanDisplay([], 0)
                        }
                      }
                    }
                  } else {
                    this.updateStep(step.id, {
                      status: 'completed',
                      result: 'Executed successfully',
                    })
                  }
                }
              }
            },
          }))

          const execTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Execution timeout after 60s')), 60000)
          })

          await Promise.race([execPromise, execTimeoutPromise])
          console.log('[Agent] Execution phase completed')
        } catch (execError) {
          console.error('[Agent] Execution failed:', execError)
          // Continue to next iteration anyway - might recover
        }

        // Always advance the plan after execution attempt to prevent getting stuck
        // This ensures we don't get stuck on the same step forever
        if (stepsExecuted === 0) {
          console.log('[Agent] No significant actions completed - advancing plan to prevent stuck state')
          // Mark steps as done to move forward
          if (microPlan.steps[0]) {
            this.completeCurrentStep(microPlan.steps[0])
          }
          if (microPlan.steps[1]) {
            this.completeCurrentStep(microPlan.steps[1])
          }
          this.updatePlanDisplay([], 0)
        }

        // Small delay before next iteration
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Final state
      this.updateState({
        isRunning: false,
        currentStep: 'Done',
        plan: this.plan || undefined,
      })

      return finalSummary || 'Task completed.'
    } catch (error) {
      console.error('Agent error:', error)
      this.updateState({
        isRunning: false,
        currentStep: 'Error',
      })

      if (isRateLimitError(error)) {
        throw new RateLimitError(
          'Rate limit reached. Please wait a moment and try again.',
          60000
        )
      }

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
