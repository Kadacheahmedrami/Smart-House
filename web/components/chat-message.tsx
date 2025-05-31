"use client"

import { Bot, User, AlertTriangle, CheckCircle, Info, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import ReactMarkdown from "react-markdown"

export interface Message {
  id: string
  sender: "user" | "bot" | "system"
  content: string
  type?: "action_feedback" | "conversation" | "error" | "clarification" | "system_error" | "system_info"
  success?: boolean
  timestamp: Date
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === "user"
  const isBot = message.sender === "bot"
  const isSystem = message.sender === "system"

  const getAvatarIcon = () => {
    if (isUser) return <User className="h-5 w-5" />
    if (isBot) {
      if (message.type === "error" || (message.type === "action_feedback" && !message.success)) {
        return <AlertTriangle className="h-5 w-5 text-destructive" />
      }
      if (message.type === "action_feedback" && message.success) {
        return <CheckCircle className="h-5 w-5 text-green-500" />
      }
      return <Bot className="h-5 w-5 text-primary" />
    }
    if (isSystem) {
      if (message.type === "system_error") return <WifiOff className="h-5 w-5 text-destructive" />
      return <Info className="h-5 w-5 text-blue-400" />
    }
    return <Bot className="h-5 w-5" />
  }

  const getAvatarBgColor = () => {
    if (isUser) return "bg-sky-500"
    if (isBot) {
      if (message.type === "error" || (message.type === "action_feedback" && !message.success)) {
        return "bg-destructive/20"
      }
      if (message.type === "action_feedback" && message.success) {
        return "bg-green-500/20"
      }
      return "bg-primary/20"
    }
    if (isSystem) {
      if (message.type === "system_error") return "bg-destructive/20"
      return "bg-blue-500/20"
    }
    return "bg-primary/20"
  }

  return (
    <div
      className={cn(
        "flex items-start space-x-3 py-3 px-2 rounded-lg max-w-[85%]",
        isUser ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto",
      )}
    >
      <Avatar className={cn("h-8 w-8", getAvatarBgColor())}>
        {/* <AvatarImage src={isUser ? "/user-avatar.png" : "/bot-avatar.png"} /> */}
        <AvatarFallback className={cn("text-white", getAvatarBgColor())}>{getAvatarIcon()}</AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "p-3 rounded-lg shadow-md",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
          isSystem && message.type === "system_error" && "bg-destructive/80 text-destructive-foreground",
          isSystem && message.type === "system_info" && "bg-blue-600/80 text-white",
          isBot && message.type === "error" && "bg-destructive/80 text-destructive-foreground",
          isBot &&
            message.type === "action_feedback" &&
            !message.success &&
            "bg-destructive/80 text-destructive-foreground",
          isBot && message.type === "action_feedback" && message.success && "bg-green-600/80 text-white",
        )}
      >
        <ReactMarkdown
          components={{
            p: ({ node, ...props }) => <p className="text-sm" {...props} />,
          }}
        >
          {message.content}
        </ReactMarkdown>
        <p
          className={cn(
            "text-xs mt-1",
            isUser ? "text-primary-foreground/70" : "text-secondary-foreground/70",
            (isSystem || (isBot && (message.type === "action_feedback" || message.type === "error"))) &&
              "text-white/70",
          )}
        >
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  )
}
