/**
 * DOM Serializer for Deer Agent
 *
 * Converts the DOM into an LLM-friendly accessibility tree format.
 * Inspired by Stagehand's approach but runs entirely client-side.
 *
 * Output format:
 * [id] role: name
 *   [id] role: name
 *
 * Example:
 * [1] button: Submit Order
 *   [2] StaticText: Submit Order
 * [3] textbox: Enter your email
 * [4] link: Learn more
 */

export interface SerializedElement {
  id: string
  role: string
  name: string
  tagName: string
  isInteractive: boolean
  isVisible: boolean
  rect: { x: number; y: number; width: number; height: number }
  children: SerializedElement[]
}

export interface DOMSnapshot {
  /** The text representation of the DOM tree for LLM consumption */
  tree: string
  /** Map from element ID to the actual DOM element */
  elementMap: Map<string, Element>
  /** Total number of elements serialized */
  elementCount: number
}

// WeakMap to store element IDs without modifying DOM
const elementIdMap = new WeakMap<Element, string>()
let nextElementId = 1

/**
 * Get or create a stable ID for an element
 */
function getElementId(element: Element): string {
  let id = elementIdMap.get(element)
  if (!id) {
    id = String(nextElementId++)
    elementIdMap.set(element, id)
  }
  return id
}

/**
 * Reset element IDs (call between serializations if needed)
 */
export function resetElementIds(): void {
  nextElementId = 1
}

/**
 * Check if an element is visible in the viewport
 */
function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false
  }

  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return false
  }

  return true
}

/**
 * Check if an element is interactive (clickable, typeable, etc.)
 */
function isInteractiveElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase()
  const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'details', 'summary']

  if (interactiveTags.includes(tagName)) {
    return true
  }

  // Check for role attribute
  const role = element.getAttribute('role')
  const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'textbox', 'combobox', 'listbox', 'menu', 'menuitem', 'option', 'tab', 'switch', 'slider']
  if (role && interactiveRoles.includes(role)) {
    return true
  }

  // Check for click handlers or tabindex
  if (element.hasAttribute('onclick') || element.hasAttribute('tabindex')) {
    return true
  }

  // Check for contenteditable
  if (element.getAttribute('contenteditable') === 'true') {
    return true
  }

  return false
}

/**
 * Get the accessible role for an element
 */
function getElementRole(element: Element): string {
  // Check explicit role first
  const explicitRole = element.getAttribute('role')
  if (explicitRole) {
    return explicitRole
  }

  // Map tag names to implicit roles
  const tagName = element.tagName.toLowerCase()
  const tagRoleMap: Record<string, string> = {
    a: 'link',
    button: 'button',
    input: getInputRole(element as HTMLInputElement),
    select: 'combobox',
    textarea: 'textbox',
    img: 'img',
    nav: 'navigation',
    main: 'main',
    header: 'banner',
    footer: 'contentinfo',
    aside: 'complementary',
    article: 'article',
    section: 'region',
    form: 'form',
    table: 'table',
    tr: 'row',
    th: 'columnheader',
    td: 'cell',
    ul: 'list',
    ol: 'list',
    li: 'listitem',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
    dialog: 'dialog',
    details: 'group',
    summary: 'button',
  }

  return tagRoleMap[tagName] || tagName
}

/**
 * Get the role for an input element based on its type
 */
function getInputRole(input: HTMLInputElement): string {
  const type = input.type?.toLowerCase() || 'text'
  const typeRoleMap: Record<string, string> = {
    text: 'textbox',
    email: 'textbox',
    password: 'textbox',
    search: 'searchbox',
    tel: 'textbox',
    url: 'textbox',
    number: 'spinbutton',
    range: 'slider',
    checkbox: 'checkbox',
    radio: 'radio',
    button: 'button',
    submit: 'button',
    reset: 'button',
    file: 'button',
    image: 'button',
  }
  return typeRoleMap[type] || 'textbox'
}

/**
 * Get the accessible name for an element
 */
