import { useState } from "react"

function IndexSidepanel() {
  const [data, setData] = useState("")

  return (
    <div
      style={{
        padding: 24,
        minHeight: "100vh",
        background: "#f8fafc"
      }}>
      <h2
        style={{
          marginBottom: 16,
          color: "#1e293b",
          fontSize: "1.5rem"
        }}>
        Welcome to your{" "}
        <a 
          href="https://www.plasmo.com" 
          target="_blank"
          style={{
            color: "#3b82f6",
            textDecoration: "none"
          }}>
          Plasmo
        </a>{" "}
        Extension!
      </h2>
      <div style={{ marginBottom: 16 }}>
        <input 
          onChange={(e) => setData(e.target.value)} 
          value={data}
          style={{
            width: "100%",
            padding: 12,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: "14px"
          }}
          placeholder="Enter some data..."
        />
      </div>
      <a 
        href="https://docs.plasmo.com" 
        target="_blank"
        style={{
          display: "inline-block",
          padding: "10px 16px",
          background: "#3b82f6",
          color: "white",
          textDecoration: "none",
          borderRadius: 6,
          fontSize: "14px"
        }}>
        View Docs
      </a>
    </div>
  )
}

export default IndexSidepanel 