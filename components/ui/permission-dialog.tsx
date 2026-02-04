import * as React from "react"
import { Download, Send, FileText, Shield, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card"
import type { PermissionRequest, PermissionCategory } from "@/lib/ai/types"

interface PermissionDialogProps {
  request: PermissionRequest | null
  onApprove: (requestId: string, allowAllSimilar?: boolean) => void
  onDeny: (requestId: string, reason?: string) => void
}

const CATEGORY_ICONS: Record<PermissionCategory, React.ReactNode> = {
  download: <Download className="h-6 w-6 text-blue-500" />,
  form_submit: <FileText className="h-6 w-6 text-green-500" />,
  send_message: <Send className="h-6 w-6 text-purple-500" />,
  accept_terms: <Shield className="h-6 w-6 text-orange-500" />,
  social_post: <Send className="h-6 w-6 text-pink-500" />,
  other: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
}

const CATEGORY_TITLES: Record<PermissionCategory, string> = {
  download: "Download File",
  form_submit: "Submit Form",
  send_message: "Send Message",
  accept_terms: "Accept Terms",
  social_post: "Post Content",
  other: "Sensitive Action",
}

export function PermissionDialog({ request, onApprove, onDeny }: PermissionDialogProps) {
  const [allowAllSimilar, setAllowAllSimilar] = React.useState(false)

  if (!request) return null

  const icon = CATEGORY_ICONS[request.category] || CATEGORY_ICONS.other
  const title = CATEGORY_TITLES[request.category] || "Permission Required"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-[380px] max-w-[90vw] animate-in fade-in-0 zoom-in-95">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            {icon}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-sm font-medium">{request.action}</p>
          <p className="text-sm text-muted-foreground">{request.reason}</p>

          {request.details && (
            <div className="rounded-md bg-muted p-3 text-xs font-mono">
              {request.details}
            </div>
          )}

          <label className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              checked={allowAllSimilar}
              onChange={(e) => setAllowAllSimilar(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-muted-foreground">
              Allow all similar actions this session
            </span>
          </label>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDeny(request.requestId)}
          >
            Deny
          </Button>
          <Button
            size="sm"
            onClick={() => onApprove(request.requestId, allowAllSimilar)}
          >
            Allow
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default PermissionDialog
