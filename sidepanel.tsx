import { useState } from "react"

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
}

function IndexSidepanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [personalizationOn, setPersonalizationOn] = useState(false)

  const suggestedPrompts = [
    "What are three things I can do with Deer?",
    "I'm not a student, how can Deer help me?", 
    "Draft a message introducing Deer to a friend"
  ]

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
        text: "I'm Deer, your browser extension assistant! I can help you manage tabs, analyze web content, and enhance your browsing experience. What would you like to know?",
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiResponse])
    }, 1000)
  }

  const handlePromptClick = (prompt: string) => {
    setInputText(prompt)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#fafafa",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
      
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid #e0e0e0",
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L10 6H6L8 2Z" fill="#666"/>
            <path d="M2 8L6 6V10L2 8Z" fill="#666"/>
            <path d="M14 8L10 10V6L14 8Z" fill="#666"/>
            <path d="M8 14L6 10H10L8 14Z" fill="#666"/>
          </svg>
          <span style={{ fontSize: "14px", color: "#666", fontWeight: "500" }}>
            Personalization
          </span>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setPersonalizationOn(!personalizationOn)}
            style={{
              background: personalizationOn ? "#007AFF" : "#E5E5E7",
              border: "none",
              borderRadius: "12px",
              width: "44px",
              height: "24px",
              position: "relative",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}>
            <div
              style={{
                position: "absolute",
                top: "2px",
                left: personalizationOn ? "22px" : "2px",
                width: "20px",
                height: "20px",
                background: "white",
                borderRadius: "50%",
                transition: "all 0.2s ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
              }}
            />
          </button>
          <span style={{ fontSize: "14px", color: "#666" }}>
            {personalizationOn ? "On" : "Off"}
          </span>
          
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{
              background: "none",
              border: "none",
              padding: "4px",
              cursor: "pointer",
              borderRadius: "4px"
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
                <path d="M8 0L10 6H16L11 9L13 15L8 12L3 15L5 9L0 6H6L8 0Z"/>
              </svg>
            </button>
            <button style={{
              background: "none",
              border: "none",
              padding: "4px",
              cursor: "pointer",
              borderRadius: "4px"
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
                <path d="M4 6L8 2L12 6M12 10L8 14L4 10"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ 
        flex: 1, 
        display: "flex", 
        flexDirection: "column",
        overflow: "hidden"
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
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "32px",
              fontSize: "32px",
              color: "white",
              fontWeight: "600"
            }}>
              🦌
            </div>
            
            <div style={{ width: "100%", maxWidth: "300px" }}>
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptClick(prompt)}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    marginBottom: "12px",
                    background: "white",
                    border: "1px solid #e0e0e0",
                    borderRadius: "12px",
                    fontSize: "14px",
                    color: "#333",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 12
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f5f5f5"
                    e.currentTarget.style.borderColor = "#d0d0d0"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white"
                    e.currentTarget.style.borderColor = "#e0e0e0"
                  }}>
                  <div style={{ fontSize: "16px" }}>
                    {index === 0 ? "✨" : index === 1 ? "💡" : "✍️"}
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
                    background: message.isUser ? "#007AFF" : "white",
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
      </div>

      {/* Input Area */}
      <div style={{
        padding: "16px 20px 20px",
        background: "white",
        borderTop: "1px solid #e0e0e0"
      }}>
        <div style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "12px",
          background: "#f8f9fa",
          borderRadius: "24px",
          padding: "8px 16px",
          border: "1px solid #e0e0e0"
        }}>
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
              <path d="M10 2L12 8H18L13 12L15 18L10 14L5 18L7 12L2 8H8L10 2Z"/>
            </svg>
          </button>
          
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
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
          
          <div style={{ display: "flex", gap: "4px" }}>
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
                <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"/>
                <path d="M8 7L8 13M12 7V13" stroke="white" strokeWidth="2"/>
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
                <path d="M9 12L11 9L9 6M6 9H14"/>
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
                <path d="M8 2L8 14M2 8L14 8" strokeWidth="2" stroke="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndexSidepanel 