import { generateText, jsonSchema, stepCountIs, type ModelMessage } from 'ai'
import { createProvider } from './provider'
import { browserTools } from './tools'
import type { AIConfig, AgentState, AgentStep } from './types'

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
}

const PLANNING_SYSTEM_PROMPT = `You are Deer, an intelligent browser automation agent. Before taking any actions, you create a brief plan.

Given a task, analyze what needs to be done and create a concise plan with numbered steps. Keep it brief (3-6 steps max).

Format your response as:
**Plan:**
1. [First action]
2. [Second action]
3. [etc.]

Do NOT use any tools yet - just create the plan. Be specific about what you'll do.`

const AGENT_SYSTEM_PROMPT = `You are Deer, an intelligent browser automation agent. Your job is to help users accomplish tasks on web pages.

You have already created a plan. Now execute it step by step.

## CRITICAL WORKFLOW
For ANY task that involves interacting with a web page, you MUST follow this workflow:

1. FIRST: Call getPageDOM to see the page structure and available elements
2. ANALYZE: Look at the DOM tree to find the element(s) you need
3. ACT: Use clickElement, typeInElement, or scrollToElement with the element ref
4. VERIFY: After each action, call getPageDOM again to see the result
5. CONTINUE: Keep taking actions until the task is complete

## AVAILABLE TOOLS
- getPageDOM: Get the page structure as an accessibility tree. ALWAYS call this first!
- clickElement: Click an element by ref (from getPageDOM)
- typeInElement: Type text into an element by ref
- scrollToElement: Scroll to an element by ref
- navigate: Go to a URL
- createTab/closeTab/getTabs/switchTab: Manage browser tabs
- screenshot: Capture a screenshot
- wait: Wait for time or changes

## DOM TREE FORMAT
The DOM tree shows elements in YAML-like format with stable references:
- button "Sign In" [ref=ref_1]
- textbox "Email address" [ref=ref_2] placeholder="Enter email"
- link "Forgot password?" [ref=ref_3] href="/forgot"

Use the ref value (e.g., "ref_1", "ref_2") as the elementId for click/type/scroll actions.

## IMPORTANT RULES
- NEVER guess element refs - always get them from getPageDOM first
- After clicking something that changes the page, call getPageDOM again
- If an element is not visible, try scrollToElement first
- Element refs are stable across DOM changes if the element still exists
- Be persistent - if one approach fails, try another
- Report your progress after each action

## EXAMPLE
User: "Log into my account with email test@example.com"

1. First I'll get the page DOM to see what's available...
   [calls getPageDOM]
2. I see a textbox [ref=ref_5] for email. Let me type the email...
   [calls typeInElement with elementId="ref_5", text="test@example.com"]
3. Now let me check the page again to find the submit button...
   [calls getPageDOM]
4. I see a button [ref=ref_8] for Sign In. Let me click it...
   [calls clickElement with elementId="ref_8"]
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
  private stepCounter = 0

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

  async run(messages: ModelMessage[], maxSteps = 20): Promise<string> {
    this.updateState({
      isRunning: true,
      currentStep: 'Planning...',
      steps: [],
    })

    try {
      const model = createProvider(this.config)

      // Phase 1: Planning - create a brief plan first (no tools)
      const planStep = this.addStep({
        action: 'Creating plan...',
        status: 'running',
      })

      let planText = ''
      try {
        const planResult = await withRateLimitRetry(() => generateText({
          model,
          system: PLANNING_SYSTEM_PROMPT,
          messages,
          maxSteps: 1, // Single response, no tools
        }))
        planText = planResult.text || ''

        this.updateStep(planStep.id, {
          action: 'Plan created',
          status: 'completed',
          result: planText,
        })

        // Emit plan as text for display
        if (planText) {
          this.callbacks.onText?.(planText + '\n\n')
        }
      } catch (planError) {
        // If planning fails, continue without plan
        console.warn('[Agent] Planning failed, continuing without plan:', planError)
        this.updateStep(planStep.id, {
          action: 'Planning skipped',
          status: 'completed',
          result: 'Proceeding directly to execution',
        })
      }

      // Small delay between planning and execution to help with rate limits
      await new Promise(resolve => setTimeout(resolve, 1000))

      this.updateState({ currentStep: 'Executing...' })

      // Phase 2: Execution - now execute with tools
      // Include the plan in the context if we have one
      const executionMessages: ModelMessage[] = planText
        ? [
            ...messages,
            { role: 'assistant' as const, content: planText },
            { role: 'user' as const, content: 'Now execute this plan step by step.' },
          ]
        : messages

      // Wrap generateText with rate limit retry handling
      const result = await withRateLimitRetry(() => generateText({
        model,
        system: AGENT_SYSTEM_PROMPT,
        messages: executionMessages,
        tools,
        stopWhen: stepCountIs(maxSteps), // Stop after maxSteps iterations
        toolChoice: 'auto', // Let the model decide when to use tools
        onStepFinish: ({ text, toolCalls, toolResults }) => {
          console.log('[Agent] onStepFinish:', {
            text,
            toolCallsCount: toolCalls?.length,
            toolResultsCount: toolResults?.length,
            toolCalls: toolCalls?.map((tc: any) => ({ toolName: tc.toolName, toolCallId: tc.toolCallId })),
            toolResults: toolResults?.map((tr: any) => ({ toolCallId: tr.toolCallId, hasResult: tr.result !== undefined }))
          })

          // Handle text output
          if (text) {
            this.callbacks.onText?.(text)
          }

          // Handle tool calls - build a map of toolCallId -> result for proper matching
          if (toolCalls && toolCalls.length > 0) {
            // Build result lookup map by toolCallId
            const resultMap = new Map<string, any>()
            if (toolResults && Array.isArray(toolResults)) {
              for (const tr of toolResults as any[]) {
                if (tr.toolCallId) {
                  resultMap.set(tr.toolCallId, tr)
                }
              }
            }

            for (const tc of toolCalls as any[]) {
              const step = this.addStep({
                action: `${tc.toolName}: ${JSON.stringify(tc.args)}`,
                status: 'running',
              })

              // Look up result by toolCallId
              const correspondingResult = resultMap.get(tc.toolCallId)

              console.log('[Agent] Tool result for', tc.toolName, '(id:', tc.toolCallId, '):',
                correspondingResult ? 'found' : 'not found',
                correspondingResult?.result !== undefined ? 'has result' : 'no result value'
              )

              if (correspondingResult && correspondingResult.result !== undefined) {
                const result = correspondingResult.result
                const resultStr = typeof result === 'object'
                  ? JSON.stringify(result)
                  : String(result)

                // Determine status based on result
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

                this.updateStep(step.id, {
                  status,
                  result: resultStr.slice(0, 500), // Truncate long results for display
                  error: errorMsg,
                })
              } else {
                // No result found - mark as completed (tool executed but no return value)
                this.updateStep(step.id, {
                  status: 'completed',
                  result: 'Executed successfully',
                })
              }
            }
          }
        },
      }))

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

      // Convert rate limit errors to a more user-friendly error
      if (isRateLimitError(error)) {
        throw new RateLimitError(
          'Rate limit reached. The API is receiving too many requests. Please wait a moment and try again.',
          60000 // Suggest waiting 60 seconds
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
