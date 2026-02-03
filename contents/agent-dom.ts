import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_end",
}

/**
 * Agent DOM Content Script
 *
 * Runs in page context to serialize DOM and execute actions.
 * Communicates with the extension via chrome.runtime messaging.
 */

interface SerializedElement {
  id: string
  role: string
  name: string
  tagName: string
  isInteractive: boolean
  rect: { x: number; y: number; width: number; height: number }
  children: SerializedElement[]
}

// WeakMap to store element references by ID
const elementMap = new Map<string, Element>()
let nextElementId = 1

function resetElementIds(): void {
  elementMap.clear()
  nextElementId = 1
}

function getElementId(element: Element): string {
  // Check if we already have an ID for this element
  for (const [id, el] of elementMap.entries()) {
    if (el === element) return id
  }
  // Assign new ID
  const id = String(nextElementId++)
  elementMap.set(id, element)
  return id
}

function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element)
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false
  }
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return false
  }
  return true
}

function isInteractiveElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase()
  const interactiveTags = ["a", "button", "input", "select", "textarea", "details", "summary"]
  if (interactiveTags.includes(tagName)) return true

  const role = element.getAttribute("role")
  const interactiveRoles = [
    "button",
    "link",
    "checkbox",
    "radio",
    "textbox",
    "combobox",
    "listbox",
    "menu",
    "menuitem",
    "option",
    "tab",
    "switch",
    "slider",
  ]
  if (role && interactiveRoles.includes(role)) return true

  if (element.hasAttribute("onclick") || element.hasAttribute("tabindex")) return true
  if (element.getAttribute("contenteditable") === "true") return true

  return false
}

function getElementRole(element: Element): string {
  const explicitRole = element.getAttribute("role")
  if (explicitRole) return explicitRole

  const tagName = element.tagName.toLowerCase()
  const tagRoleMap: Record<string, string> = {
    a: "link",
    button: "button",
    input: getInputRole(element as HTMLInputElement),
    select: "combobox",
    textarea: "textbox",
    img: "img",
    nav: "navigation",
    main: "main",
    header: "banner",
    footer: "contentinfo",
    aside: "complementary",
    article: "article",
    section: "region",
    form: "form",
    table: "table",
    ul: "list",
    ol: "list",
    li: "listitem",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    h5: "heading",
    h6: "heading",
    dialog: "dialog",
  }
  return tagRoleMap[tagName] || tagName
}

function getInputRole(input: HTMLInputElement): string {
  const type = input.type?.toLowerCase() || "text"
  const typeRoleMap: Record<string, string> = {
    text: "textbox",
    email: "textbox",
    password: "textbox",
    search: "searchbox",
    tel: "textbox",
    url: "textbox",
    number: "spinbutton",
    range: "slider",
    checkbox: "checkbox",
    radio: "radio",
    button: "button",
    submit: "button",
    reset: "button",
  }
  return typeRoleMap[type] || "textbox"
}

