import { useState, useEffect, useRef } from "react"
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
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
      setInputText(prev => prev.replace('@', `@${tab.title} `))
    }
    setShowTabDropdown(false)
  }

  const removeSelectedTab = (tabId: number) => {
    const tabToRemove = selectedTabs.find(tab => tab.id === tabId)
    setSelectedTabs(prev => prev.filter(tab => tab.id !== tabId))
    
    if (tabToRemove && tabToRemove.title) {
      setInputText(prev => prev.replace(new RegExp(`@${tabToRemove.title}\\s*`, 'g'), ''))
    }
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
    // Collapsed floating bubble
    return (
      <div
        onClick={toggleExpanded}
        style={{
          position: "fixed",
          bottom: "24px",
          left: "24px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          cursor: "pointer",
          zIndex: 999999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.3s ease",
          border: "3px solid white"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)"
          e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)"
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)"
        }}>
        <img 
          src={chrome.runtime.getURL("assets/deer.png")}
          alt="Deer Assistant"
          style={{
            width: "32px",
            height: "32px",
            objectFit: "cover",
            borderRadius: "50%"
          }}
        />
      </div>
    )
  }

  // Expanded chat interface
  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "24px",
        width: "360px",
        height: "500px",
        background: "white",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        border: "1px solid #e0e0e0",
        overflow: "hidden"
      }}>

      {/* Header */}
      <div style={{
        padding: "16px 20px",
        background: "white",
        borderBottom: "1px solid #f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}>
            <img 
              src={chrome.runtime.getURL("assets/deer.png")}
              alt="Deer"
              style={{
                width: "20px",
                height: "20px",
                objectFit: "cover"
              }}
            />
          </div>
          <span style={{ 
            fontWeight: "600", 
            color: "#333",
            fontSize: "14px"
          }}>
            Deer Assistant
          </span>
        </div>
        <button
          onClick={toggleExpanded}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "4px",
            color: "#666"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f0f0f0"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none"
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18"/>
            <path d="M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Content Area */}
      <div style={{ 
        flex: 1, 
        display: "flex", 
        flexDirection: "column",
        position: "relative",
        overflow: "hidden"
      }}>

        {messages.length === 0 ? (
          /* Welcome State */
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            textAlign: "center"
          }}>
            <div style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
              overflow: "hidden"
            }}>
              <img 
                src={chrome.runtime.getURL("assets/deer.png")}
                alt="Deer"
                style={{
                  width: "40px",
                  height: "40px",
                  objectFit: "cover"
                }}
              />
            </div>
            
            <h3 style={{ 
              marginBottom: "8px", 
              color: "#333",
              fontSize: "16px",
              fontWeight: "600"
            }}>
              How can I help?
            </h3>
            
            <p style={{ 
              marginBottom: "20px", 
              color: "#666",
              fontSize: "13px",
              lineHeight: "1.4"
            }}>
              Ask me anything about this page or use @ to reference tabs.
            </p>

            <div style={{ width: "100%" }}>
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
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "#333",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: "400"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0f0f0"
                    e.currentTarget.style.borderColor = "#d0d0d0"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white"
                    e.currentTarget.style.borderColor = "#e0e0e0"
                  }}>
                  <div style={{ fontSize: "14px" }}>
                    {index === 0 ? "📄" : index === 1 ? "💭" : "🤔"}
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
            padding: "16px"
          }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  marginBottom: "12px",
                  justifyContent: message.isUser ? "flex-end" : "flex-start"
                }}>
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "10px 14px",
                    borderRadius: "16px",
                    background: message.isUser ? "#8b5cf6" : "#f1f3f4",
                    color: message.isUser ? "white" : "#333",
                    fontSize: "13px",
                    lineHeight: "1.4"
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
            bottom: "70px",
            left: "16px",
            right: "16px",
            background: "white",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            maxHeight: "150px",
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
            {allTabs.slice(0, 5).map((tab) => (
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
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "12px",
                    color: "#333",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {tab.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{
        padding: "12px 16px",
        background: "white",
        borderTop: "1px solid #f0f0f0"
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          background: "#f8f9fa",
          borderRadius: "20px",
          padding: "10px 14px",
          border: "1px solid #e0e0e0",
          minHeight: "40px"
        }}>
          {/* Selected Tabs */}
          {selectedTabs.length > 0 && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              marginBottom: "6px"
            }}>
              {selectedTabs.map((tab) => (
                <div
                  key={tab.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#e8e8e8",
                    border: "1px solid #d0d0d0",
                    borderRadius: "8px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    maxWidth: "120px"
                  }}>
                  <img
                    src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e2e8f0"/></svg>'}
                    alt=""
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      flexShrink: 0
                    }}
                  />
                  <span style={{
                    color: "#333",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1
                  }}>
                    {tab.title}
                  </span>
                  <button
                    onClick={() => removeSelectedTab(tab.id!)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "0",
                      color: "#666",
                      fontSize: "12px",
                      lineHeight: 1,
                      flexShrink: 0
                    }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Ask anything..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: "13px",
                lineHeight: "1.4",
                background: "transparent",
                color: "#333",
                fontFamily: "inherit",
                minHeight: "18px",
                maxHeight: "80px"
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              style={{
                background: inputText.trim() ? "#8b5cf6" : "#e0e0e0",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                cursor: inputText.trim() ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.2s ease"
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inputText.trim() ? "white" : "#999"} strokeWidth="2">
                <path d="M22 2L11 13"/>
                <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FloatingChat 