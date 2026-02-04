export type AIProvider = 'nvidia' | 'anthropic' | 'openai' | 'groq'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model?: string
  visionModel?: string  // Optional vision model for image analysis
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

// Permission and security types
export type ActionCategory = 'prohibited' | 'requires_permission' | 'regular'

export type PermissionCategory =
  | 'download'
  | 'form_submit'
  | 'send_message'
  | 'accept_terms'
  | 'social_post'
  | 'other'

export interface ActionClassification {
  category: ActionCategory
  reason?: string
  permissionType?: PermissionCategory
}

export interface PermissionRequest {
  requestId: string
  action: string
  reason: string
  details?: string
  category: PermissionCategory
}

export interface PermissionResponse {
  requestId: string
  approved: boolean
  reason?: string
  allowAllSimilar?: boolean
}

// Pre-approval tracking for session
export interface PreApprovals {
  download?: boolean
  form_submit?: boolean
  send_message?: boolean
  accept_terms?: boolean
  social_post?: boolean
}

// Constants for action classification
export const PROHIBITED_ACTIONS = [
  'password_entry',
  'credit_card_entry',
  'ssn_entry',
  'api_key_entry',
  'account_creation',
  'permission_grant',
  'security_settings',
  'executable_download',
] as const

export const PERMISSION_REQUIRED_ACTIONS = [
  'download',
  'form_submit_sensitive',
  'send_message',
  'accept_terms',
  'social_post',
  'share_content',
] as const

export type ProhibitedAction = typeof PROHIBITED_ACTIONS[number]
export type PermissionRequiredAction = typeof PERMISSION_REQUIRED_ACTIONS[number]
