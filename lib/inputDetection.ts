export type InputType = 'url' | 'search' | 'chat'

export interface SearchEngine {
  id: string
  name: string
  searchUrl: string
}

export const searchEngines: SearchEngine[] = [
  { id: 'google', name: 'Google', searchUrl: 'https://www.google.com/search?q=' },
  { id: 'duckduckgo', name: 'DuckDuckGo', searchUrl: 'https://duckduckgo.com/?q=' },
  { id: 'bing', name: 'Bing', searchUrl: 'https://www.bing.com/search?q=' },
  { id: 'brave', name: 'Brave', searchUrl: 'https://search.brave.com/search?q=' },
]

// URL detection - matches http(s)://, www., or domain-like patterns (example.com)
export function isUrl(text: string): boolean {
  const trimmed = text.trim()
  // Has protocol
  if (/^https?:\/\//i.test(trimmed)) return true
  // Starts with www.
  if (/^www\./i.test(trimmed)) return true
  // Looks like a domain (word.tld pattern, no spaces)
  if (/^[a-z0-9-]+\.[a-z]{2,}(\/\S*)?$/i.test(trimmed) && !trimmed.includes(' ')) return true
  return false
}

// Normalize URL for navigation
export function normalizeUrl(text: string): string {
  const trimmed = text.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

// Question detection - questions or @-mentions indicate chat intent
export function isQuestion(text: string): boolean {
  const trimmed = text.trim().toLowerCase()
  // Contains @-mention (tab reference)
  if (text.includes('@[')) return true
  // Ends with question mark
  if (trimmed.endsWith('?')) return true
  // Starts with question words
  if (/^(what|who|where|when|why|how|can|should|would|could|is|are|do|does|will|tell|explain|help|summarize|analyze)\b/.test(trimmed)) return true
  return false
}

// Main detection function
export function detectInputType(text: string, hasSelectedTabs: boolean): InputType {
  const trimmed = text.trim()
  if (!trimmed) return 'chat' // Empty with tabs = chat

  // If tabs are selected, always chat mode
  if (hasSelectedTabs) return 'chat'

  // Check if URL
  if (isUrl(trimmed)) return 'url'

  // Check if question/chat
  if (isQuestion(trimmed)) return 'chat'

  // Default to search
  return 'search'
}

// Build search URL
export function buildSearchUrl(query: string, engineId: string): string {
  const engine = searchEngines.find(e => e.id === engineId) || searchEngines[0]
  return engine.searchUrl + encodeURIComponent(query)
}
