import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_end",
}

/**
 * Agent DOM Content Script
 *
 * Based on nano-browser's approach: uses WeakRef for element storage
 * to avoid memory leaks and handle stale elements gracefully.
 */

// Global element map using WeakRef (survives garbage collection gracefully)
declare global {
  interface Window {
    __deerElementMap: Record<string, WeakRef<Element>>
    __deerRefCounter: number
  }
}

// Initialize global state
if (!window.__deerElementMap) {
  window.__deerElementMap = {}
}
if (!window.__deerRefCounter) {
  window.__deerRefCounter = 0
}

// Role mapping for semantic elements
const ROLE_MAP: Record<string, string> = {
  a: "link",
  button: "button",
  select: "combobox",
  textarea: "textbox",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  img: "image",
  nav: "navigation",
  main: "main",
  header: "banner",
  footer: "contentinfo",
  section: "region",
  article: "article",
  aside: "complementary",
  form: "form",
  table: "table",
  ul: "list",
  ol: "list",
  li: "listitem",
  label: "label",
}

const INPUT_TYPE_ROLES: Record<string, string> = {
  submit: "button",
  button: "button",
  checkbox: "checkbox",
  radio: "radio",
  file: "button",
  text: "textbox",
  email: "textbox",
  password: "textbox",
  search: "searchbox",
  tel: "textbox",
  url: "textbox",
  number: "spinbutton",
  range: "slider",
}

const INTERACTIVE_TAGS = ["a", "button", "input", "select", "textarea", "details", "summary"]
const INTERACTIVE_ROLES = ["button", "link", "checkbox", "radio", "textbox", "combobox", "listbox", "menu", "menuitem", "option", "tab", "switch", "slider"]
const SKIP_TAGS = ["script", "style", "meta", "link", "title", "noscript"]
const SEMANTIC_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6", "nav", "main", "header", "footer", "section", "article", "aside"]

// Injection defense patterns - filter these from DOM content to prevent prompt injection
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi,
  /forget\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi,
  /system\s*:\s*(new\s+)?instructions?/gi,
  /admin(istrator)?\s+(override|mode|access)/gi,
  /you\s+are\s+now\s+(a|an|in)/gi,
  /new\s+system\s+prompt/gi,
  /override\s+safety/gi,
  /bypass\s+(security|restrictions?|rules?)/gi,
  /developer\s+mode\s+(enabled?|activate)/gi,
  /as\s+an?\s+AI\s+(you\s+must|assistant)/gi,
  /jailbreak/gi,
  /DAN\s+mode/gi,
  /pretend\s+(you('re|\s+are)\s+)?(a|an|not)/gi,
]

/**
 * Sanitize text content to remove potential prompt injection attempts.
 * Replaces suspicious patterns with [FILTERED] marker.
 */
function sanitizeTextContent(text: string): string {
  if (!text) return text

  let sanitized = text
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[FILTERED]")
  }

  return sanitized
}

function getRole(element: Element): string {
  const role = element.getAttribute("role")
  if (role) return role

  const tag = element.tagName.toLowerCase()
  const type = element.getAttribute("type")

  if (tag === "input") {
    return INPUT_TYPE_ROLES[type || "text"] || "textbox"
  }

  return ROLE_MAP[tag] || "generic"
}

