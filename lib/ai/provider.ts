import { createAnthropic } from '@ai-sdk/anthropic'
import { createGroq } from '@ai-sdk/groq'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, streamText, stepCountIs, tool, type ModelMessage, type LanguageModel } from 'ai'
import type { AIConfig, AIProvider } from './types'

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  groq: 'llama-3.3-70b-versatile',
}

export function createProvider(config: AIConfig): LanguageModel {
  const model = config.model || DEFAULT_MODELS[config.provider]

  switch (config.provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        headers: {
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      })
      return anthropic(model)
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: config.apiKey })
      return openai(model)
    }
    case 'groq': {
      const groq = createGroq({ apiKey: config.apiKey })
      return groq(model)
    }
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}

export interface ChatOptions {
  messages: ModelMessage[]
  systemPrompt?: string
  tools?: Record<string, ReturnType<typeof tool>>
  maxSteps?: number
  onStepFinish?: (step: { text?: string; toolCalls?: unknown[] }) => void
}

export async function chat(config: AIConfig, options: ChatOptions) {
  const model = createProvider(config)

  const result = await generateText({
    model,
    system: options.systemPrompt,
    messages: options.messages,
    tools: options.tools,
    stopWhen: stepCountIs(options.maxSteps || 5),
    onStepFinish: options.onStepFinish,
  })

  return result
}

export async function* streamChat(config: AIConfig, options: ChatOptions) {
  const model = createProvider(config)

  const result = streamText({
    model,
    system: options.systemPrompt,
    messages: options.messages,
    tools: options.tools,
    stopWhen: stepCountIs(options.maxSteps || 5),
    onStepFinish: options.onStepFinish,
  })

  for await (const chunk of result.textStream) {
    yield chunk
  }

  return await result.response
}

export function getAvailableModels(provider: AIProvider): string[] {
  switch (provider) {
    case 'anthropic':
      return [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-5-haiku-20241022',
      ]
    case 'openai':
      return [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'o1',
        'o1-mini',
      ]
    case 'groq':
      return [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama-3.2-90b-vision-preview',
        'mixtral-8x7b-32768',
        'gemma2-9b-it',
      ]
    default:
      return []
  }
}
