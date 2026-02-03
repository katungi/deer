/**
 * Deer Agent Primitives
 *
 * High-level browser automation primitives inspired by Stagehand:
 * - act(instruction): Execute a natural language action on the page
 * - extract(instruction, schema): Extract structured data from the page
 * - observe(): Discover available actions on the current page
 *
 * These primitives use DOM serialization + LLM to understand and interact
 * with web pages semantically, not via brittle CSS selectors.
 */

import { generateText, jsonSchema } from "ai"
import { createProvider } from "./provider"
import type { AIConfig } from "./types"

// Types for DOM messages
interface DOMSerializeResult {
  tree: string
  elementCount: number
}

interface DOMExecuteResult {
  success: boolean
  error?: string
}

/**
 * Send a message to the content script in the active tab
 */
async function sendToContentScript<T>(
  message: Record<string, unknown>
): Promise<T> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    throw new Error("No active tab found")
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id!, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(response as T)
      }
    })
  })
}

/**
 * Get the serialized DOM tree from the current page
 */
export async function getDOMTree(): Promise<DOMSerializeResult> {
  return sendToContentScript<DOMSerializeResult>({
    type: "DEER_DOM",
    action: "serialize",
  })
}

/**
 * Execute an action on an element by ID
 */
export async function executeOnElement(
  elementId: string,
  method: "click" | "type" | "focus" | "scroll" | "clear",
  args?: { text?: string; clear?: boolean }
): Promise<DOMExecuteResult> {
  return sendToContentScript<DOMExecuteResult>({
    type: "DEER_DOM",
    action: "execute",
    elementId,
    method,
    args,
  })
}

/**
 * Highlight an element on the page
 */
export async function highlightElement(
  elementId: string,
  color?: string
): Promise<{ success: boolean }> {
  return sendToContentScript<{ success: boolean }>({
    type: "DEER_DOM",
    action: "highlight",
    elementId,
    color,
  })
}

// System prompt for the act primitive
const ACT_SYSTEM_PROMPT = `You are an AI that helps users interact with web pages.

You will receive:
1. An instruction describing what action to perform
2. A DOM tree in accessibility format showing the page structure

Each element in the DOM tree has:
- [id] - A unique identifier you can use to target the element
- role - The element's role (button, link, textbox, etc.)
- name - The element's accessible name/label

Your task is to identify which element(s) to interact with and what action to take.

Available actions:
- click: Click on an element
- type: Type text into an input field
- focus: Focus on an element
- scroll: Scroll to an element
- clear: Clear an input field

Respond with a JSON object containing:
{
  "thinking": "Your reasoning about which element to target",
  "elementId": "the id from the DOM tree",
  "action": "click" | "type" | "focus" | "scroll" | "clear",
  "args": { "text": "text to type if action is type", "clear": true/false }
}

If the instruction cannot be completed with the available elements, respond with:
{
  "thinking": "Explanation of why it cannot be done",
  "error": "Description of the issue"
}
`

// Schema for act response
const actResponseSchema = {
  type: "object",
  properties: {
    thinking: { type: "string", description: "Reasoning about the action" },
    elementId: { type: "string", description: "The element ID to target" },
    action: {
      type: "string",
      enum: ["click", "type", "focus", "scroll", "clear"],
      description: "The action to perform",
    },
    args: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to type" },
        clear: { type: "boolean", description: "Whether to clear first" },
      },
    },
    error: { type: "string", description: "Error message if action cannot be performed" },
  },
  required: ["thinking"],
} as const

interface ActResponse {
  thinking: string
  elementId?: string
  action?: "click" | "type" | "focus" | "scroll" | "clear"
  args?: { text?: string; clear?: boolean }
  error?: string
}

export interface ActResult {
  success: boolean
  message: string
  thinking: string
  elementId?: string
  action?: string
}

/**
 * Execute a natural language action on the current page
 *
 * @example
 * await act(config, "Click the Sign In button")
 * await act(config, "Type 'hello@example.com' into the email field")
 * await act(config, "Scroll to the pricing section")
 */