function getCleanName(element: Element): string {
  const tag = element.tagName.toLowerCase()

  // Helper to sanitize and return text
  const sanitize = (text: string | null | undefined): string => {
    if (!text?.trim()) return ""
    return sanitizeTextContent(text.trim())
  }

  // For selects, get the selected option text
  if (tag === "select") {
    const selectEl = element as HTMLSelectElement
    const selectedOption = selectEl.querySelector("option[selected]") || selectEl.options[selectEl.selectedIndex]
    const optText = sanitize(selectedOption?.textContent)
    if (optText) return optText
  }

  // Priority order for names
  const ariaLabel = sanitize(element.getAttribute("aria-label"))
  if (ariaLabel) return ariaLabel

  const placeholder = sanitize(element.getAttribute("placeholder"))
  if (placeholder) return placeholder

  const title = sanitize(element.getAttribute("title"))
  if (title) return title

  const alt = sanitize(element.getAttribute("alt"))
  if (alt) return alt

  // For form labels
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`)
    const labelText = sanitize(label?.textContent)
    if (labelText) return labelText
  }

  // For inputs with values
  if (tag === "input") {
    const inputEl = element as HTMLInputElement
    const type = element.getAttribute("type") || ""
    const value = sanitize(element.getAttribute("value"))

    if (type === "submit" && value) {
      return value
    }

    const inputValue = sanitize(inputEl.value)
    if (inputValue && inputValue.length < 50) {
      return inputValue
    }
  }

  // For buttons, links - get direct text
  if (["button", "a", "summary"].includes(tag)) {
    let directText = ""
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        directText += node.textContent || ""
      }
    }
    const sanitized = sanitize(directText)
    if (sanitized) return sanitized
  }

  // For headings
  if (/^h[1-6]$/.test(tag)) {
    const text = sanitize(element.textContent)
    if (text) {
      return text.substring(0, 100)
    }
  }

  // For images without alt
  if (tag === "img") {
    const src = element.getAttribute("src")
    if (src) {
      const filename = src.split("/").pop()?.split("?")[0]
      return `Image: ${filename}`
    }
  }

  // Get direct text content for generic elements
  let directText = ""
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      directText += node.textContent || ""
    }
  }
  const sanitizedDirect = sanitize(directText)
  if (sanitizedDirect && sanitizedDirect.length >= 3) {
    return sanitizedDirect.length > 50 ? sanitizedDirect.substring(0, 50) + "..." : sanitizedDirect
  }

  return ""
}

function isVisible(element: Element): boolean {
  const style = window.getComputedStyle(element)
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false
  }
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function isInteractive(element: Element): boolean {
  const tag = element.tagName.toLowerCase()
  if (INTERACTIVE_TAGS.includes(tag)) return true

  const role = element.getAttribute("role")
  if (role && INTERACTIVE_ROLES.includes(role)) return true

  if (element.hasAttribute("onclick") || element.hasAttribute("tabindex")) return true
  if (element.getAttribute("contenteditable") === "true") return true

  return false
}

function isSemantic(element: Element): boolean {
  const tag = element.tagName.toLowerCase()
  return SEMANTIC_TAGS.includes(tag) || element.getAttribute("role") !== null
}

function isInViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect()
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  )
}

function shouldIncludeElement(element: Element, filterType?: string): boolean {
  const tag = element.tagName.toLowerCase()

  // Always skip these
  if (SKIP_TAGS.includes(tag)) return false
  if (element.getAttribute("aria-hidden") === "true") return false

  // Visibility check
  if (!isVisible(element)) return false

  // Viewport check (unless filter is "all")
  if (filterType !== "all" && !isInViewport(element)) return false

  // Interactive filter
  if (filterType === "interactive") {
    return isInteractive(element)
  }

  // Default: include interactive, semantic, or named elements
  if (isInteractive(element)) return true
  if (isSemantic(element)) return true
  if (getCleanName(element).length > 0) return true

  return false
}

interface GenerateTreeOptions {
  filter?: string
}

function generateAccessibilityTree(filterType?: string): { pageContent: string; elementCount: number; viewport: { width: number; height: number } } {
  const result: string[] = []
  const options: GenerateTreeOptions = { filter: filterType }

  function processElement(element: Element, depth: number): void {
    if (depth > 15) return // Depth limit
    if (!element?.tagName) return

    const shouldInclude = shouldIncludeElement(element, options.filter) || depth === 0

    if (shouldInclude) {
      const role = getRole(element)
      const name = getCleanName(element)

      // Check if this element already has a ref
      let ref: string | null = null
      for (const existingRef in window.__deerElementMap) {
        const weakRef = window.__deerElementMap[existingRef]
        const existingElement = weakRef.deref()
        if (existingElement === element) {
          ref = existingRef
          break
        }
      }

      // Create new ref if needed
      if (!ref) {
        ref = `ref_${++window.__deerRefCounter}`
        window.__deerElementMap[ref] = new WeakRef(element)
      }

      const indent = "  ".repeat(depth)
      let yaml = `${indent}- ${role}`

      if (name) {
        const cleanName = name.replace(/\s+/g, " ").substring(0, 100)
        yaml += ` "${cleanName.replace(/"/g, '\\"')}"`
      }

      yaml += ` [ref=${ref}]`

      // Add useful attributes
      if (element.id) yaml += ` id="${element.id}"`
      const href = element.getAttribute("href")
      if (href) yaml += ` href="${href}"`
      const type = element.getAttribute("type")
      if (type) yaml += ` type="${type}"`
      const placeholder = element.getAttribute("placeholder")
      if (placeholder) yaml += ` placeholder="${placeholder}"`

      result.push(yaml)
    }

    // Traverse children
    if (depth < 15) {
      for (const child of element.children) {
        processElement(child, shouldInclude ? depth + 1 : depth)
      }
    }
  }

  if (document.body) {
    processElement(document.body, 0)
  }

  // Clean up stale references
  for (const ref in window.__deerElementMap) {
    const weakRef = window.__deerElementMap[ref]
    if (!weakRef.deref()) {
      delete window.__deerElementMap[ref]
    }
  }

  // Filter out empty generic elements
  const filteredResult = result.filter((line) => !/^\s*- generic \[ref=ref_\d+\]$/.test(line))

  return {
    pageContent: filteredResult.join("\n"),
    elementCount: Object.keys(window.__deerElementMap).length,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  }
}

