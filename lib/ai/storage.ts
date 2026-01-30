import type { AIConfig, AIProvider, Conversation, Message } from './types'

const STORAGE_KEYS = {
  AI_CONFIG: 'deer-ai-config',
  CONVERSATIONS: 'deer-conversations',
  CURRENT_CONVERSATION: 'deer-current-conversation',
} as const

// AI Configuration Storage

export async function getAIConfig(): Promise<AIConfig | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.AI_CONFIG)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load AI config:', e)
  }
  return null
}

export async function saveAIConfig(config: AIConfig): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.AI_CONFIG, JSON.stringify(config))
}

export async function clearAIConfig(): Promise<void> {
  localStorage.removeItem(STORAGE_KEYS.AI_CONFIG)
}

export function hasAPIKey(): boolean {
  const stored = localStorage.getItem(STORAGE_KEYS.AI_CONFIG)
  if (stored) {
    try {
      const config = JSON.parse(stored)
      return !!config.apiKey
    } catch {
      return false
    }
  }
  return false
}

// Get just the API key for a specific provider
export function getAPIKey(provider: AIProvider): string | null {
  const stored = localStorage.getItem(STORAGE_KEYS.AI_CONFIG)
  if (stored) {
    try {
      const config = JSON.parse(stored)
      if (config.provider === provider) {
        return config.apiKey
      }
    } catch {
      return null
    }
  }
  return null
}

// Conversation History Storage

export async function getConversations(): Promise<Conversation[]> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)
    if (stored) {
      const conversations = JSON.parse(stored)
      // Restore Date objects
      return conversations.map((c: Conversation) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        messages: c.messages.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }))
    }
  } catch (e) {
    console.error('Failed to load conversations:', e)
  }
  return []
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations))
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const conversations = await getConversations()
  return conversations.find((c) => c.id === id) || null
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const conversations = await getConversations()
  const index = conversations.findIndex((c) => c.id === conversation.id)

  if (index >= 0) {
    conversations[index] = conversation
  } else {
    conversations.unshift(conversation)
  }

  await saveConversations(conversations)
}

export async function deleteConversation(id: string): Promise<void> {
  const conversations = await getConversations()
  const filtered = conversations.filter((c) => c.id !== id)
  await saveConversations(filtered)
}

export async function clearAllConversations(): Promise<void> {
  localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS)
  localStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION)
}

// Current conversation tracking

export function getCurrentConversationId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION)
}

export function setCurrentConversationId(id: string | null): void {
  if (id) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION, id)
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION)
  }
}

// Create a new conversation

export function createConversation(title?: string): Conversation {
  const now = new Date()
  return {
    id: `conv-${Date.now()}`,
    title: title || 'New Chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

// Add a message to a conversation

export async function addMessageToConversation(
  conversationId: string,
  message: Omit<Message, 'id' | 'timestamp'>
): Promise<Message> {
  const conversation = await getConversation(conversationId)
  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`)
  }

  const newMessage: Message = {
    ...message,
    id: `msg-${Date.now()}`,
    timestamp: new Date(),
  }

  conversation.messages.push(newMessage)
  conversation.updatedAt = new Date()

  // Auto-generate title from first user message
  if (
    conversation.title === 'New Chat' &&
    message.role === 'user' &&
    conversation.messages.length === 1
  ) {
    conversation.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
  }

  await saveConversation(conversation)
  return newMessage
}