export async function act(config: AIConfig, instruction: string): Promise<ActResult> {
  // Get the current DOM tree
  const { tree } = await getDOMTree()

  if (!tree) {
    return {
      success: false,
      message: "Could not serialize the page DOM",
      thinking: "Failed to get DOM tree",
    }
  }

  // Ask the LLM to identify the element and action
  const model = createProvider(config)

  const result = await generateText({
    model,
    system: ACT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Instruction: ${instruction}\n\nDOM Tree:\n${tree}`,
      },
    ],
    // Use structured output
    tools: {
      performAction: {
        description: "Perform an action on a web page element",
        inputSchema: jsonSchema(actResponseSchema),
        execute: async (params: ActResponse) => params,
      },
    },
    toolChoice: "required",
  })

  // Extract the tool call result
  const toolCall = result.toolCalls?.[0]
  if (!toolCall || toolCall.toolName !== "performAction") {
    return {
      success: false,
      message: "LLM did not provide a valid action",
      thinking: "No tool call in response",
    }
  }

  const response = toolCall.args as ActResponse

  // Check for error
  if (response.error) {
    return {
      success: false,
      message: response.error,
      thinking: response.thinking,
    }
  }

  // Validate we have element and action
  if (!response.elementId || !response.action) {
    return {
      success: false,
      message: "LLM did not specify element or action",
      thinking: response.thinking,
    }
  }

  // Highlight the element briefly
  await highlightElement(response.elementId)

  // Execute the action
  const execResult = await executeOnElement(
    response.elementId,
    response.action,
    response.args
  )

  if (!execResult.success) {
    return {
      success: false,
      message: execResult.error || "Action failed",
      thinking: response.thinking,
      elementId: response.elementId,
      action: response.action,
    }
  }

  return {
    success: true,
    message: `Successfully performed ${response.action} on element ${response.elementId}`,
    thinking: response.thinking,
    elementId: response.elementId,
    action: response.action,
  }
}

// System prompt for observe
const OBSERVE_SYSTEM_PROMPT = `You are an AI that analyzes web pages to discover available actions.

You will receive a DOM tree in accessibility format. Your task is to identify all
interactive elements and describe what actions a user could take on this page.

For each interactive element, provide:
- elementId: The element's ID from the DOM tree
- description: A natural language description of what this element does
- suggestedAction: The most likely action (click, type, etc.)

Focus on the most important/prominent interactive elements. Limit to 10-15 elements.
`

const observeResponseSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Brief summary of the page" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          elementId: { type: "string" },
          description: { type: "string" },
          suggestedAction: {
            type: "string",
            enum: ["click", "type", "focus", "scroll"],
          },
        },
        required: ["elementId", "description", "suggestedAction"],
      },
    },
  },
  required: ["summary", "actions"],
} as const

export interface ObserveAction {
  elementId: string
  description: string
  suggestedAction: "click" | "type" | "focus" | "scroll"
}

export interface ObserveResult {
  summary: string
  actions: ObserveAction[]
}

/**
 * Discover available actions on the current page
 *
 * @example
 * const result = await observe(config)
 * console.log(result.summary) // "This is a login page"
 * console.log(result.actions) // [{elementId: "1", description: "Sign in button", ...}]
 */
export async function observe(config: AIConfig): Promise<ObserveResult> {
  const { tree } = await getDOMTree()

  if (!tree) {
    return {
      summary: "Could not analyze the page",
      actions: [],
    }
  }

  const model = createProvider(config)

  const result = await generateText({
    model,
    system: OBSERVE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyze this page and identify available actions:\n\n${tree}`,
      },
    ],
    tools: {
      reportActions: {
        description: "Report the available actions on the page",
        inputSchema: jsonSchema(observeResponseSchema),
        execute: async (params: ObserveResult) => params,
      },
    },
    toolChoice: "required",
  })

  const toolCall = result.toolCalls?.[0]
  if (!toolCall || toolCall.toolName !== "reportActions") {
    return {
      summary: "Could not analyze the page",
      actions: [],
    }
  }

  return toolCall.args as ObserveResult
}

// System prompt for extract
const EXTRACT_SYSTEM_PROMPT = `You are an AI that extracts structured data from web pages.

You will receive:
1. An instruction describing what data to extract
2. A DOM tree showing the page content
3. A schema describing the expected output format

Your task is to find the requested information in the DOM tree and return it
in the specified format.

If you cannot find some information, use null for that field.
`

export interface ExtractResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Extract structured data from the current page
 *
 * @example
 * const result = await extract(config, "Get the product name and price", {
 *   type: "object",
 *   properties: {
 *     name: { type: "string" },
 *     price: { type: "number" }
 *   }
 * })
 */
export async function extract<T>(
  config: AIConfig,
  instruction: string,
  schema: Record<string, unknown>
): Promise<ExtractResult<T>> {
  const { tree } = await getDOMTree()

  if (!tree) {
    return {
      success: false,
      error: "Could not serialize the page DOM",
    }
  }

  const model = createProvider(config)

  const extractSchema = {
    type: "object",
    properties: {
      data: schema,
      error: { type: "string", description: "Error if extraction failed" },
    },
  } as const

  const result = await generateText({
    model,
    system: EXTRACT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Instruction: ${instruction}\n\nExpected output format:\n${JSON.stringify(schema, null, 2)}\n\nDOM Tree:\n${tree}`,
      },
    ],
    tools: {
      extractData: {
        description: "Extract structured data from the page",
        inputSchema: jsonSchema(extractSchema),
        execute: async (params: { data?: T; error?: string }) => params,
      },
    },
    toolChoice: "required",
  })

  const toolCall = result.toolCalls?.[0]
  if (!toolCall || toolCall.toolName !== "extractData") {
    return {
      success: false,
      error: "LLM did not return extracted data",
    }
  }

  const response = toolCall.args as { data?: T; error?: string }

  if (response.error) {
    return {
      success: false,
      error: response.error,
    }
  }

  return {
    success: true,
    data: response.data,
  }
}
