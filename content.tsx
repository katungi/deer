import { useState, useEffect, useRef } from "react"
import type { PlasmoCSConfig } from "plasmo"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { X, Send } from "lucide-react"
import cssText from "data-text:./style.css"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
}

interface Tab {
  id?: number
  title?: string
  url?: string
  favIconUrl?: string
  active?: boolean
}

function FloatingChat() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [selectedTabs, setSelectedTabs] = useState<Tab[]>([])
  const [allTabs, setAllTabs] = useState<Tab[]>([])
  const [showTabDropdown, setShowTabDropdown] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const suggestedPrompts = [
    "Summarize this page",
    "Explain this concept",
    "Help me understand this"
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

  const handleSendMessage = () => {
    if (!inputText.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newMessage])

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: selectedTabs.length > 0
          ? `I can help you with the ${selectedTabs.length} selected tab(s). Here's my analysis...`
          : "I'm here to help! What would you like to know about this page?",
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiResponse])
    }, 1000)

    setInputText("")
    autoResizeTextarea()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
    if (e.key === 'Escape') {
      setShowTabDropdown(false)
      setIsExpanded(false)
    }
  }

  const handlePromptClick = (prompt: string) => {
    setInputText(prompt)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleTabSelect = (tab: Tab) => {
    if (!selectedTabs.find(t => t.id === tab.id)) {
      setSelectedTabs(prev => [...prev, tab])
      setInputText(prev => prev.replace('@', ''))
    }
    setShowTabDropdown(false)
  }

  const removeSelectedTab = (tabId: number) => {
    setSelectedTabs(prev => prev.filter(tab => tab.id !== tabId))
  }

  const autoResizeTextarea = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px'
    }
  }

  useEffect(() => {
    autoResizeTextarea()
  }, [inputText])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputText(value)
    autoResizeTextarea()

    const cursorPosition = e.target.selectionStart
    const textBeforeCursor = value.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1 && lastAtIndex === cursorPosition - 1) {
      setShowTabDropdown(true)
    } else {
      setShowTabDropdown(false)
    }
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  if (!isExpanded) {
    return (
      <div
        onClick={toggleExpanded}
        className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg cursor-pointer z-[999999] flex items-center justify-center transition-all duration-300 border-[3px] border-white hover:scale-105 hover:shadow-xl"
      >
        <img
          src={chrome.runtime.getURL("assets/deer.png")}
          alt="Deer Assistant"
          className="w-8 h-8 object-cover rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 left-6 w-[360px] h-[500px] bg-white rounded-2xl shadow-2xl z-[999999] flex flex-col font-sans border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden">
            <img
              src={chrome.runtime.getURL("assets/deer.png")}
              alt="Deer"
              className="w-5 h-5 object-cover"
            />
          </div>
          <span className="font-semibold text-gray-800 text-sm">
            Deer Assistant
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleExpanded}
          className="h-7 w-7 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {messages.length === 0 ? (
          /* Welcome State */
          <div className="flex-1 flex flex-col items-center justify-center p-5 text-center">
            <div className="w-15 h-15 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 overflow-hidden">
              <img
                src={chrome.runtime.getURL("assets/deer.png")}
                alt="Deer"
                className="w-10 h-10 object-cover"
              />
            </div>

            <h3 className="mb-2 text-gray-800 text-base font-semibold">
              How can I help?
            </h3>

            <p className="mb-5 text-gray-500 text-sm leading-relaxed">
              Ask me anything about this page or use @ to reference tabs.
            </p>

            <div className="w-full space-y-2">
              {suggestedPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => handlePromptClick(prompt)}
                  className="w-full justify-start gap-2.5 text-sm text-gray-700 font-normal py-2.5 px-3.5 hover:bg-gray-50"
                >
                  <span className="text-sm">
                    {index === 0 ? "📄" : index === 1 ? "💭" : "🤔"}
                  </span>
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.isUser ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                      message.isUser
                        ? "bg-violet-500 text-white"
                        : "bg-gray-100 text-gray-800"
                    )}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Tab Dropdown */}
        {showTabDropdown && (
          <div className="absolute bottom-[70px] left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[150px] overflow-y-auto z-50">
            <div className="px-3 py-2 text-xs text-gray-500 font-medium border-b border-gray-100">
              Select a tab
            </div>
            {allTabs.slice(0, 5).map((tab) => (
              <div
                key={tab.id}
                onClick={() => handleTabSelect(tab)}
                className="px-3 py-2 cursor-pointer flex items-center gap-2 border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <img
                  src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'}
                  alt=""
                  className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-700 truncate">
                    {tab.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-100">
        <div className="flex flex-col gap-2 bg-gray-50 rounded-2xl px-3.5 py-2.5 border border-gray-200 min-h-[40px]">
          {/* Selected Tabs */}
          {selectedTabs.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {selectedTabs.map((tab) => (
                <div
                  key={tab.id}
                  className="flex items-center gap-1.5 bg-sky-100 border border-sky-300 rounded-xl px-2 py-1 text-[11px] max-w-[140px]"
                >
                  <img
                    src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'}
                    alt=""
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                  />
                  <span className="text-sky-900 font-medium truncate flex-1">
                    {tab.title}
                  </span>
                  <button
                    onClick={() => removeSelectedTab(tab.id!)}
                    className="bg-transparent border-none cursor-pointer p-0 text-sky-700 text-xs leading-none flex-shrink-0 hover:text-sky-900"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Ask anything..."
              className="flex-1 border-none outline-none resize-none text-sm leading-relaxed bg-transparent text-gray-800 font-sans min-h-[20px] max-h-[100px] overflow-hidden"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              size="icon"
              className={cn(
                "h-8 w-8 rounded-full flex-shrink-0 transition-all",
                inputText.trim()
                  ? "bg-violet-500 hover:bg-violet-600"
                  : "bg-gray-200"
              )}
            >
              <Send className={cn(
                "h-3.5 w-3.5",
                inputText.trim() ? "text-white" : "text-gray-400"
              )} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FloatingChat
