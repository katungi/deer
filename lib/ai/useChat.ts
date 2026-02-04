import { useState, useCallback, useRef } from 'react'
import type { ModelMessage } from 'ai'
import { generateText } from 'ai'
import { BrowserAgent, RateLimitError } from './agent'
import { createProvider } from './provider'
import { showAgentGlow, hideAgentGlow } from './glow'
import { getAIConfig, hasAPIKey } from './storage'
import { themeColors } from '@/components/ui/settings'
import type { AgentState, AgentStep, AgentPlan } from './types'

// Helper to detect rate limit errors from various sources
function isRateLimitError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('rate limit') ||
           message.includes('429') ||
           message.includes('too many requests')
  }
  return false
}

const CHAT_SYSTEM_PROMPT = `You are Deer, a friendly and helpful browser assistant. You help users with questions, explanations, and general conversation. Be concise, clear, and helpful.`

// Pre-approval detection patterns for permission categories
const PRE_APPROVAL_PATTERNS: { category: string; patterns: RegExp[] }[] = [
  {
    category: 'download',
    patterns: [
      /\b(go ahead|you may|i authorize|you have permission|feel free to|please)\b.*\bdownload/i,
      /\bdownload\b.*\b(without asking|no confirmation|don't ask)/i,
    ],
  },
  {
    category: 'form_submit',
    patterns: [
      /\b(go ahead|you may|i authorize|you have permission|feel free to|please)\b.*\b(submit|send|fill( out)?)\b.*\bform/i,
      /\bsubmit\b.*\b(without asking|no confirmation|don't ask)/i,
    ],
  },
  {
    category: 'send_message',
    patterns: [
      /\b(go ahead|you may|i authorize|you have permission|feel free to|please)\b.*\b(send|email|message)/i,
      /\b(send|email)\b.*\b(without asking|no confirmation|don't ask)/i,
    ],
  },
  {
    category: 'accept_terms',
    patterns: [
      /\b(go ahead|you may|i authorize|you have permission|feel free to|please)\b.*\b(accept|agree)\b.*\b(terms|conditions|policy)/i,
      /\baccept\b.*\b(without asking|no confirmation|don't ask)/i,
    ],
  },
  {
    category: 'social_post',
    patterns: [
      /\b(go ahead|you may|i authorize|you have permission|feel free to|please)\b.*\b(post|publish|share)\b/i,
      /\b(post|publish)\b.*\b(without asking|no confirmation|don't ask)/i,
    ],
  },
]

// Detect pre-approved categories from user message
function detectPreApprovals(message: string): string[] {
  const approvals: string[] = []

  // Check for general "no confirmation needed" pattern
  const generalApproval = /\b(no confirmation|don't ask|you have (full )?permission|i (fully )?authorize|go ahead (and|with))\b/i.test(message)

  for (const { category, patterns } of PRE_APPROVAL_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        approvals.push(category)
        break
      }
    }
  }

  // If general approval detected and message mentions specific actions, add those
  if (generalApproval) {
    if (/\bdownload/i.test(message) && !approvals.includes('download')) {
      approvals.push('download')
    }
    if (/\b(submit|form)/i.test(message) && !approvals.includes('form_submit')) {
      approvals.push('form_submit')
    }
    if (/\b(send|email|message)/i.test(message) && !approvals.includes('send_message')) {
      approvals.push('send_message')
    }
    if (/\b(accept|terms|agree)/i.test(message) && !approvals.includes('accept_terms')) {
      approvals.push('accept_terms')
    }
    if (/\b(post|publish|share)/i.test(message) && !approvals.includes('social_post')) {
      approvals.push('social_post')
    }
  }

  return approvals
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  agentSteps?: AgentStep[]
  plan?: AgentPlan
}

export interface UseChatOptions {
  onError?: (error: Error) => void
}

export interface ChatBrowserContext {
  tabs?: chrome.tabs.Tab[]
  screenshots?: string[]
  selectedFunction?: string
  agentMode?: boolean
}

export interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  agentState: AgentState | null
  hasApiKey: boolean
  sendMessage: (content: string, context?: ChatBrowserContext) => Promise<void>
  clearMessages: () => void
  stopAgent: () => void
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [agentState, setAgentState] = useState<AgentState | null>(null)
  const agentRef = useRef<BrowserAgent | null>(null)

  const sendMessage = useCallback(async (content: string, context?: ChatBrowserContext) => {
    // Check for API key
    if (!hasAPIKey()) {
      options.onError?.(new Error('Please configure your API key in Settings'))
      return
    }

    const config = await getAIConfig()
    if (!config) {
      options.onError?.(new Error('AI configuration not found'))
      return
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])

    // Build context for the AI
    let fullContent = content
    if (context?.tabs && context.tabs.length > 0) {
      const tabInfo = context.tabs.map(t => `- ${t.title} (${t.url})`).join('\n')
      fullContent = `${content}\n\nSelected tabs:\n${tabInfo}`
    }
    if (context?.selectedFunction) {
      fullContent = `[Task: ${context.selectedFunction}]\n${fullContent}`
    }

    // Add placeholder assistant message
    const assistantMessageId = `msg-${Date.now() + 1}`
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      agentSteps: [],
    }
    setMessages(prev => [...prev, assistantMessage])

    setIsLoading(true)

    // Build messages for the model
    const modelMessages: ModelMessage[] = messages
      .filter(m => m.content) // Filter out empty messages
      .map(m => ({
        role: m.role,
        content: m.content,
      }))
    modelMessages.push({ role: 'user', content: fullContent })

    // Show glow effect only in agent mode
    if (context?.agentMode) {
      const themeColorId = localStorage.getItem('deer-theme-color') || 'rose'
      const themeColorHex = themeColors.find(c => c.id === themeColorId)?.value || '#e11d48'
      showAgentGlow({ color: themeColorHex, pulse: true })

      // Detect pre-approvals in user message and notify sidepanel
      const preApprovals = detectPreApprovals(content)
      if (preApprovals.length > 0) {
        window.dispatchEvent(new CustomEvent('deer:pre-approvals', {
          detail: { categories: preApprovals }
        }))
      }
    }

    try {
      if (context?.agentMode) {
        // Agent mode: use tools to perform actions
        const agent = new BrowserAgent(config, {
          onText: (text) => {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, content: m.content + text }
                  : m
              )
            )
          },
          onStep: (step) => {
            setMessages(prev =>
              prev.map(m => {
                if (m.id !== assistantMessageId) return m
                const existingSteps = m.agentSteps || []
                const existingIndex = existingSteps.findIndex(s => s.id === step.id)
                if (existingIndex >= 0) {
                  // Update existing step
                  const updatedSteps = [...existingSteps]
                  updatedSteps[existingIndex] = step
                  return { ...m, agentSteps: updatedSteps }
                }
                // Add new step
                return { ...m, agentSteps: [...existingSteps, step] }
              })
            )
          },
          onStateChange: setAgentState,
          onPlan: (plan) => {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, plan }
                  : m
              )
            )
          },
          onPlanUpdate: (plan) => {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, plan: { ...plan } }
                  : m
              )
            )
          },
        })

        agentRef.current = agent

        const response = await agent.run(modelMessages)

        // Finalize the message
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, content: response || m.content, isStreaming: false }
              : m
          )
        )
      } else {
        // Chat mode: simple conversation without tools
        const model = createProvider(config)

        const result = await generateText({
          model,
          system: CHAT_SYSTEM_PROMPT,
          messages: modelMessages,
        })

        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, content: result.text, isStreaming: false }
              : m
          )
        )
      }
    } catch (error) {
      console.error('Chat error:', error)

      let errorMessage: string
      if (isRateLimitError(error)) {
        errorMessage = '⏳ Rate limit reached. The API is temporarily unavailable due to high usage. Please wait a minute and try again.'
      } else {
        errorMessage = error instanceof Error ? error.message : 'An error occurred'
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, content: `Error: ${errorMessage}`, isStreaming: false }
            : m
        )
      )
      options.onError?.(error instanceof Error ? error : new Error(errorMessage))
    } finally {
      setIsLoading(false)
      agentRef.current = null
      // Hide glow effect
      hideAgentGlow()
    }
  }, [messages, options])

  const clearMessages = useCallback(() => {
    setMessages([])
    setAgentState(null)
  }, [])

  const stopAgent = useCallback(() => {
    if (agentRef.current) {
      agentRef.current.stop()
      agentRef.current = null
    }
    setIsLoading(false)
    hideAgentGlow()
  }, [])

  return {
    messages,
    isLoading,
    agentState,
    hasApiKey: hasAPIKey(),
    sendMessage,
    clearMessages,
    stopAgent,
  }
}
