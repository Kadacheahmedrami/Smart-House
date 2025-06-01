"use client"

import { useState, useRef, useEffect, type FormEvent } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatMessage, type Message } from "@/components/chat-message"
import { SendHorizonal, Loader2, AlertCircle } from "lucide-react"
import { useEsp32 } from "@/app/contexts/esp32-context"
import { v4 as uuidv4 } from "uuid"
import { useToast } from "@/components/ui/use-toast"
import { MessageCircle } from "lucide-react"

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { esp32Ip, sendCommand, isConnected } = useEsp32()
  const { toast } = useToast()

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector("div[data-radix-scroll-area-viewport]")
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [messages])

  useEffect(() => {
    if (!esp32Ip) {
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          sender: "system",
          content: "ESP32 IP address is not set. Please configure it using the WiFi icon in the header.",
          type: "system_error",
          timestamp: new Date(),
        },
      ])
    } else if (!isConnected) {
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          sender: "system",
          content: `Attempting to connect to ESP32 at ${esp32Ip}... If this persists, check the connection.`,
          type: "system_info",
          timestamp: new Date(),
        },
      ])
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          sender: "system",
          content: `Connected to ESP32 at ${esp32Ip}. Ready for commands!`,
          type: "system_info",
          timestamp: new Date(),
        },
      ])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esp32Ip, isConnected])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: uuidv4(),
      sender: "user",
      content: input,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      })

      if (!res.ok) {
        throw new Error(`API error: ${res.statusText}`)
      }

      const data = await res.json()

      const botResponse: Message = {
        id: uuidv4(),
        sender: "bot",
        content: data.message || "Processing...",
        type: data.type || "conversation",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botResponse])

      if (data.type === "action" && data.command) {
        if (!esp32Ip || !isConnected) {
          const esp32NotReadyMessage: Message = {
            id: uuidv4(),
            sender: "system",
            content: `I understood you want to '${data.command.action} ${data.command.target}', but the ESP32 is not connected. Please check the IP address and connection status.`,
            type: "system_error",
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, esp32NotReadyMessage])
          toast({
            title: "ESP32 Not Connected",
            description: `Command '${data.command.action} ${data.command.target}' not sent.`,
            variant: "destructive",
          })
        } else {
          // Use direct endpoint instead of /api/control
          let endpoint = ""
          const { action, target } = data.command

          // Map the command to the appropriate direct endpoint
          if (target === "garage") {
            endpoint = `/api/garage/${action}`
          } else if (target === "window") {
            endpoint = `/api/window/${action}`
          } else if (target === "door") {
            endpoint = `/api/door/${action}`
          } else if (target === "garage_led") {
            endpoint = `/api/led/garage/${action}`
          } else if (target === "room1_led") {
            endpoint = `/api/led/room1/${action}`
          } else if (target === "room2_led") {
            endpoint = `/api/led/room2/${action}`
          } else if (target === "buzzer") {
            endpoint = `/api/buzzer/${action}`
          }

          if (endpoint) {
            const commandResult = await sendCommand(endpoint)
            const feedbackMessage: Message = {
              id: uuidv4(),
              sender: "bot",
              content: commandResult.message,
              type: "action_feedback",
              success: commandResult.success,
              timestamp: new Date(),
            }
            setMessages((prev) => [...prev, feedbackMessage])
            if (!commandResult.success) {
              toast({ title: "ESP32 Command Failed", description: commandResult.message, variant: "destructive" })
            } else {
              toast({ title: "ESP32 Command Success", description: commandResult.message })
            }
          } else {
            // Fallback to /api/control if no direct endpoint is found
            const commandResult = await sendCommand("/api/control", "POST", data.command)
            const feedbackMessage: Message = {
              id: uuidv4(),
              sender: "bot",
              content: commandResult.message,
              type: "action_feedback",
              success: commandResult.success,
              timestamp: new Date(),
            }
            setMessages((prev) => [...prev, feedbackMessage])
            if (!commandResult.success) {
              toast({ title: "ESP32 Command Failed", description: commandResult.message, variant: "destructive" })
            } else {
              toast({ title: "ESP32 Command Success", description: commandResult.message })
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: Message = {
        id: uuidv4(),
        sender: "bot",
        content: "Sorry, I encountered an error trying to process your request.",
        type: "error",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
      toast({
        title: "Chat Error",
        description: "Could not communicate with the AI assistant.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] bg-card rounded-xl shadow-2xl overflow-hidden border border-border">
      <div className="p-4 border-b flex items-center space-x-2">
        <MessageCircle className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-semibold">AI Chat Control</h2>
      </div>
      {!esp32Ip && (
        <div className="p-4 bg-yellow-500/10 text-yellow-300 border-b border-yellow-500/30 flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          <span>ESP32 IP not set. Please configure it via the WiFi icon in the header to send commands.</span>
        </div>
      )}
      <ScrollArea className="flex-grow p-4 space-y-4" ref={scrollAreaRef}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary text-secondary-foreground max-w-[85%] mr-auto">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">AI is thinking...</span>
          </div>
        )}
      </ScrollArea>
      <form onSubmit={handleSubmit} className="p-4 border-t bg-background">
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              esp32Ip && isConnected
                ? "Type your command or message..."
                : "Chat with AI (ESP32 not connected for commands)..."
            }
            className="flex-grow"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizonal className="h-5 w-5" />}
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