function getElementName(element: Element): string {
  // aria-label
  const ariaLabel = element.getAttribute("aria-label")
  if (ariaLabel?.trim()) return ariaLabel.trim()

  // aria-labelledby
  const labelledBy = element.getAttribute("aria-labelledby")
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy)
    if (labelElement?.textContent?.trim()) return labelElement.textContent.trim()
  }

  // Input label
  if (element.tagName.toLowerCase() === "input") {
    const input = element as HTMLInputElement
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`)
      if (label?.textContent?.trim()) return label.textContent.trim()
    }
    if (input.placeholder?.trim()) return input.placeholder.trim()
  }

  // Title
  const title = element.getAttribute("title")
  if (title?.trim()) return title.trim()

  // Alt for images
  if (element.tagName.toLowerCase() === "img") {
    const alt = element.getAttribute("alt")
    if (alt?.trim()) return alt.trim()
  }

  // Text content for interactive elements
  if (isInteractiveElement(element)) {
    const text = getDirectTextContent(element)
    if (text) return text.slice(0, 100)
  }

  return ""
}

function getDirectTextContent(element: Element): string {
  let text = ""
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ""
    }
  }
  return text.replace(/\s+/g, " ").trim()
}

function serializeElement(element: Element, depth: number = 0): SerializedElement | null {
  if (!isElementVisible(element)) return null

  const skipTags = ["script", "style", "noscript", "template", "svg", "path", "meta", "link"]
  if (skipTags.includes(element.tagName.toLowerCase())) return null

  const id = getElementId(element)
  const role = getElementRole(element)
  const name = getElementName(element)
  const rect = element.getBoundingClientRect()
  const isInteractive = isInteractiveElement(element)

  // Serialize children
  const children: SerializedElement[] = []
  for (const child of element.children) {
    const serialized = serializeElement(child, depth + 1)
    if (serialized) children.push(serialized)
  }

  // Skip non-interactive, nameless elements with no children
  const hasInteractiveChild = children.some(
    (c) => c.isInteractive || c.children.some((gc) => gc.isInteractive)
  )
  if (!isInteractive && !name && !hasInteractiveChild && children.length === 0) {
    return null
  }

  return {
    id,
    role,
    name,
    tagName: element.tagName.toLowerCase(),
    isInteractive,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    children,
  }
}

function formatTreeAsText(element: SerializedElement, indent: number = 0): string {
  const prefix = "  ".repeat(indent)
  const label = element.name ? `${element.role}: ${element.name}` : element.role
  let line = `${prefix}[${element.id}] ${label}`

  const childLines = element.children.map((c) => formatTreeAsText(c, indent + 1))
  if (childLines.length > 0) {
    return `${line}\n${childLines.join("\n")}`
  }
  return line
}

function serializeDOM(): { tree: string; elementCount: number } {
  resetElementIds()
  const root = serializeElement(document.body)
  if (!root) {
    return { tree: "", elementCount: 0 }
  }
  return {
    tree: formatTreeAsText(root),
    elementCount: elementMap.size,
  }
}

function executeAction(
  elementId: string,
  action: "click" | "type" | "focus" | "scroll" | "clear",
  args?: { text?: string; clear?: boolean }
): { success: boolean; error?: string } {
  const element = elementMap.get(elementId)
  if (!element) {
    return { success: false, error: `Element with ID ${elementId} not found` }
  }

  try {
    const htmlElement = element as HTMLElement

    switch (action) {
      case "click":
        htmlElement.click()
        break

      case "type":
        if (args?.text !== undefined) {
          const input = element as HTMLInputElement | HTMLTextAreaElement
          input.focus()
          if (args.clear) {
            input.value = ""
          }
          input.value += args.text
          input.dispatchEvent(new Event("input", { bubbles: true }))
          input.dispatchEvent(new Event("change", { bubbles: true }))
        }
        break

      case "focus":
        htmlElement.focus()
        break

      case "scroll":
        element.scrollIntoView({ behavior: "smooth", block: "center" })
        break

      case "clear":
        const inputEl = element as HTMLInputElement | HTMLTextAreaElement
        inputEl.value = ""
        inputEl.dispatchEvent(new Event("input", { bubbles: true }))
        inputEl.dispatchEvent(new Event("change", { bubbles: true }))
        break
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

function highlightElement(elementId: string, color: string = "#3b82f6"): { success: boolean } {
  const element = elementMap.get(elementId)
  if (!element) return { success: false }

  const htmlElement = element as HTMLElement
  const originalOutline = htmlElement.style.outline
  const originalOutlineOffset = htmlElement.style.outlineOffset

  htmlElement.style.outline = `3px solid ${color}`
  htmlElement.style.outlineOffset = "2px"

  setTimeout(() => {
    htmlElement.style.outline = originalOutline
    htmlElement.style.outlineOffset = originalOutlineOffset
  }, 2000)

  return { success: true }
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DEER_DOM") {
    switch (message.action) {
      case "serialize":
        const snapshot = serializeDOM()
        sendResponse(snapshot)
        break

      case "execute":
        const result = executeAction(message.elementId, message.method, message.args)
        sendResponse(result)
        break

      case "highlight":
        const highlightResult = highlightElement(message.elementId, message.color)
        sendResponse(highlightResult)
        break

      case "getElement":
        const el = elementMap.get(message.elementId)
        sendResponse({ found: !!el, tagName: el?.tagName?.toLowerCase() })
        break

      default:
        sendResponse({ error: "Unknown action" })
    }
  }
  return true
})

// Export for potential direct use
export { serializeDOM, executeAction, highlightElement }
