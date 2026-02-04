export type AIProvider = 'anthropic' | 'openai' | 'groq'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  attachments?: Attachment[]
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

export interface Attachment {
  type: 'image' | 'tab'
  data: string // base64 for images, JSON for tab data
  metadata?: Record<string, string>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  result: unknown
  error?: string
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export interface BrowserContext {
  tabs: chrome.tabs.Tab[]
  activeTab?: chrome.tabs.Tab
  selectedTabs: chrome.tabs.Tab[]
  screenshots: string[] // base64 images
}

export interface AgentState {
  isRunning: boolean
  currentStep: string
  steps: AgentStep[]
  plan?: AgentPlan
}

export type StepCategory = 'planning' | 'navigation' | 'interaction' | 'search' | 'other'

export interface AgentStep {
  id: string
  action: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: unknown
  error?: string
  // Enhanced fields for timeline UI
  screenshot?: string        // base64 screenshot if captured
  description?: string       // Human-readable description (e.g., "Navigating to Komoot")
  category?: StepCategory    // Step category for grouping
}

// Plan types for checklist rendering
export interface AgentPlan {
  items: PlanItem[]
}

export interface PlanItem {
  id: string
  text: string
  status: 'pending' | 'in_progress' | 'completed'
}
