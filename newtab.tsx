import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Search, MessageSquare, Plus, Mic, Send, X, Check } from "lucide-react"
import "./style.css"

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
  tabs?: Tab[]
}

interface Tab {
  id?: number
  title?: string
  url?: string
  favIconUrl?: string
  active?: boolean
}

function NewTabPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [selectedTabs, setSelectedTabs] = useState<Tab[]>([])
  const [allTabs, setAllTabs] = useState<Tab[]>([])
  const [showTabDropdown, setShowTabDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [listeningTime, setListeningTime] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listeningIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const suggestedPrompts = [
    "Can you help me brainstorm ideas for my paper?",
    "Quiz me about...",
    "How do DNA and RNA differ in structure and function?",
    "Recommend movies to watch tonight under 100 minutes",
    "How to surf?"
  ]

  useEffect(() => {
    const fetchTabs = async () => {
      try {
        const tabs = await chrome.tabs.query({})
        setAllTabs(tabs)
      } catch (error) {
        console.error('Error fetching tabs:', error)
      }
    }

    fetchTabs()

    const handleTabUpdate = () => {
      fetchTabs()
    }

    chrome.tabs.onUpdated.addListener(handleTabUpdate)
    chrome.tabs.onCreated.addListener(handleTabUpdate)
    chrome.tabs.onRemoved.addListener(handleTabUpdate)

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate)
      chrome.tabs.onCreated.removeListener(handleTabUpdate)
      chrome.tabs.onRemoved.removeListener(handleTabUpdate)
    }
  }, [])

  useEffect(() => {
    if (isListening) {
      listeningIntervalRef.current = setInterval(() => {
        setListeningTime(prev => prev + 1)
      }, 1000)
    } else {
      if (listeningIntervalRef.current) {
        clearInterval(listeningIntervalRef.current)
      }
      setListeningTime(0)
    }

    return () => {
      if (listeningIntervalRef.current) {
        clearInterval(listeningIntervalRef.current)
      }
    }
  }, [isListening])

  const handleSendMessage = () => {
    if (!inputText.trim() && selectedTabs.length === 0) return

    const messageText = inputText.trim()

    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date(),
      tabs: selectedTabs.length > 0 ? [...selectedTabs] : undefined
    }

    setMessages(prev => [...prev, newMessage])

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: selectedTabs.length > 0
          ? `I can help you with the ${selectedTabs.length} selected tab(s). Here's my analysis...`
          : "Of course! What topic or subject would you like to be quizzed on? It could be anything—history, science, pop culture, geography, sports, or something else. Let me know your preference, and I'll create a quiz for you!",
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiResponse])
    }, 1000)

    setInputText("")
    setSelectedTabs([])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handlePromptClick = (prompt: string) => {
    setInputText(prompt)
    handleSendMessage()
  }

  const [tabFilterQuery, setTabFilterQuery] = useState("")

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputText(value)

    if (inputRef.current) {
      inputRef.current.style.height = '20px'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }

    const cursorPosition = e.target.selectionStart
    const textBeforeCursor = value.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      if (!textAfterAt.includes(' ')) {
        setShowTabDropdown(true)
        setDropdownPosition(lastAtIndex)
        setTabFilterQuery(textAfterAt.toLowerCase())
      } else {
        setShowTabDropdown(false)
        setTabFilterQuery("")
      }
    } else {
      setShowTabDropdown(false)
      setTabFilterQuery("")
    }
  }

  const handleTabSelect = (tab: Tab) => {
    if (!selectedTabs.find(t => t.id === tab.id)) {
      setSelectedTabs(prev => [...prev, tab])
    }
    setShowTabDropdown(false)
    setTabFilterQuery("")

    const beforeAt = inputText.substring(0, dropdownPosition)
    const afterAtStart = dropdownPosition + 1 + tabFilterQuery.length
    const afterAt = inputText.substring(afterAtStart)
    setInputText(beforeAt + afterAt)
  }

  const removeSelectedTab = (tabId: number) => {
    const tabToRemove = selectedTabs.find(tab => tab.id === tabId)
    setSelectedTabs(prev => prev.filter(tab => tab.id !== tabId))

    if (tabToRemove && tabToRemove.title) {
      setInputText(prev => prev.replace(new RegExp(`@${tabToRemove.title}\\s*`, 'g'), ''))
    }
  }

  const startListening = () => {
    setIsListening(true)
    setListeningTime(0)
  }

  const stopListening = () => {
    setIsListening(false)
    setListeningTime(0)
  }

  const submitListening = () => {
    setIsListening(false)
    setListeningTime(0)
    setInputText("Voice input processed...")
    setTimeout(() => {
      handleSendMessage()
    }, 500)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const WaveAnimation = () => (
    <div className="flex items-center justify-center gap-0.5 h-8">
      {[...Array(15)].map((_, i) => (
        <div
          key={i}
          className="w-0.5 bg-gray-400 rounded-sm animate-wave"
          style={{
            animationDelay: `${i * 0.1}s`,
            height: `${Math.random() * 20 + 5}px`
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.3); opacity: 0.3; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .animate-wave {
          animation: wave 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 max-w-[600px] mx-auto w-full">
          <div className="w-full relative bg-white rounded-3xl border border-gray-200 shadow-lg">
            <div className="flex flex-col gap-2 p-4 px-5">
              {selectedTabs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedTabs.map((tab) => (
                    <div
                      key={tab.id}
                      className="flex items-center gap-2 bg-sky-100 border border-sky-300 rounded-xl px-3 py-2 text-xs max-w-[200px]"
                    >
                      <img
                        src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'}
                        alt=""
                        className="w-4 h-4 rounded-sm flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'
                        }}
                      />
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="truncate text-sky-900 font-medium text-sm">
                          {tab.title}
                        </div>
                        <div className="truncate text-sky-700 text-xs">
                          {tab.url ? new URL(tab.url).hostname : ""}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => tab.id && removeSelectedTab(tab.id)}
                        className="h-4 w-4 p-0 text-sky-700 hover:text-sky-900 hover:bg-sky-200"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Search, ask, or @-mention a tab"
                  className="flex-1 border-none outline-none resize-none text-base leading-relaxed bg-transparent text-gray-700 font-sans min-h-[20px] max-h-[120px]"
                />
              </div>
            </div>

            {isListening && (
              <div className="p-6 text-center border-t border-gray-100 rounded-b-3xl">
                <div className="text-sm text-gray-500 mb-4">Listening...</div>
                <WaveAnimation />
                <div className="text-lg text-gray-700 mt-4 mb-5 font-light tracking-wide">
                  {formatTime(listeningTime)}
                </div>
                <div className="flex justify-center gap-4">
                  <Button
                    onClick={stopListening}
                    size="icon"
                    className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 shadow"
                  >
                    <X className="h-4 w-4 text-white" />
                  </Button>
                  <Button
                    onClick={submitListening}
                    size="icon"
                    className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 shadow"
                  >
                    <Check className="h-4 w-4 text-white" />
                  </Button>
                </div>
              </div>
            )}

            {!isListening && (
              <div className="p-5 border-t border-gray-100 rounded-b-3xl">
                <div className="flex flex-col gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      onClick={() => handlePromptClick(prompt)}
                      className="justify-start gap-2 text-sm text-gray-700 font-normal h-auto py-3 px-4 hover:bg-gray-100"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="flex-1 text-left">{prompt}</span>
                    </Button>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  onClick={() => {
                    setInputText("@")
                    setShowTabDropdown(true)
                    setDropdownPosition(0)
                    inputRef.current?.focus()
                  }}
                  className="w-full justify-between text-sm text-gray-500 h-auto py-3 px-4 mt-4 hover:bg-gray-100"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>Add tabs or files</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      startListening()
                    }}
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                </Button>
              </div>
            )}

            {showTabDropdown && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto z-50 mt-1">
                <div className="px-3 py-2 text-xs text-gray-500 font-medium border-b border-gray-100">
                  Select a tab
                </div>
                {allTabs
                  .filter(tab => {
                    if (!tabFilterQuery) return true
                    const title = (tab.title || '').toLowerCase()
                    const url = (tab.url || '').toLowerCase()
                    return title.includes(tabFilterQuery) || url.includes(tabFilterQuery)
                  })
                  .slice(0, 8)
                  .map((tab) => (
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
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-[800px] mx-auto w-full px-5 py-10 relative">
          <ScrollArea className="flex-1 pb-5">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col",
                    message.isUser ? "items-end" : "items-start"
                  )}
                >
                  {message.tabs && message.tabs.length > 0 && (
                    <div className={cn(
                      "flex flex-col gap-1.5 mb-2",
                      message.isUser ? "items-end" : "items-start"
                    )}>
                      {message.tabs.map((tab) => (
                        <div
                          key={tab.id}
                          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-gray-800 max-w-[320px]"
                        >
                          <img
                            src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%236b7280"/></svg>'}
                            alt=""
                            className="w-5 h-5 rounded flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%236b7280"/></svg>'
                            }}
                          />
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="truncate text-gray-100 font-medium text-sm">
                              {tab.title}
                            </div>
                            <div className="truncate text-gray-400 text-xs">
                              {tab.url ? new URL(tab.url).hostname : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {message.text && (
                    <div
                      className={cn(
                        "max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                        message.isUser
                          ? "bg-red-900 text-gray-100"
                          : "bg-gray-700 text-gray-100"
                      )}
                    >
                      {message.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {selectedTabs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selectedTabs.map((tab) => (
                <div
                  key={tab.id}
                  className="flex items-center gap-2 bg-sky-100 border border-sky-300 rounded-xl px-3 py-2 text-xs max-w-[200px]"
                >
                  <img
                    src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'}
                    alt=""
                    className="w-4 h-4 rounded-sm flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'
                    }}
                  />
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="truncate text-sky-900 font-medium text-sm">
                      {tab.title}
                    </div>
                    <div className="truncate text-sky-700 text-xs">
                      {tab.url ? new URL(tab.url).hostname : ""}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => tab.id && removeSelectedTab(tab.id)}
                    className="h-4 w-4 p-0 text-sky-700 hover:text-sky-900 hover:bg-sky-200"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-3 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Ask another question..."
              className="flex-1 border-none outline-none resize-none text-sm leading-relaxed bg-transparent text-gray-700 font-sans min-h-[20px] max-h-[100px]"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={startListening}
              className="h-8 w-8 hover:bg-gray-100"
            >
              <Mic className="w-5 h-5 text-gray-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSendMessage}
              className="h-8 w-8"
            >
              <Send className="w-5 h-5 text-gray-400" />
            </Button>

            {showTabDropdown && (
              <div className="absolute bottom-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto z-50 mb-1">
                <div className="px-3 py-2 text-xs text-gray-500 font-medium border-b border-gray-100">
                  Select a tab
                </div>
                {allTabs
                  .filter(tab => {
                    if (!tabFilterQuery) return true
                    const title = (tab.title || '').toLowerCase()
                    const url = (tab.url || '').toLowerCase()
                    return title.includes(tabFilterQuery) || url.includes(tabFilterQuery)
                  })
                  .slice(0, 8)
                  .map((tab) => (
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
        </div>
      )}
    </div>
  )
}

export default NewTabPage
