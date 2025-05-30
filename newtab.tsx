import { useState, useEffect, useRef } from "react"
import { CiSearch } from "react-icons/ci"
import { FaRegMessage } from "react-icons/fa6"

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
          : "Of course! What topic or subject would you like to be quizzed on? It could be anything—history, science, pop culture, geography, sports, or something else. Let me know your preference, and I'll create a quiz for you!",
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiResponse])
    }, 1000)

    setInputText("")
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputText(value)
    
    // Auto-resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = '20px'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }

    // Check for @ symbol - exactly like sidepanel
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
    
    // Replace @ with tab reference in input - exactly like sidepanel
    const beforeAt = inputText.substring(0, dropdownPosition)
    const afterAt = inputText.substring(dropdownPosition + 1)
    setInputText(beforeAt + `@${tab.title} ` + afterAt)
  }

  const removeSelectedTab = (tabId: number) => {
    const tabToRemove = selectedTabs.find(tab => tab.id === tabId)
    setSelectedTabs(prev => prev.filter(tab => tab.id !== tabId))
    
    // Also remove tab references from input text - exactly like sidepanel
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
    // Here you would normally process the voice input
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

  // Wave Animation Component
  const WaveAnimation = () => (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "3px",
      height: "30px"
    }}>
      {[...Array(15)].map((_, i) => (
        <div
          key={i}
          style={{
            width: "2px",
            backgroundColor: "#9ca3af",
            borderRadius: "1px",
            animation: `wave 1.5s ease-in-out infinite`,
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
      `}</style>
    </div>
  )

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8f9fa",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: "flex",
      flexDirection: "column"
    }}>
      
      {messages.length === 0 ? (
        // Welcome screen with main input component
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          maxWidth: "600px",
          margin: "0 auto",
          width: "100%"
        }}>
          
          {/* Main input component */}
          <div style={{
            width: "100%",
            position: "relative",
            background: "white",
            borderRadius: "24px",
            border: "1px solid #e1e5e9",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            overflow: "hidden"
          }}>
            
            {/* Input area */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "16px 20px"
            }}>
              {/* Selected Tabs */}
              {selectedTabs.length > 0 && (
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "8px"
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
                        maxWidth: "200px"
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
                alignItems: "center",
                gap: 12
              }}>
                <CiSearch size={20} style={{ color: "#9ca3af", flexShrink: 0 }} />
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Search, ask, or @-mention a tab"
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    resize: "none",
                    fontSize: "16px",
                    lineHeight: "1.4",
                    background: "transparent",
                    color: "#374151",
                    fontFamily: "inherit",
                    minHeight: "20px",
                    maxHeight: "120px"
                  }}
                />
              </div>
            </div>

            {/* Listening interface */}
            {isListening && (
              <div style={{
                padding: "24px 20px",
                textAlign: "center",
                borderTop: "1px solid #f1f5f9"
              }}>
                <div style={{
                  fontSize: "14px",
                  color: "#6b7280",
                  marginBottom: "16px",
                  fontWeight: "400"
                }}>
                  Listening...
                </div>
                
                <WaveAnimation />
                
                <div style={{
                  fontSize: "18px",
                  color: "#374151",
                  marginTop: "16px",
                  marginBottom: "20px",
                  fontWeight: "300",
                  letterSpacing: "1px"
                }}>
                  {formatTime(listeningTime)}
                </div>

                <div style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "16px"
                }}>
                  <button
                    onClick={stopListening}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "#ef4444",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)"
                    }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M18 6L6 18"/>
                      <path d="M6 6l12 12"/>
                    </svg>
                  </button>

                  <button
                    onClick={submitListening}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "#10b981",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)"
                    }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Suggested prompts */}
            {!isListening && (
              <div style={{
                padding: "20px",
                borderTop: "1px solid #f1f5f9"
              }}>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handlePromptClick(prompt)}
                      style={{
                        padding: "12px 16px",
                        background: "transparent",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: "#374151",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: 8
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#f5f5f5"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent"
                      }}>
                      <FaRegMessage size={14} style={{ color: "#9ca3af" }} />
                      {prompt}
                    </button>
                  ))}
                </div>
                
                {/* Add tabs or files */}
                <button
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#6b7280",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginTop: "16px"
                  }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14"/>
                      <path d="M5 12h14"/>
                    </svg>
                    Add tabs or files
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Tab dropdown */}
            {showTabDropdown && (
              <div style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "white",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                maxHeight: "200px",
                overflowY: "auto",
                zIndex: 1000,
                marginTop: "4px"
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
        </div>
      ) : (
        // Chat interface
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: "800px",
          margin: "0 auto",
          width: "100%",
          padding: "40px 20px",
          position: "relative"
        }}>
          
          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            paddingBottom: "20px"
          }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent: message.isUser ? "flex-end" : "flex-start",
                  marginBottom: "16px"
                }}>
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "12px 18px",
                    borderRadius: "20px",
                    background: message.isUser ? "#8b5cf6" : "#f1f3f4",
                    color: message.isUser ? "white" : "#374151",
                    fontSize: "14px",
                    lineHeight: "1.5"
                  }}>
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          {/* Selected Tabs in chat interface */}
          {selectedTabs.length > 0 && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: "12px"
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
                    maxWidth: "200px"
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

          {/* Input area */}
          <div style={{
            background: "white",
            borderRadius: "24px",
            border: "1px solid #e1e5e9",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            position: "relative"
          }}>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Ask another question..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: "14px",
                lineHeight: "1.4",
                background: "transparent",
                color: "#374151",
                fontFamily: "inherit",
                minHeight: "20px",
                maxHeight: "100px"
              }}
            />
            <button
              onClick={startListening}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "8px"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f5f5f5"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
              }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
            <button
              onClick={handleSendMessage}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <path d="M22 2L11 13"/>
                <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>

            {/* Tab dropdown for chat interface */}
            {showTabDropdown && (
              <div style={{
                position: "absolute",
                bottom: "100%",
                left: 0,
                right: 0,
                background: "white",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                maxHeight: "200px",
                overflowY: "auto",
                zIndex: 1000,
                marginBottom: "4px"
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
        </div>
      )}
    </div>
  )
}

export default NewTabPage 