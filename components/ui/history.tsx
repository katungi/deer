import * as React from "react"
import { cn } from "@/lib/utils"
import { X, Plus, MessageSquare, Trash2, Clock } from "lucide-react"
import { Button } from "./button"
import { ScrollArea } from "./scroll-area"
import type { Conversation } from "@/lib/ai"

interface HistoryProps {
  isOpen: boolean
  onClose: () => void
  conversations: Conversation[]
  currentConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  onDeleteConversation: (id: string) => void
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupConversationsByDate(conversations: Conversation[]): Record<string, Conversation[]> {
  const groups: Record<string, Conversation[]> = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'This Month': [],
    'Older': [],
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)
  const monthAgo = new Date(today.getTime() - 30 * 86400000)

  for (const conv of conversations) {
    const convDate = new Date(conv.updatedAt)

    if (convDate >= today) {
      groups['Today'].push(conv)
    } else if (convDate >= yesterday) {
      groups['Yesterday'].push(conv)
    } else if (convDate >= weekAgo) {
      groups['This Week'].push(conv)
    } else if (convDate >= monthAgo) {
      groups['This Month'].push(conv)
    } else {
      groups['Older'].push(conv)
    }
  }

  return groups
}

export function History({
  isOpen,
  onClose,
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: HistoryProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeletingId(id)
  }

  const confirmDelete = (id: string) => {
    onDeleteConversation(id)
    setDeletingId(null)
  }

  const cancelDelete = () => {
    setDeletingId(null)
  }

  if (!isOpen) return null

  const groupedConversations = groupConversationsByDate(conversations)

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* History Panel - slides in from left */}
      <div className="relative bg-stone-900 w-full max-w-xs h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="h-5 w-5" />
            History
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-stone-400 hover:text-white hover:bg-stone-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* New Chat Button */}
        <div className="p-3 border-b border-stone-800">
          <Button
            onClick={() => {
              onNewConversation()
              onClose()
            }}
            className="w-full justify-start gap-2 bg-stone-800 hover:bg-stone-700 text-stone-200"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-stone-500 text-sm">
                No conversations yet
              </div>
            ) : (
              Object.entries(groupedConversations).map(([group, convs]) => {
                if (convs.length === 0) return null

                return (
                  <div key={group} className="mb-4">
                    <div className="px-2 py-1.5 text-xs font-medium text-stone-500 uppercase tracking-wider">
                      {group}
                    </div>
                    {convs.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => {
                          onSelectConversation(conv.id)
                          onClose()
                        }}
                        className={cn(
                          "group relative flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                          currentConversationId === conv.id
                            ? "bg-stone-700"
                            : "hover:bg-stone-800"
                        )}
                      >
                        <MessageSquare className="h-4 w-4 text-stone-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-stone-200 truncate pr-6">
                            {conv.title}
                          </div>
                          <div className="text-xs text-stone-500 mt-0.5">
                            {conv.messages.length} messages · {formatRelativeTime(new Date(conv.updatedAt))}
                          </div>
                        </div>

                        {/* Delete button */}
                        {deletingId === conv.id ? (
                          <div className="absolute right-2 top-2 flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                confirmDelete(conv.id)
                              }}
                              className="p-1 rounded bg-red-600 text-white text-xs hover:bg-red-700"
                            >
                              Delete
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                cancelDelete()
                              }}
                              className="p-1 rounded bg-stone-600 text-white text-xs hover:bg-stone-500"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleDelete(e, conv.id)}
                            className="absolute right-2 top-2 p-1.5 rounded text-stone-500 hover:text-red-400 hover:bg-stone-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {conversations.length > 0 && (
          <div className="p-3 border-t border-stone-800">
            <div className="text-xs text-stone-500 text-center">
              {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