function getElementName(element: Element): string {
  // Check aria-label first
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel?.trim()) {
    return ariaLabel.trim()
  }

  // Check aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy)
    if (labelElement?.textContent?.trim()) {
      return labelElement.textContent.trim()
    }
  }

  // For inputs, check associated label
  if (element.tagName.toLowerCase() === 'input') {
    const input = element as HTMLInputElement
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`)
      if (label?.textContent?.trim()) {
        return label.textContent.trim()
      }
    }
    // Check placeholder
    if (input.placeholder?.trim()) {
      return input.placeholder.trim()
    }
  }

  // Check title attribute
  const title = element.getAttribute('title')
  if (title?.trim()) {
    return title.trim()
  }

  // Check alt for images
  if (element.tagName.toLowerCase() === 'img') {
    const alt = element.getAttribute('alt')
    if (alt?.trim()) {
      return alt.trim()
    }
  }

  // Get text content for interactive elements
  if (isInteractiveElement(element)) {
    const textContent = getDirectTextContent(element)
    if (textContent.trim()) {
      return textContent.trim().slice(0, 100) // Limit length
    }
  }

  // For links with href, use href as fallback
  if (element.tagName.toLowerCase() === 'a') {
    const href = element.getAttribute('href')
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      return href.slice(0, 50)
    }
  }

  return ''
}

/**
 * Get direct text content (not from children elements)
 */
function getDirectTextContent(element: Element): string {
  let text = ''
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    }
  }
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Serialize a DOM element to our format
 */
function serializeElement(element: Element, depth: number = 0): SerializedElement | null {
  // Skip non-visible elements
  if (!isElementVisible(element)) {
    return null
  }

  // Skip script, style, and other non-content elements
  const skipTags = ['script', 'style', 'noscript', 'template', 'svg', 'path']
  if (skipTags.includes(element.tagName.toLowerCase())) {
    return null
  }

  const id = getElementId(element)
  const role = getElementRole(element)
  const name = getElementName(element)
  const rect = element.getBoundingClientRect()
  const isInteractive = isInteractiveElement(element)

  // Recursively serialize children
  const children: SerializedElement[] = []
  for (const child of element.children) {
    const serialized = serializeElement(child, depth + 1)
    if (serialized) {
      children.push(serialized)
    }
  }

  // Skip non-interactive elements with no name and no interactive children
  const hasInteractiveDescendant = children.some(c => c.isInteractive || c.children.some(gc => gc.isInteractive))
  if (!isInteractive && !name && !hasInteractiveDescendant && children.length === 0) {
    return null
  }

  return {
    id,
    role,
    name,
    tagName: element.tagName.toLowerCase(),
    isInteractive,
    isVisible: true,
    rect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    children,
  }
}

/**
 * Format a serialized element tree as text
 */
function formatTreeAsText(element: SerializedElement, indent: number = 0): string {
  const prefix = '  '.repeat(indent)
  const label = element.name ? `${element.role}: ${element.name}` : element.role
  let line = `${prefix}[${element.id}] ${label}`

  const childLines = element.children.map(child => formatTreeAsText(child, indent + 1))

  if (childLines.length > 0) {
    return `${line}\n${childLines.join('\n')}`
  }

  return line
}

/**
 * Build element map from serialized tree
 */
function buildElementMap(element: SerializedElement, map: Map<string, Element>, doc: Document): void {
  // Find the element by iterating (since we use WeakMap, we need to find it)
  const allElements = doc.querySelectorAll('*')
  for (const el of allElements) {
    const id = elementIdMap.get(el)
    if (id) {
      map.set(id, el)
    }
  }
}

/**
 * Serialize the entire document DOM into an LLM-friendly format
 */
export function serializeDOM(doc: Document = document): DOMSnapshot {
  // Reset IDs for fresh serialization
  resetElementIds()

  const root = serializeElement(doc.body)
  if (!root) {
    return {
      tree: '',
      elementMap: new Map(),
      elementCount: 0,
    }
  }

  const tree = formatTreeAsText(root)
  const elementMap = new Map<string, Element>()

  // Build element map
  const allElements = doc.querySelectorAll('*')
  for (const el of allElements) {
    const id = elementIdMap.get(el)
    if (id) {
      elementMap.set(id, el)
    }
  }

  return {
    tree,
    elementMap,
    elementCount: elementMap.size,
  }
}

/**
 * Get an element by its serialized ID
 */
export function getElementById(id: string, elementMap: Map<string, Element>): Element | undefined {
  return elementMap.get(id)
}

/**
 * Execute an action on an element
 */
export async function executeAction(
  elementId: string,
  action: 'click' | 'type' | 'focus' | 'scroll',
  elementMap: Map<string, Element>,
  args?: { text?: string; direction?: 'up' | 'down' }
): Promise<{ success: boolean; error?: string }> {
  const element = elementMap.get(elementId)
  if (!element) {
    return { success: false, error: `Element with ID ${elementId} not found` }
  }

  try {
    switch (action) {
      case 'click':
        (element as HTMLElement).click()
        break
      case 'type':
        if (args?.text) {
          const input = element as HTMLInputElement | HTMLTextAreaElement
          input.focus()
          input.value = args.text
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
        break
      case 'focus':
        (element as HTMLElement).focus()
        break
      case 'scroll':
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        break
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
