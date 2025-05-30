import { useState, useEffect, useRef } from "react"

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

function IndexSidepanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [selectedTabs, setSelectedTabs] = useState<Tab[]>([])
  const [allTabs, setAllTabs] = useState<Tab[]>([])
  const [showTabDropdown, setShowTabDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    if (!inputText.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newMessage])
    setInputText("")

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
  }

  const autoResizeTextarea = () => {
    if (inputRef.current) {
      inputRef.current.style.height = '20px'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px'
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputText(value)

    // Auto-resize textarea
    autoResizeTextarea()

    // Check for @ symbol
    const cursorPosition = e.target.selectionStart
    const textBeforeCursor = value.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1 && lastAtIndex === cursorPosition - 1) {
      setShowTabDropdown(true)
      setDropdownPosition(lastAtIndex)
    } else {
      setShowTabDropdown(false)
    }
  }

  const handleTabSelect = (tab: Tab) => {
    if (!selectedTabs.find(t => t.id === tab.id)) {
      setSelectedTabs(prev => [...prev, tab])
    }
    setShowTabDropdown(false)
    
    // Replace @ with tab reference in input
    const beforeAt = inputText.substring(0, dropdownPosition)
    const afterAt = inputText.substring(dropdownPosition + 1)
    setInputText(beforeAt + `@${tab.title} ` + afterAt)
  }

  const removeSelectedTab = (tabId: number) => {
    const tabToRemove = selectedTabs.find(tab => tab.id === tabId)
    setSelectedTabs(prev => prev.filter(tab => tab.id !== tabId))
    
    // Also remove tab references from input text
    if (tabToRemove && tabToRemove.title) {
      const tabReference = `@${tabToRemove.title}`
      setInputText(prev => prev.replace(new RegExp(`@${tabToRemove.title}\\s*`, 'g'), ''))
    }
  }

  const handleEject = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("newtab.html")
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
    if (e.key === 'Escape') {
      setShowTabDropdown(false)
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
            padding: "20px"
          }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  marginBottom: "16px",
                  justifyContent: message.isUser ? "flex-end" : "flex-start"
                }}>
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "12px 16px",
                    borderRadius: "16px",
                    background: message.isUser ? "#8b5cf6" : "white",
                    color: message.isUser ? "white" : "#333",
                    fontSize: "14px",
                    lineHeight: "1.4",
                    border: message.isUser ? "none" : "1px solid #e0e0e0"
                  }}>
                  {message.text}
                </div>
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
        padding: "16px 20px 20px",
        background: "white"
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          background: "#f8f9fa",
          borderRadius: "24px",
          padding: "12px 16px",
          border: "1px solid #e0e0e0",
          minHeight: "44px"
        }}>
          {/* Selected Tabs inside input area */}
          {selectedTabs.length > 0 && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: selectedTabs.length > 0 ? "8px" : "0"
            }}>
              {selectedTabs.map((tab) => (
                <div
                  key={tab.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#e8e8e8",
                    border: "1px solid #d0d0d0",
                    borderRadius: "10px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    maxWidth: "150px"
                  }}>
                  <img
                    src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'}
                    alt=""
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 2,
                      flexShrink: 0
                    }}
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'
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
                      color: "#333",
                      fontWeight: "500",
                      fontSize: "13px"
                    }}>
                      {tab.title}
                    </div>
                    <div style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "#666",
                      fontSize: "11px"
                    }}>
                      {tab.url ? new URL(tab.url).hostname : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => tab.id && removeSelectedTab(tab.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px",
                      color: "#666",
                      fontSize: "16px",
                      lineHeight: "1",
                      width: "16px",
                      height: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "2px",
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f0f0f0"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "none"
                    }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "12px"
          }}>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Ask a question about this page..."
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                resize: "none",
                outline: "none",
                fontSize: "14px",
                color: "#333",
                lineHeight: "1.4",
                minHeight: "20px",
                maxHeight: "100px",
                fontFamily: "inherit"
              }}
              rows={1}
            />
            
            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
              <button style={{
                background: "none",
                border: "none",
                padding: "8px",
                cursor: "pointer",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#666">
                  <path d="M10 2V18M2 10H18" strokeWidth="2" stroke="currentColor"/>
                </svg>
              </button>
              
              <button style={{
                background: "none",
                border: "none",
                padding: "8px",
                cursor: "pointer",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#666">
                  <path d="M3 4C3 2.89543 3.89543 2 5 2H15C16.1046 2 17 2.89543 17 4V16C17 17.1046 16.1046 18 15 18H5C3.89543 18 3 17.1046 3 16V4Z" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="M15 14L12 11L8 15L6 13L3 16" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              </button>

              <button style={{
                background: "none",
                border: "none",
                padding: "8px",
                cursor: "pointer",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#666">
                  <path d="M6 4C6 2.89543 6.89543 2 8 2H12C13.1046 2 14 2.89543 14 4V10C14 11.1046 13.1046 12 12 12H8C6.89543 12 6 11.1046 6 10V4Z" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="M10 12V16M7 18H13" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
              
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                style={{
                  background: inputText.trim() ? "#007AFF" : "#e0e0e0",
                  border: "none",
                  padding: "8px",
                  cursor: inputText.trim() ? "pointer" : "not-allowed",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease"
                }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill={inputText.trim() ? "white" : "#666"}>
                  <path d="M2 2L14 8L2 14V9L10 8L2 7V2Z" fill="currentColor"/>
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