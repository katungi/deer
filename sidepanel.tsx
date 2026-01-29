import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Send, Plus, MoreHorizontal, Image, Mic, Maximize2 } from "lucide-react"
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

function IndexSidepanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [selectedTabs, setSelectedTabs] = useState<Tab[]>([])
  const [allTabs, setAllTabs] = useState<Tab[]>([])
  const [showTabDropdown, setShowTabDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState(0)
  const inputRef = useRef<HTMLDivElement>(null)

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

  const handleSendMessage = () => {
    const messageText = getPlainText().trim()
    if (!messageText && selectedTabs.length === 0) return

    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date(),
      tabs: selectedTabs.length > 0 ? [...selectedTabs] : undefined
    }

    setMessages(prev => [...prev, newMessage])
    setInputText("")
    setSelectedTabs([])

    if (inputRef.current) {
      inputRef.current.innerHTML = ""
    }

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm analyzing the selected tabs and their content. Based on what I can see, I'll help you with your request.",
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiResponse])
    }, 1000)
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
      const chipHtml = `<span contenteditable="false" data-tab-id="${tab.id}" data-tab-title="${tab.title}" class="inline-flex items-center gap-1 bg-sky-100 border border-sky-300 rounded-md px-2 py-0.5 mx-0.5 text-xs text-sky-900 font-medium align-middle select-none">${tab.title}<button onclick="this.parentElement.remove(); window.dispatchEvent(new CustomEvent('tabChipRemoved', {detail: ${tab.id}}))" class="bg-transparent border-none cursor-pointer p-0 pl-1 text-sky-700 text-sm leading-none">×</button></span>&nbsp;`

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

  return (
    <div className="flex flex-col h-screen bg-white font-sans">
      {/* Header */}
      <div className="relative p-3 border-b border-gray-200">
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
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-8 overflow-hidden">
              <img
                src={chrome.runtime.getURL("assets/deer.png")}
                alt="Deer"
                className="w-15 h-15 object-cover"
              />
            </div>

            <div className="w-full max-w-[300px] space-y-2">
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
            </div>
          </div>
        ) : (
          /* Messages */
          <ScrollArea className="flex-1 bg-gray-900">
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
                          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-gray-800 max-w-[280px]"
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
                  {/* Message text bubble */}
                  {message.text && (
                    <div
                      className={cn(
                        "max-w-[85%] px-4 py-2.5 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap",
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
      <div className="p-3 pb-4 bg-white">
        {/* Quick action chips */}
        <div className="flex gap-2 mb-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlePromptClick("Explain this page")}
            className="rounded-full text-xs gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            Explain
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlePromptClick("Summarize this page")}
            className="rounded-full text-xs gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 10h16M4 14h10M4 18h6"/>
            </svg>
            Summarize
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlePromptClick("Analyze this page")}
            className="rounded-full text-xs gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            Analyze
          </Button>
        </div>

        {/* Main input box */}
        <div className="flex flex-col bg-gray-700 rounded-2xl p-3 min-h-[44px]">
          {/* Selected Tabs inside input area */}
          {selectedTabs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {selectedTabs.map((tab) => (
                <div
                  key={tab.id}
                  className="flex items-center gap-1.5 bg-gray-600 rounded-lg px-2.5 py-1.5 text-xs max-w-[150px]"
                >
                  <img
                    src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%236b7280"/></svg>'}
                    alt=""
                    className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%236b7280"/></svg>'
                    }}
                  />
                  <span className="truncate text-gray-200 font-medium text-xs">
                    {tab.title}
                  </span>
                  <button
                    onClick={() => tab.id && removeSelectedTab(tab.id)}
                    className="bg-transparent border-none cursor-pointer p-0 text-gray-400 text-sm leading-none flex-shrink-0 hover:text-gray-200"
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
            data-placeholder="Ask a question about this page..."
            className="border-none bg-transparent outline-none text-sm text-gray-200 leading-relaxed min-h-[20px] max-h-[100px] overflow-y-auto whitespace-pre-wrap break-words mb-2.5 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none"
            suppressContentEditableWarning
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between">
            {/* Left icons */}
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-200 hover:bg-gray-600">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-200 hover:bg-gray-600">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            {/* Right icons */}
            <div className="flex gap-1 items-center">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-200 hover:bg-gray-600">
                <Image className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-200 hover:bg-gray-600">
                <Mic className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={!inputText.trim() && selectedTabs.length === 0}
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-lg ml-1",
                  (inputText.trim() || selectedTabs.length > 0)
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "bg-gray-600"
                )}
              >
                <Send className="h-4 w-4 text-white" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndexSidepanel
