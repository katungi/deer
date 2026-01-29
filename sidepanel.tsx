import { useState, useEffect, useRef } from "react"

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
    // Fetch all tabs when component mounts
    const fetchTabs = async () => {
      try {
        const tabs = await chrome.tabs.query({})
        setAllTabs(tabs)
      } catch (error) {
        console.error('Failed to fetch tabs:', error)
      }
    }

    fetchTabs()

    // Listen for tab updates
    const handleTabUpdate = () => {
      fetchTabs()
    }

    chrome.tabs.onUpdated.addListener(handleTabUpdate)
    chrome.tabs.onCreated.addListener(handleTabUpdate)
    chrome.tabs.onRemoved.addListener(handleTabUpdate)
    chrome.tabs.onActivated.addListener(handleTabUpdate)

    // Cleanup listeners
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
    
    // Clear the contenteditable
    if (inputRef.current) {
      inputRef.current.innerHTML = ""
    }

    // Simulate AI response
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
      // Move cursor to end
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(inputRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
      inputRef.current.focus()
    }
  }

  // Get plain text content from the contenteditable div
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
    
    // Check for @ symbol at the end
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
    
    // Add tab to selected tabs if not already there
    if (!selectedTabs.find(t => t.id === tab.id)) {
      setSelectedTabs(prev => [...prev, tab])
    }
    setShowTabDropdown(false)
    
    // Remove the @ and insert a styled chip
    const content = inputRef.current.innerHTML
    const lastAtIndex = content.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      // Create the chip HTML
      const chipHtml = `<span contenteditable="false" data-tab-id="${tab.id}" data-tab-title="${tab.title}" style="display: inline-flex; align-items: center; gap: 4px; background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 6px; padding: 2px 8px; margin: 0 2px; font-size: 13px; color: #0c4a6e; font-weight: 500; vertical-align: middle; user-select: none;">${tab.title}<button onclick="this.parentElement.remove(); window.dispatchEvent(new CustomEvent('tabChipRemoved', {detail: ${tab.id}}))" style="background: none; border: none; cursor: pointer; padding: 0 0 0 4px; color: #0369a1; font-size: 14px; line-height: 1;">×</button></span>&nbsp;`
      
      inputRef.current.innerHTML = content.substring(0, lastAtIndex) + chipHtml + content.substring(lastAtIndex + 1)
      
      // Move cursor to end
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
    
    // Also remove chip from input
    if (inputRef.current) {
      const chip = inputRef.current.querySelector(`[data-tab-id="${tabId}"]`)
      if (chip) {
        chip.remove()
      }
    }
  }

  // Listen for chip removal events
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
      // Handle backspace on chip
      setTimeout(() => handleInput(), 0)
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "white",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        /* Hide scrollbars but allow scrolling */
        * {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        *::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
      `}</style>
      
      {/* Header with eject button */}
      <div style={{
        position: "relative",
        padding: "12px 16px",
        borderBottom: "1px solid #e0e0e0"
      }}>
        <button
          onClick={handleEject}
          style={{
            position: "absolute",
            top: "12px",
            right: "16px",
            background: "none",
            border: "none",
            padding: "6px",
            cursor: "pointer",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f0f0f0"
            e.currentTarget.style.color = "#333"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none"
            e.currentTarget.style.color = "#666"
          }}
          title="Open in fullscreen">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13zm1 2h11v8h-11V4z"/>
            <path d="M11 6.5l1.5-1.5v3l-1.5-1.5zm-6 3L3.5 11V8L5 9.5z"/>
          </svg>
        </button>
      </div>
      
      {/* Chat Area */}
      <div style={{ 
        flex: 1, 
        display: "flex", 
        flexDirection: "column",
        overflow: "hidden",
        position: "relative"
      }}>
        
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 20px"
          }}>
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "32px",
              overflow: "hidden",
            }}>
              <img 
                src={chrome.runtime.getURL("assets/deer.png")}
                alt="Deer"
                style={{
                  width: "60px",
                  height: "60px",
                  objectFit: "cover"
                }}
              />
            </div>
            
            <div style={{ width: "100%", maxWidth: "300px" }}>
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptClick(prompt)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    marginBottom: "8px",
                    background: "white",
                    border: "1px solid #e0e0e0",
                    borderRadius: "50px",
                    fontSize: "13px",
                    color: "#333",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: "400",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0f0f0"
                    e.currentTarget.style.borderColor = "#d0d0d0"
                    e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.12)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white"
                    e.currentTarget.style.borderColor = "#e0e0e0"
                    e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)"
                  }}>
                  <div style={{ fontSize: "14px" }}>
                    {index === 0 ? "📄" : index === 1 ? "💻" : "💡"}
                  </div>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            background: "#111827"
          }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginBottom: "16px",
                  alignItems: message.isUser ? "flex-end" : "flex-start"
                }}>
                {/* Tab bubbles */}
                {message.tabs && message.tabs.length > 0 && (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    marginBottom: "8px",
                    alignItems: message.isUser ? "flex-end" : "flex-start"
                  }}>
                    {message.tabs.map((tab) => (
                      <div
                        key={tab.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 14px",
                          borderRadius: "50px",
                          background: "#1f2937",
                          maxWidth: "280px"
                        }}>
                        <img
                          src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%236b7280"/></svg>'}
                          alt=""
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            flexShrink: 0
                          }}
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%236b7280"/></svg>'
                          }}
                        />
                        <div style={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px"
                        }}>
                          <div style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            color: "#f3f4f6",
                            fontWeight: "500",
                            fontSize: "13px"
                          }}>
                            {tab.title}
                          </div>
                          <div style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            color: "#9ca3af",
                            fontSize: "12px"
                          }}>
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
                  style={{
                      maxWidth: "85%",
                      padding: "10px 16px",
                      borderRadius: "30px",
                      background: message.isUser ? "#7f1d1d" : "#374151",
                      color: "#f3f4f6",
                    fontSize: "14px",
                      lineHeight: "1.5",
                      whiteSpace: "pre-wrap"
                  }}>
                  {message.text}
                </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab Dropdown */}
        {showTabDropdown && (
          <div style={{
            position: "absolute",
            bottom: "80px",
            left: "20px",
            right: "20px",
            background: "white",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 1000
          }}>
            <div style={{
              padding: "8px 12px",
              fontSize: "12px",
              color: "#666",
              fontWeight: "500",
              borderBottom: "1px solid #f0f0f0"
            }}>
              Select a tab
            </div>
            {allTabs.slice(0, 8).map((tab) => (
              <div
                key={tab.id}
                onClick={() => handleTabSelect(tab)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderBottom: "1px solid #f8f9fa",
                  transition: "background 0.1s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f8f9fa"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white"
                }}>
                <img
                  src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'}
                  alt=""
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 2,
                    flexShrink: 0
                  }}
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "13px",
                    color: "#333",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {tab.title}
                  </div>
                  <div style={{
                    fontSize: "11px",
                    color: "#666",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {tab.url ? new URL(tab.url).hostname : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{
        padding: "12px 16px 16px",
        background: "white"
      }}>
        {/* Quick action chips */}
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "12px"
        }}>
          <button
            onClick={() => handlePromptClick("Explain this page")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              background: "#f3f4f6",
              border: "none",
              borderRadius: "20px",
              fontSize: "13px",
              color: "#374151",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#e5e7eb"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#f3f4f6"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            Explain
          </button>
          <button
            onClick={() => handlePromptClick("Summarize this page")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              background: "#f3f4f6",
              border: "none",
              borderRadius: "20px",
              fontSize: "13px",
              color: "#374151",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#e5e7eb"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#f3f4f6"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 10h16M4 14h10M4 18h6"/>
            </svg>
            Summarize
          </button>
          <button
            onClick={() => handlePromptClick("Analyze this page")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              background: "#f3f4f6",
              border: "none",
              borderRadius: "20px",
              fontSize: "13px",
              color: "#374151",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#e5e7eb"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#f3f4f6"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            Analyze
          </button>
        </div>

        {/* Main input box */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          background: "#374151",
          borderRadius: "16px",
          padding: "12px 14px",
          minHeight: "44px"
        }}>
          {/* Selected Tabs inside input area */}
          {selectedTabs.length > 0 && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: "10px"
            }}>
              {selectedTabs.map((tab) => (
                <div
                  key={tab.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#4b5563",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    fontSize: "12px",
                    maxWidth: "150px"
                  }}>
                  <img
                    src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%236b7280"/></svg>'}
                    alt=""
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 2,
                      flexShrink: 0
                    }}
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%236b7280"/></svg>'
                    }}
                  />
                  <span style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    color: "#e5e7eb",
                      fontWeight: "500",
                    fontSize: "12px"
                    }}>
                      {tab.title}
                  </span>
                  <button
                    onClick={() => tab.id && removeSelectedTab(tab.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "0",
                      color: "#9ca3af",
                      fontSize: "14px",
                      lineHeight: "1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
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
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "14px",
              color: "#e5e7eb",
              lineHeight: "1.5",
                minHeight: "20px",
                maxHeight: "100px",
              fontFamily: "inherit",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              marginBottom: "10px"
            }}
            suppressContentEditableWarning
          />

          {/* Bottom toolbar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            {/* Left icons */}
            <div style={{ display: "flex", gap: "4px" }}>
              <button style={{
                background: "none",
                border: "none",
                padding: "6px",
                cursor: "pointer",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#4b5563"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
              
              <button style={{
                background: "none",
                border: "none",
                padding: "6px",
                cursor: "pointer",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#4b5563"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="6" cy="12" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="18" cy="12" r="2"/>
                </svg>
              </button>
            </div>

            {/* Right icons */}
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <button style={{
                background: "none",
                border: "none",
                padding: "6px",
                cursor: "pointer",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#4b5563"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
              </button>

              <button style={{
                background: "none",
                border: "none",
                padding: "6px",
                cursor: "pointer",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#4b5563"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
              
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() && selectedTabs.length === 0}
                style={{
                  background: (inputText.trim() || selectedTabs.length > 0) ? "#3b82f6" : "#4b5563",
                  border: "none",
                  padding: "6px",
                  cursor: (inputText.trim() || selectedTabs.length > 0) ? "pointer" : "default",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                  marginLeft: "4px"
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndexSidepanel 