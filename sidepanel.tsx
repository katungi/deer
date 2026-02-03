import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Settings } from "@/components/ui/settings"
import { History } from "@/components/ui/history"
import { AgentSteps } from "@/components/ui/agent-steps"
import { SendIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import {
  useChat,
  hasAPIKey,
  getConversations,
  saveConversation,
  deleteConversation,
  createConversation,
  type Conversation,
} from "@/lib/ai"
import type { AgentStep } from "@/lib/ai/types"
import { Plus, Settings as SettingsIcon, Camera, Mic, Maximize2, Lightbulb, FileText, Search, Square, AlertCircle, History as HistoryIcon, Zap } from "lucide-react"
import "./style.css"

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
  tabs?: Tab[]
  isStreaming?: boolean
  agentSteps?: AgentStep[]
}

interface Tab {
  id?: number
  title?: string
  url?: string
  favIconUrl?: string
  active?: boolean
}

interface ChatFunction {
  id: string
  name: string
  icon: React.ReactNode
}

interface AttachedImage {
  id: string
  dataUrl: string
  tabTitle?: string
}

function IndexSidepanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [selectedTabs, setSelectedTabs] = useState<Tab[]>([])
  const [allTabs, setAllTabs] = useState<Tab[]>([])
  const [showTabDropdown, setShowTabDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState(0)
  const [selectedFunction, setSelectedFunction] = useState<ChatFunction | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)

  // AI Chat hook
  const {
    messages: aiMessages,
    isLoading: isAiLoading,
    agentState,
    sendMessage: sendAiMessage,
    stopAgent,
  } = useChat({
    onError: (error) => {
      setChatError(error.message)
      setTimeout(() => setChatError(null), 5000)
    },
  })

  // Check API key on mount and when settings close
  useEffect(() => {
    setApiKeyConfigured(hasAPIKey())
  }, [showSettings])

  // Load conversations on mount
  useEffect(() => {
    getConversations().then((convs) => {
      setConversations(convs)
      // Start with a new conversation if none exists
      if (convs.length === 0) {
        const newConv = createConversation()
        setCurrentConversation(newConv)
      }
    })
  }, [])

  // Save current conversation when messages change
  useEffect(() => {
    if (currentConversation && messages.length > 0) {
      const updatedConv: Conversation = {
        ...currentConversation,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.isUser ? 'user' as const : 'assistant' as const,
          content: m.text,
          timestamp: m.timestamp,
        })),
        updatedAt: new Date(),
        title: currentConversation.title === 'New Chat' && messages[0]?.text
          ? messages[0].text.slice(0, 50) + (messages[0].text.length > 50 ? '...' : '')
          : currentConversation.title,
      }
      saveConversation(updatedConv).then(() => {
        setCurrentConversation(updatedConv)
        // Refresh conversations list
        getConversations().then(setConversations)
      })
    }
  }, [messages])

  // Conversation handlers
  const handleNewConversation = useCallback(() => {
    const newConv = createConversation()
    setCurrentConversation(newConv)
    setMessages([])
  }, [])

  const handleSelectConversation = useCallback((id: string) => {
    const conv = conversations.find((c) => c.id === id)
    if (conv) {
      setCurrentConversation(conv)
      // Convert stored messages to UI format
      setMessages(
        conv.messages.map((m) => ({
          id: m.id,
          text: m.content,
          isUser: m.role === 'user',
          timestamp: new Date(m.timestamp),
        }))
      )
    }
  }, [conversations])

  const handleDeleteConversation = useCallback(async (id: string) => {
    await deleteConversation(id)
    const updatedConvs = await getConversations()
    setConversations(updatedConvs)

    // If we deleted the current conversation, start a new one
    if (currentConversation?.id === id) {
      if (updatedConvs.length > 0) {
        handleSelectConversation(updatedConvs[0].id)
      } else {
        handleNewConversation()
      }
    }
  }, [currentConversation, handleSelectConversation, handleNewConversation])
  const [themeColor, setThemeColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('deer-theme-color') || 'rose'
    }
    return 'rose'
  })
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('deer-dark-mode') === 'true'
    }
    return false
  })
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [showPermissionRequest, setShowPermissionRequest] = useState(false)
  const [searchEngine, setSearchEngine] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('deer-search-engine') || 'google'
    }
    return 'google'
  })
  const [agentMode, setAgentMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('deer-agent-mode') === 'true'
    }
    return false
  })
  const inputRef = useRef<HTMLDivElement>(null)

  const availableFunctions: ChatFunction[] = [
    { id: "explain", name: "Explain", icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { id: "summarize", name: "Summarize", icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "analyze", name: "Analyze", icon: <Search className="h-3.5 w-3.5" /> }
  ]

  // Apply theme color and dark mode to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeColor)
    localStorage.setItem('deer-theme-color', themeColor)
  }, [themeColor])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('deer-dark-mode', String(darkMode))
  }, [darkMode])

  // Persist search engine to localStorage
  useEffect(() => {
    localStorage.setItem('deer-search-engine', searchEngine)
  }, [searchEngine])

  // Persist agent mode to localStorage
  useEffect(() => {
    localStorage.setItem('deer-agent-mode', String(agentMode))
  }, [agentMode])

  // Listen for storage changes from other pages (newtab, etc.)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'deer-theme-color' && e.newValue) {
        setThemeColor(e.newValue)
      }
      if (e.key === 'deer-dark-mode') {
        setDarkMode(e.newValue === 'true')
      }
      if (e.key === 'deer-search-engine' && e.newValue) {
        setSearchEngine(e.newValue)
      }
      if (e.key === 'deer-agent-mode') {
        setAgentMode(e.newValue === 'true')
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Sync agent steps from AI messages to local messages in real-time
  useEffect(() => {
    if (aiMessages.length > 0) {
      const lastAiMsg = aiMessages[aiMessages.length - 1]
      if (lastAiMsg.role === 'assistant') {
        setMessages(prev => {
          const lastIdx = prev.length - 1
          const lastLocalMsg = prev[lastIdx]
          // Only update if the last local message is a streaming assistant message
          if (lastLocalMsg && !lastLocalMsg.isUser && (lastLocalMsg.isStreaming || lastLocalMsg.agentSteps?.length !== lastAiMsg.agentSteps?.length)) {
            return prev.map((m, i) =>
              i === lastIdx
                ? {
                    ...m,
                    text: lastAiMsg.content || m.text,
                    agentSteps: lastAiMsg.agentSteps,
                    isStreaming: !lastAiMsg.content && isAiLoading
                  }
                : m
            )
          }
          return prev
        })
      }
    }
  }, [aiMessages, isAiLoading])

  const suggestedPrompts = [
    "Summarize this repo",
    "Review this code",
    "Suggest improvements"
  ]

  useEffect(() => {
    const fetchTabs = async () => {
      try {
        const tabs = await chrome.tabs.query({})
        setAllTabs(tabs)
      } catch (error) {
        console.error('Failed to fetch tabs:', error)
      }
    }

    fetchTabs()

    const handleTabUpdate = () => {
      fetchTabs()
    }

    chrome.tabs.onUpdated.addListener(handleTabUpdate)
    chrome.tabs.onCreated.addListener(handleTabUpdate)
    chrome.tabs.onRemoved.addListener(handleTabUpdate)
    chrome.tabs.onActivated.addListener(handleTabUpdate)

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate)
      chrome.tabs.onCreated.removeListener(handleTabUpdate)
      chrome.tabs.onRemoved.removeListener(handleTabUpdate)
      chrome.tabs.onActivated.removeListener(handleTabUpdate)
    }
  }, [])

  const captureTabScreenshot = async () => {
    try {
      // Clear any previous permission error
      setPermissionError(null)
      setShowPermissionRequest(false)

      // Get the active tab or use the first selected tab
      const targetTab = selectedTabs.length > 0
        ? selectedTabs[0]
        : allTabs.find(t => t.active) || allTabs[0]

      if (!targetTab?.id) return

      // Capture the tab screenshot
      const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
        format: 'png',
        quality: 90
      })

      const newImage: AttachedImage = {
        id: Date.now().toString(),
        dataUrl,
        tabTitle: targetTab.title
      }

      setAttachedImages(prev => [...prev, newImage])
    } catch (error: any) {
      console.error('Failed to capture screenshot:', error)
      if (error.message?.includes('permission') || error.message?.includes('activeTab')) {
        setPermissionError('Screenshot permission required.')
        setShowPermissionRequest(true)
      } else {
        setPermissionError('Failed to capture screenshot. Make sure you have an active tab.')
        setShowPermissionRequest(false)
      }
    }
  }

  const requestScreenshotPermission = async () => {
    try {
      const granted = await chrome.permissions.request({
        permissions: ['activeTab']
      })

      if (granted) {
        setPermissionError(null)
        setShowPermissionRequest(false)
        captureTabScreenshot()
      } else {
        setPermissionError('Permission denied. Please enable in extension settings.')
      }
    } catch (error) {
      console.error('Permission request failed:', error)
      setPermissionError('Could not request permission. Please check extension settings.')
    }
  }

  const dismissPermissionError = () => {
    setPermissionError(null)
    setShowPermissionRequest(false)
  }

  const removeAttachedImage = (imageId: string) => {
    setAttachedImages(prev => prev.filter(img => img.id !== imageId))
  }

  const handleSendMessage = async () => {
    const messageText = getPlainText().trim()
    if (!messageText && selectedTabs.length === 0 && !selectedFunction && attachedImages.length === 0) return

    // Check if API key is configured
    if (!apiKeyConfigured) {
      setChatError('Please configure your API key in Settings first')
      setShowSettings(true)
      return
    }

    // Build the full message with function prefix if selected
    const fullText = selectedFunction
      ? `[${selectedFunction.name}] ${messageText}`.trim()
      : messageText

    const newMessage: Message = {
      id: Date.now().toString(),
      text: fullText,
      isUser: true,
      timestamp: new Date(),
      tabs: selectedTabs.length > 0 ? [...selectedTabs] : undefined
    }

    setMessages(prev => [...prev, newMessage])

    // Add a placeholder for AI response
    const aiMessageId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: aiMessageId,
      text: '',
      isUser: false,
      timestamp: new Date(),
      isStreaming: true
    }])

    const currentTabs = [...selectedTabs]
    const currentFunction = selectedFunction?.name

    setInputText("")
    setSelectedTabs([])
    setSelectedFunction(null)
    setAttachedImages([])

    if (inputRef.current) {
      inputRef.current.innerHTML = ""
    }

    try {
      // Send to AI
      await sendAiMessage(fullText, {
        tabs: currentTabs.length > 0 ? currentTabs : undefined,
        selectedFunction: currentFunction,
        agentMode,
      })

      // Update the AI message with the response from aiMessages
      const lastAiMessage = aiMessages[aiMessages.length - 1]
      if (lastAiMessage && lastAiMessage.role === 'assistant') {
        setMessages(prev => prev.map(m =>
          m.id === aiMessageId
            ? { ...m, text: lastAiMessage.content, isStreaming: false }
            : m
        ))
      }
    } catch (error) {
      // Update with error message
      setMessages(prev => prev.map(m =>
        m.id === aiMessageId
          ? { ...m, text: 'Sorry, something went wrong. Please try again.', isStreaming: false }
          : m
      ))
    }
  }

  const handlePromptClick = (prompt: string) => {
    setInputText(prompt)
    if (inputRef.current) {
      inputRef.current.textContent = prompt
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(inputRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
      inputRef.current.focus()
    }
  }

  const getPlainText = () => {
    if (!inputRef.current) return ""

    let text = ""
    inputRef.current.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        if (el.dataset.tabId) {
          text += `@[${el.dataset.tabTitle}]`
        }
      }
    })
    return text
  }

  const handleInput = () => {
    if (!inputRef.current) return

    const text = inputRef.current.textContent || ""
    setInputText(text)

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const textBeforeCursor = text.substring(0, range.startOffset)
      const lastAtIndex = textBeforeCursor.lastIndexOf('@')

      if (lastAtIndex !== -1 && lastAtIndex === textBeforeCursor.length - 1) {
        setShowTabDropdown(true)
        setDropdownPosition(lastAtIndex)
      } else {
        setShowTabDropdown(false)
      }
    }
  }

  const handleTabSelect = (tab: Tab) => {
    if (!inputRef.current) return

    if (!selectedTabs.find(t => t.id === tab.id)) {
      setSelectedTabs(prev => [...prev, tab])
    }
    setShowTabDropdown(false)

    const content = inputRef.current.innerHTML
    const lastAtIndex = content.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const chipHtml = `<span contenteditable="false" data-tab-id="${tab.id}" data-tab-title="${tab.title}" class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 mx-0.5 text-xs font-medium align-middle select-none" style="background-color: var(--theme-color-light); border: 1px solid var(--theme-color); color: var(--theme-color);">${tab.title}<button onclick="this.parentElement.remove(); window.dispatchEvent(new CustomEvent('tabChipRemoved', {detail: ${tab.id}}))" class="bg-transparent border-none cursor-pointer p-0 pl-1 text-sm leading-none" style="color: var(--theme-color);">×</button></span>&nbsp;`

      inputRef.current.innerHTML = content.substring(0, lastAtIndex) + chipHtml + content.substring(lastAtIndex + 1)

      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(inputRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
      inputRef.current.focus()
    }

    setInputText(getPlainText())
  }

  const removeSelectedTab = (tabId: number) => {
    setSelectedTabs(prev => prev.filter(tab => tab.id !== tabId))

    if (inputRef.current) {
      const chip = inputRef.current.querySelector(`[data-tab-id="${tabId}"]`)
      if (chip) {
        chip.remove()
      }
    }
  }

  useEffect(() => {
    const handleChipRemoved = (e: CustomEvent) => {
      removeSelectedTab(e.detail)
    }
    window.addEventListener('tabChipRemoved', handleChipRemoved as EventListener)
    return () => {
      window.removeEventListener('tabChipRemoved', handleChipRemoved as EventListener)
    }
  }, [])

  const handleEject = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("newtab.html")
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
    if (e.key === 'Escape') {
      setShowTabDropdown(false)
    }
    if (e.key === 'Backspace') {
      setTimeout(() => handleInput(), 0)
    }
  }

  const handleFunctionSelect = (func: ChatFunction) => {
    // Toggle off if same function is selected
    if (selectedFunction?.id === func.id) {
      setSelectedFunction(null)
    } else {
      setSelectedFunction(func)
    }
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-stone-900 font-sans transition-colors duration-200">
      {/* Header */}
      <div className="relative p-3 border-b border-gray-200 dark:border-stone-700">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleEject}
          className="absolute top-3 right-4 h-8 w-8 text-gray-500 hover:text-gray-700"
          title="Open in fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
            {/* <div className="flex items-center justify-center mb-8">
              <DeerMascot className="w-20 h-20" />
            </div> */}

            {/* <div className="w-full max-w-[300px] space-y-2">
              {suggestedPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => handlePromptClick(prompt)}
                  className="w-full justify-start gap-2.5 rounded-full py-2.5 px-4 text-sm font-normal shadow-sm hover:shadow-md transition-shadow"
                >
                  <span className="text-base">
                    {index === 0 ? "📄" : index === 1 ? "💻" : "💡"}
                  </span>
                  {prompt}
                </Button>
              ))}
            </div> */}
          </div>
        ) : (
          /* Messages */
          <ScrollArea className="flex-1 bg-white dark:bg-stone-900">
            <div className="p-5 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col",
                    message.isUser ? "items-end" : "items-start"
                  )}
                >
                  {/* Tab bubbles */}
                  {message.tabs && message.tabs.length > 0 && (
                    <div className={cn(
                      "flex flex-col gap-1.5 mb-2",
                      message.isUser ? "items-end" : "items-start"
                    )}>
                      {message.tabs.map((tab) => (
                        <div
                          key={tab.id}
                          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-stone-100 max-w-[280px]"
                        >
                          <img
                            src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23a8a29e"/></svg>'}
                            alt=""
                            className="w-5 h-5 rounded flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23a8a29e"/></svg>'
                            }}
                          />
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="truncate text-stone-800 font-medium text-sm">
                              {tab.title}
                            </div>
                            <div className="truncate text-stone-500 text-xs">
                              {tab.url ? new URL(tab.url).hostname : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Agent steps (for assistant messages with steps) */}
                  {!message.isUser && message.agentSteps && message.agentSteps.length > 0 && (
                    <div className="max-w-[90%] mb-2">
                      <AgentSteps
                        steps={message.agentSteps}
                        isRunning={message.isStreaming}
                      />
                    </div>
                  )}
                  {/* Message text bubble */}
                  {(message.text || message.isStreaming) && (
                    <div
                      className={cn(
                        "max-w-[85%] px-4 py-2.5 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap",
                        message.isUser
                          ? "bg-theme text-white"
                          : "bg-stone-100 dark:bg-stone-700 text-stone-800 dark:text-stone-100"
                      )}
                    >
                      {message.text || (message.isStreaming && !message.agentSteps?.length && (
                        <span className="flex items-center gap-2">
                          <span className="animate-pulse">Thinking...</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {/* Live agent state (when running but no message yet) */}
              {isAiLoading && agentState && agentState.steps.length > 0 && (
                <div className="flex flex-col items-start">
                  <div className="max-w-[90%]">
                    <AgentSteps
                      steps={agentState.steps}
                      isRunning={agentState.isRunning}
                    />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Tab Dropdown */}
        {showTabDropdown && (
          <div className="absolute bottom-20 left-5 right-5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto z-50">
            <div className="px-3 py-2 text-xs text-gray-500 font-medium border-b border-gray-100">
              Select a tab
            </div>
            {allTabs.slice(0, 8).map((tab) => (
              <div
                key={tab.id}
                onClick={() => handleTabSelect(tab)}
                className="px-3 py-2 cursor-pointer flex items-center gap-2 border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <img
                  src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'}
                  alt=""
                  className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 truncate">{tab.title}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {tab.url ? new URL(tab.url).hostname : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 pb-4 bg-white dark:bg-stone-900 transition-colors">
        {/* Quick action chips */}
        <div className="flex gap-2 mb-3 items-center">
          {/* Agent Mode Toggle */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAgentMode(!agentMode)}
            className={cn(
              "rounded-full text-xs gap-1.5 transition-all",
              agentMode
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-400 dark:border-amber-600 hover:opacity-80"
                : "bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300"
            )}
            title={agentMode ? "Agent mode ON - I can perform actions" : "Agent mode OFF - Chat only"}
          >
            <Zap className={cn("h-3.5 w-3.5", agentMode && "fill-amber-500")} />
            Agent
          </Button>

          <div className="w-px h-4 bg-stone-200 dark:bg-stone-600" />

          {availableFunctions.map((func) => (
            <Button
              key={func.id}
              variant="secondary"
              size="sm"
              onClick={() => handleFunctionSelect(func)}
              className={cn(
                "rounded-full text-xs gap-1.5 transition-all",
                selectedFunction?.id === func.id
                  ? "bg-theme-light text-theme border border-theme hover:opacity-80"
                  : "bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300"
              )}
            >
              {func.icon}
              {func.name}
            </Button>
          ))}
        </div>

        {/* Main input box */}
        <div className="flex flex-col bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-3 min-h-[44px] transition-colors">
          {/* Attached Images */}
          {attachedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2.5">
              {attachedImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.dataUrl}
                    alt={img.tabTitle || 'Screenshot'}
                    className="h-12 w-auto rounded-lg border border-stone-200 object-cover"
                  />
                  <button
                    onClick={() => removeAttachedImage(img.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-stone-800 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Selected Function chip */}
          {selectedFunction && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              <div className="flex items-center gap-1.5 bg-theme-light border border-theme rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-theme">{selectedFunction.icon}</span>
                <span className="text-theme font-medium text-xs">
                  {selectedFunction.name}
                </span>
                <button
                  onClick={() => setSelectedFunction(null)}
                  className="bg-transparent border-none cursor-pointer p-0 text-theme text-sm leading-none flex-shrink-0 hover:opacity-70"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Selected Tabs inside input area */}
          {selectedTabs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {selectedTabs.map((tab) => (
                <div
                  key={tab.id}
                  className="flex items-center gap-1.5 bg-theme-light border border-theme rounded-lg px-2.5 py-1.5 text-xs max-w-[150px]"
                >
                  <img
                    src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23a8a29e"/></svg>'}
                    alt=""
                    className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23a8a29e"/></svg>'
                    }}
                  />
                  <span className="truncate text-theme font-medium text-xs">
                    {tab.title}
                  </span>
                  <button
                    onClick={() => tab.id && removeSelectedTab(tab.id)}
                    className="bg-transparent border-none cursor-pointer p-0 text-theme text-sm leading-none flex-shrink-0 hover:opacity-70"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input text area */}
          <div
            ref={inputRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            data-placeholder={selectedFunction ? `What would you like to ${selectedFunction.name.toLowerCase()}?` : agentMode ? "What would you like me to do?" : "Ask me anything..."}
            className="border-none bg-transparent outline-none text-sm text-stone-800 dark:text-stone-100 leading-relaxed min-h-[20px] max-h-[100px] overflow-y-auto whitespace-pre-wrap break-words mb-2.5 empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400 dark:empty:before:text-stone-500 empty:before:pointer-events-none"
            suppressContentEditableWarning
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between">
            {/* Left icons */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewConversation}
                className="h-8 w-8 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700"
                title="New chat"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(true)}
                className="h-8 w-8 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700"
                title="Chat history"
              >
                <HistoryIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="h-8 w-8 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700"
                title="Settings"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Right icons */}
            <div className="flex gap-1 items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={captureTabScreenshot}
                className="h-8 w-8 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700"
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700">
                <Mic className="h-4 w-4" />
              </Button>
              {isAiLoading ? (
                <Button
                  onClick={stopAgent}
                  size="icon"
                  className="h-8 w-8 rounded-lg ml-1 bg-red-500 hover:bg-red-600"
                  title="Stop generating"
                >
                  <Square className="h-3 w-3 text-white fill-white" />
                </Button>
              ) : (
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() && selectedTabs.length === 0 && !selectedFunction && attachedImages.length === 0}
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-lg ml-1",
                    (inputText.trim() || selectedTabs.length > 0 || selectedFunction || attachedImages.length > 0)
                      ? "bg-theme hover:bg-theme-dark"
                      : "bg-stone-300"
                  )}
                >
                  <SendIcon className="h-4 w-4 text-white" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Permission Error Toast */}
      {permissionError && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
          <div className="bg-stone-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-[300px]">
            <div className="flex-1 text-xs">{permissionError}</div>
            {showPermissionRequest && (
              <button
                onClick={requestScreenshotPermission}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme hover:bg-theme-dark text-white transition-colors"
              >
                Grant
              </button>
            )}
            <button
              onClick={dismissPermissionError}
              className="text-stone-400 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Chat Error Toast */}
      {chatError && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
          <div className="bg-red-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-[300px]">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1 text-xs">{chatError}</div>
            <button
              onClick={() => setChatError(null)}
              className="text-red-300 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        selectedColor={themeColor}
        onColorChange={setThemeColor}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
        searchEngine={searchEngine}
        onSearchEngineChange={setSearchEngine}
      />

      {/* History Panel */}
      <History
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        conversations={conversations}
        currentConversationId={currentConversation?.id || null}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />
    </div>
  )
}

export default IndexSidepanel