function getElementByRef(ref: string): Element | null {
  const weakRef = window.__deerElementMap[ref]
  if (!weakRef) return null

  const element = weakRef.deref()
  if (!element || !document.contains(element)) {
    delete window.__deerElementMap[ref]
    return null
  }

  return element
}

interface ActionResult {
  success: boolean
  error?: string
  message?: string
  ref?: string
  coordinates?: [number, number]
  elementInfo?: string
  rect?: { left: number; top: number; right: number; bottom: number; width: number; height: number }
}

function getElementInfo(ref: string): ActionResult {
  const element = getElementByRef(ref)
  if (!element) {
    return {
      success: false,
      error: `No element found with reference: "${ref}". The element may have been removed from the page.`,
    }
  }

  // Scroll element into view
  element.scrollIntoView({ behavior: "instant", block: "center", inline: "center" })

  // Force layout
  ;(element as HTMLElement).offsetHeight

  // Get coordinates
  const rect = element.getBoundingClientRect()
  const clickX = rect.left + rect.width / 2
  const clickY = rect.top + rect.height / 2

  // Build element info
  const elementInfo = element.tagName.toLowerCase() +
    (element.id ? `#${element.id}` : "") +
    (element.className ? `.${element.className.toString().split(" ").filter(Boolean).join(".")}` : "")

  return {
    success: true,
    coordinates: [clickX, clickY],
    elementInfo,
    ref,
    rect: {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    },
  }
}

function clickElement(ref: string): ActionResult {
  const element = getElementByRef(ref) as HTMLElement
  if (!element) {
    return {
      success: false,
      error: `No element found with reference: "${ref}". The element may have been removed from the page.`,
    }
  }

  // Scroll into view first
  element.scrollIntoView({ behavior: "smooth", block: "center" })

  // Highlight briefly
  const originalOutline = element.style.outline
  const originalOutlineOffset = element.style.outlineOffset
  element.style.outline = "3px solid #3b82f6"
  element.style.outlineOffset = "2px"
  setTimeout(() => {
    element.style.outline = originalOutline
    element.style.outlineOffset = originalOutlineOffset
  }, 1000)

  // Click
  element.click()

  return { success: true, message: `Clicked element ${ref}`, ref }
}

function formInput(ref: string, value: string | number | boolean): ActionResult {
  const element = getElementByRef(ref) as HTMLElement
  if (!element) {
    return {
      success: false,
      error: `No element found with reference: "${ref}". The element may have been removed from the page.`,
    }
  }

  // Scroll into view
  element.scrollIntoView({ behavior: "smooth", block: "center" })

  // Handle different element types
  if (element instanceof HTMLSelectElement) {
    const options = Array.from(element.options)
    const valueStr = String(value)

    let optionFound = false
    for (let i = 0; i < options.length; i++) {
      if (options[i].value === valueStr || options[i].text === valueStr) {
        element.selectedIndex = i
        optionFound = true
        break
      }
    }

    if (!optionFound) {
      return {
        success: false,
        error: `Option "${valueStr}" not found. Available: ${options.map((o) => `"${o.text}"`).join(", ")}`,
      }
    }

    element.focus()
    element.dispatchEvent(new Event("change", { bubbles: true }))
    element.dispatchEvent(new Event("input", { bubbles: true }))
    return { success: true, message: `Selected option "${valueStr}"`, ref }
  }

  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    element.checked = Boolean(value)
    element.focus()
    element.dispatchEvent(new Event("change", { bubbles: true }))
    element.dispatchEvent(new Event("input", { bubbles: true }))
    return { success: true, message: `Checkbox ${element.checked ? "checked" : "unchecked"}`, ref }
  }

  if (element instanceof HTMLInputElement && element.type === "radio") {
    element.checked = true
    element.focus()
    element.dispatchEvent(new Event("change", { bubbles: true }))
    element.dispatchEvent(new Event("input", { bubbles: true }))
    return { success: true, message: "Radio button selected", ref }
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = String(value)
    element.focus()
    element.setSelectionRange?.(element.value.length, element.value.length)
    element.dispatchEvent(new Event("change", { bubbles: true }))
    element.dispatchEvent(new Event("input", { bubbles: true }))
    return { success: true, message: `Set value to "${String(value).substring(0, 50)}"`, ref }
  }

  return {
    success: false,
    error: `Element type "${element.tagName}" is not a supported form input`,
  }
}

function scrollToElement(ref: string): ActionResult {
  const element = getElementByRef(ref)
  if (!element) {
    return {
      success: false,
      error: `No element found with reference: "${ref}". The element may have been removed from the page.`,
    }
  }

  element.scrollIntoView({ behavior: "smooth", block: "center" })
  return { success: true, message: `Scrolled to element ${ref}`, ref }
}

interface GetTextResult {
  success: boolean
  text?: string
  url?: string
  title?: string
  truncated?: boolean
  error?: string
}

function getPageTextContent(selector?: string, maxLength = 10000): GetTextResult {
  try {
    const root = selector ? document.querySelector(selector) : document.body
    if (!root) {
      return {
        success: false,
        error: selector ? `No element found matching selector: "${selector}"` : "No document body found",
      }
    }

    // Use TreeWalker to extract only visible text nodes
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT

        // Skip hidden elements
        const style = window.getComputedStyle(parent)
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          return NodeFilter.FILTER_REJECT
        }

        // Skip script, style, and other non-content tags
        const tag = parent.tagName.toLowerCase()
        if (["script", "style", "noscript", "template", "svg", "path"].includes(tag)) {
          return NodeFilter.FILTER_REJECT
        }

        // Skip aria-hidden elements
        if (parent.getAttribute("aria-hidden") === "true") {
          return NodeFilter.FILTER_REJECT
        }

        return NodeFilter.FILTER_ACCEPT
      },
    })

    const textParts: string[] = []
    let totalLength = 0
    let truncated = false
    let node: Node | null

    while ((node = walker.nextNode())) {
      const content = node.textContent?.trim()
      if (content && content.length > 0) {
        // Check if adding this would exceed maxLength
        if (totalLength + content.length > maxLength) {
          // Add partial content up to the limit
          const remaining = maxLength - totalLength
          if (remaining > 0) {
            textParts.push(content.substring(0, remaining))
          }
          truncated = true
          break
        }

        textParts.push(content)
        totalLength += content.length + 1 // +1 for the space we'll add between parts
      }
    }

    // Join with spaces, clean up multiple whitespace, and sanitize for injection
    const rawText = textParts.join(" ").replace(/\s+/g, " ").trim()
    const text = sanitizeTextContent(rawText)

    return {
      success: true,
      text,
      url: window.location.href,
      title: sanitizeTextContent(document.title),
      truncated,
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to extract text: ${String(error)}`,
    }
  }
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DEER_DOM") {
    try {
      switch (message.action) {
        case "serialize":
          const tree = generateAccessibilityTree(message.filter)
          sendResponse({ success: true, ...tree })
          break

        case "getElement":
          const elementInfo = getElementInfo(message.ref)
          sendResponse(elementInfo)
          break

        case "click":
          const clickResult = clickElement(message.ref)
          sendResponse(clickResult)
          break

        case "formInput":
          const inputResult = formInput(message.ref, message.value)
          sendResponse(inputResult)
          break

        case "scroll":
          const scrollResult = scrollToElement(message.ref)
          sendResponse(scrollResult)
          break

        case "getText":
          const textResult = getPageTextContent(message.selector, message.maxLength)
          sendResponse(textResult)
          break

        default:
          sendResponse({ success: false, error: "Unknown action" })
      }
    } catch (error) {
      sendResponse({ success: false, error: String(error) })
    }
  }
  return true
})

// Export functions for direct use (e.g., via chrome.scripting.executeScript)
export { generateAccessibilityTree, getElementByRef, clickElement, formInput, scrollToElement, getPageTextContent }
