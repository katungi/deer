import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Send, Plus, MoreHorizontal, Image, Mic, ChevronDown, ChevronUp } from "lucide-react"
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
  const [tabFilterQuery, setTabFilterQuery] = useState("")
  const [showTabsList, setShowTabsList] = useState(false)
  const inputRef = useRef<HTMLDivElement>(null)

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
    setShowTabsList(false)

    if (inputRef.current) {
      inputRef.current.innerHTML = ""
    }

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

      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
        if (!textAfterAt.includes(' ')) {
          setShowTabDropdown(true)
          setDropdownPosition(lastAtIndex)
          setTabFilterQuery(textAfterAt.toLowerCase())
          // Also expand the tabs list when typing @
          if (messages.length === 0) {
            setShowTabsList(true)
          }
        } else {
          setShowTabDropdown(false)
          setTabFilterQuery("")
        }
      } else {
        setShowTabDropdown(false)
        setTabFilterQuery("")
      }
    }
  }

  const handleTabSelect = (tab: Tab) => {
    if (!inputRef.current) return

    if (!selectedTabs.find(t => t.id === tab.id)) {
      setSelectedTabs(prev => [...prev, tab])
    }
    setShowTabDropdown(false)
    setTabFilterQuery("")

    const content = inputRef.current.innerHTML
    const lastAtIndex = content.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const chipHtml = `<span contenteditable="false" data-tab-id="${tab.id}" data-tab-title="${tab.title}" class="inline-flex items-center gap-1 bg-rose-100 border border-rose-200 rounded-md px-2 py-0.5 mx-0.5 text-xs text-rose-800 font-medium align-middle select-none">${tab.title}<button onclick="this.parentElement.remove(); window.dispatchEvent(new CustomEvent('tabChipRemoved', {detail: ${tab.id}}))" class="bg-transparent border-none cursor-pointer p-0 pl-1 text-rose-500 text-sm leading-none">×</button></span>&nbsp;`

      inputRef.current.innerHTML = content.substring(0, lastAtIndex) + chipHtml + content.substring(lastAtIndex + 1 + tabFilterQuery.length)

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

  const handleTabSelectFromList = (tab: Tab) => {
    if (!selectedTabs.find(t => t.id === tab.id)) {
      setSelectedTabs(prev => [...prev, tab])
      // Prefill the input with the tab title
      if (inputRef.current) {
        const chipHtml = `<span contenteditable="false" data-tab-id="${tab.id}" data-tab-title="${tab.title}" class="inline-flex items-center gap-1 bg-rose-100 border border-rose-200 rounded-md px-2 py-0.5 mx-0.5 text-xs text-rose-800 font-medium align-middle select-none">${tab.title}<button onclick="this.parentElement.remove(); window.dispatchEvent(new CustomEvent('tabChipRemoved', {detail: ${tab.id}}))" class="bg-transparent border-none cursor-pointer p-0 pl-1 text-rose-500 text-sm leading-none">×</button></span>&nbsp;`
        inputRef.current.innerHTML += chipHtml
        // Move cursor to end
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(inputRef.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
        inputRef.current.focus()
        setInputText(getPlainText())
      }
    } else {
      // Deselect if already selected
      setSelectedTabs(prev => prev.filter(t => t.id !== tab.id))
      // Remove the chip from input
      if (inputRef.current) {
        const chip = inputRef.current.querySelector(`[data-tab-id="${tab.id}"]`)
        if (chip) {
          chip.remove()
        }
        setInputText(getPlainText())
      }
    }
    // Toggle the tabs list closed after selection
    setShowTabsList(false)
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
    <div className="min-h-screen bg-stone-50 font-sans flex flex-col">
      {messages.length === 0 ? (
        /* Initial State - Centered Card */
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 max-w-[600px] mx-auto w-full">
          <div className="w-full relative bg-white rounded-3xl border border-stone-200 shadow-lg overflow-hidden">
            {/* Input Section */}
            <div className="flex flex-col p-4 px-5">
              {/* Selected Tabs */}
              {selectedTabs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedTabs.map((tab) => (
                    <div
                      key={tab.id}
                      className="flex items-center gap-1.5 bg-rose-100 border border-rose-200 rounded-lg px-2.5 py-1.5 text-xs max-w-[180px]"
                    >
                      <img
                        src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23fda4af"/></svg>'}
                        alt=""
                        className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23fda4af"/></svg>'
                        }}
                      />
                      <span className="truncate text-rose-800 font-medium text-xs">
                        {tab.title}
                      </span>
                      <button
                        onClick={() => tab.id && removeSelectedTab(tab.id)}
                        className="bg-transparent border-none cursor-pointer p-0 text-rose-500 text-sm leading-none flex-shrink-0 hover:text-rose-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Text Input */}
              <div
                ref={inputRef}
                contentEditable
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                data-placeholder="Search, ask, or @-mention a tab"
                className="border-none bg-transparent outline-none text-base text-stone-800 leading-relaxed min-h-[24px] max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400 empty:before:pointer-events-none"
                suppressContentEditableWarning
              />

              {/* Bottom Toolbar */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-700 hover:bg-stone-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-700 hover:bg-stone-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-1 items-center">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-700 hover:bg-stone-100">
                    <Image className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-700 hover:bg-stone-100">
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() && selectedTabs.length === 0}
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-lg ml-1",
                      (inputText.trim() || selectedTabs.length > 0)
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-stone-300"
                    )}
                  >
                    <Send className="h-4 w-4 text-white" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Expandable Tabs List */}
            <div className="border-t border-stone-100">
              <button
                onClick={() => setShowTabsList(!showTabsList)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-stone-50 transition-colors"
              >
                <span className="text-sm text-stone-600 font-medium">
                  Your Tabs ({allTabs.length})
                </span>
                {showTabsList ? (
                  <ChevronUp className="h-4 w-4 text-stone-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-stone-400" />
                )}
              </button>

              {/* Animated Tabs List */}
              <div
                className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  showTabsList ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="px-3 pb-3 max-h-[280px] overflow-y-auto">
                  {allTabs.slice(0, 10).map((tab) => {
                    const isSelected = selectedTabs.some(t => t.id === tab.id)
                    return (
                      <div
                        key={tab.id}
                        onClick={() => handleTabSelectFromList(tab)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200",
                          isSelected
                            ? "bg-rose-100 border border-rose-200"
                            : "hover:bg-stone-100"
                        )}
                      >
                        <img
                          src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'}
                          alt=""
                          className="w-5 h-5 rounded flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "text-sm truncate font-medium",
                            isSelected ? "text-rose-800" : "text-stone-700"
                          )}>
                            {tab.title}
                          </div>
                          <div className={cn(
                            "text-xs truncate",
                            isSelected ? "text-rose-600" : "text-stone-500"
                          )}>
                            {tab.url ? new URL(tab.url).hostname : ""}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-rose-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Tab Dropdown (when typing @) */}
            {showTabDropdown && (
              <div className="absolute top-full left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto z-50 mt-1">
                <div className="px-3 py-2 text-xs text-stone-500 font-medium border-b border-stone-100">
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
                      className="px-3 py-2 cursor-pointer flex items-center gap-2 border-b border-stone-50 hover:bg-stone-50 transition-colors"
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
                        <div className="text-sm text-stone-700 truncate">{tab.title}</div>
                        <div className="text-xs text-stone-500 truncate">
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
        /* Chat State - Messages with Input at Bottom */
        <div className="flex-1 flex flex-col max-w-[800px] mx-auto w-full px-5 py-10 relative">
          <ScrollArea className="flex-1 pb-5 bg-white rounded-2xl mb-4">
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
                          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-stone-100 max-w-[320px]"
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
                  {/* Message text bubble */}
                  {message.text && (
                    <div
                      className={cn(
                        "max-w-[70%] px-4 py-2.5 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap",
                        message.isUser
                          ? "bg-rose-600 text-white"
                          : "bg-stone-100 text-stone-800"
                      )}
                    >
                      {message.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input at Bottom - Animated in */}
          <div className="animate-in slide-in-from-bottom-4 duration-300 bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
            {/* Selected Tabs */}
            {selectedTabs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {selectedTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className="flex items-center gap-1.5 bg-rose-100 border border-rose-200 rounded-lg px-2.5 py-1.5 text-xs max-w-[150px]"
                  >
                    <img
                      src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23fda4af"/></svg>'}
                      alt=""
                      className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23fda4af"/></svg>'
                      }}
                    />
                    <span className="truncate text-rose-800 font-medium text-xs">
                      {tab.title}
                    </span>
                    <button
                      onClick={() => tab.id && removeSelectedTab(tab.id)}
                      className="bg-transparent border-none cursor-pointer p-0 text-rose-500 text-sm leading-none flex-shrink-0 hover:text-rose-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input text area */}
            <div
              ref={messages.length > 0 ? undefined : inputRef}
              contentEditable
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              data-placeholder="Ask another question..."
              className="border-none bg-transparent outline-none text-sm text-stone-800 leading-relaxed min-h-[20px] max-h-[100px] overflow-y-auto whitespace-pre-wrap break-words mb-2.5 empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400 empty:before:pointer-events-none"
              suppressContentEditableWarning
            />

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-700 hover:bg-stone-100">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-700 hover:bg-stone-100">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-1 items-center">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-700 hover:bg-stone-100">
                  <Image className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-700 hover:bg-stone-100">
                  <Mic className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() && selectedTabs.length === 0}
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-lg ml-1",
                    (inputText.trim() || selectedTabs.length > 0)
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-stone-300"
                  )}
                >
                  <Send className="h-4 w-4 text-white" />
                </Button>
              </div>
            </div>

            {/* Tab Dropdown */}
            {showTabDropdown && (
              <div className="absolute bottom-full left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto z-50 mb-1">
                <div className="px-3 py-2 text-xs text-stone-500 font-medium border-b border-stone-100">
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
                      className="px-3 py-2 cursor-pointer flex items-center gap-2 border-b border-stone-50 hover:bg-stone-50 transition-colors"
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
                        <div className="text-sm text-stone-700 truncate">{tab.title}</div>
                        <div className="text-xs text-stone-500 truncate">
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
