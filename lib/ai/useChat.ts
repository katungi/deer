import { useState, useCallback, useRef } from 'react'
import type { ModelMessage } from 'ai'
import { generateText } from 'ai'
import { BrowserAgent } from './agent'
import { createProvider } from './provider'
import { showAgentGlow, hideAgentGlow } from './glow'
import { getAIConfig, hasAPIKey } from './storage'
import { themeColors } from '@/components/ui/settings'
import type { AgentState, AgentStep } from './types'

const CHAT_SYSTEM_PROMPT = `You are Deer, a friendly and helpful browser assistant. You help users with questions, explanations, and general conversation. Be concise, clear, and helpful.`

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  agentSteps?: AgentStep[]
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
              prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, agentSteps: [...(m.agentSteps || []), step] }
                  : m
              )
            )
          },
          onStateChange: setAgentState,
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
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'

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
