import { createAnthropic } from '@ai-sdk/anthropic'
import { createGroq } from '@ai-sdk/groq'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, streamText, stepCountIs, tool, type ModelMessage, type LanguageModel } from 'ai'
import type { AIConfig, AIProvider } from './types'

const DEFAULT_MODELS: Record<AIProvider, string> = {
  nvidia: 'moonshotai/kimi-k2.5',
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  groq: 'llama-3.3-70b-versatile',
}

// Vision-capable models for image analysis (faster decisions with screenshots)
const DEFAULT_VISION_MODELS: Record<AIProvider, string> = {
  nvidia: 'moonshotai/kimi-k2.5-vision',
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  groq: 'llama-3.2-90b-vision-preview',
}

export function createProvider(config: AIConfig): LanguageModel {
  const model = config.model || DEFAULT_MODELS[config.provider]

  switch (config.provider) {
    case 'nvidia': {
      const nvidia = createOpenAI({
        apiKey: config.apiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      })
      return nvidia.chat(model)
    }
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

// Create a vision-capable provider for image analysis (faster page understanding)
export function createVisionProvider(config: AIConfig): LanguageModel {
  const model = config.visionModel || DEFAULT_VISION_MODELS[config.provider]

  switch (config.provider) {
    case 'nvidia': {
      const nvidia = createOpenAI({
        apiKey: config.apiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      })
      // Use .chat() to force chat/completions API instead of /responses
      return nvidia.chat(model)
    }
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

// Get the default vision model for a provider
export function getDefaultVisionModel(provider: AIProvider): string {
  return DEFAULT_VISION_MODELS[provider]
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
    case 'nvidia':
      return [
        'moonshotai/kimi-k2.5',
        'moonshotai/kimi-k2.5-vision',
        'nvidia/llama-3.1-nemotron-70b-instruct',
        'meta/llama-3.3-70b-instruct',
      ]
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
