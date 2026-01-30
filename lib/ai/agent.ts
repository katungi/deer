import { generateText, stepCountIs, jsonSchema, type ModelMessage } from 'ai'
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

const AGENT_SYSTEM_PROMPT = `You are Deer, an intelligent browser assistant that can help users with web browsing tasks.

IMPORTANT: You can ONLY use the following tools. Do NOT attempt to use any other tools like brave_search, web_search, or any tool not listed here:

Available tools:
- navigate: Navigate the current tab to a URL
- createTab: Create a new browser tab
- closeTab: Close a tab by ID
- getTabs: Get all open tabs
- getActiveTab: Get the current active tab info
- switchTab: Switch to a specific tab
- screenshot: Capture a screenshot of the visible tab
- executeScript: Run JavaScript in the current page
- click: Click an element using CSS selector
- type: Type text into an input field
- getPageContent: Get text content from the page
- scroll: Scroll the page
- wait: Wait for time or element

When helping users:
1. Think step-by-step about what actions are needed
2. ONLY use the tools listed above - never invent or guess tool names
3. Provide clear feedback about what you're doing
4. If something fails, try alternative approaches using the available tools

For simple questions or conversations, just respond naturally without using tools.
Be proactive and helpful. If the user asks you to do something on a webpage, use your tools to accomplish it.`

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

  async run(messages: ModelMessage[], maxSteps = 10): Promise<string> {
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
        stopWhen: stepCountIs(maxSteps),
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
                this.updateStep(step.id, {
                  status: 'completed',
                  result: correspondingResult.result,
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

      return result.text
    } catch (error) {
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
