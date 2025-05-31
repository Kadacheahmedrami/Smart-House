"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Loader2, AlertCircle, Zap, Volume2, Info } from "lucide-react"
import { useEsp32 } from "@/app/contexts/esp32-context"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// Extend the Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
    speechSynthesis: SpeechSynthesis
  }
}

const WAKE_WORD = "sirius"

type SystemStatusType =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "ESP32_COMMAND_SENT"
  | "ERROR"
  | "NO_WAKE_WORD"

export default function VoiceChatPage() {
  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false) // For API calls
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [systemStatus, setSystemStatus] = useState<SystemStatusType>("IDLE")
  const [statusMessage, setStatusMessage] = useState("Click the mic and say 'Sirius' followed by your command.")
  const [lastSpokenResponse, setLastSpokenResponse] = useState("")

  const recognitionRef = useRef<any>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const { esp32Ip, sendEsp32Command, isConnected, testConnection } = useEsp32()
  const { toast } = useToast()

  // TTS Helper
  const speak = (text: string) => {
    if (!window.speechSynthesis) {
      toast({ title: "TTS Error", description: "Text-to-speech not supported.", variant: "destructive" })
      return
    }
    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utteranceRef.current = utterance
    setSystemStatus("SPEAKING")
    setStatusMessage(`Sirius says: "${text}"`)
    setLastSpokenResponse(text)

    utterance.onend = () => {
      setSystemStatus("IDLE")
      setStatusMessage("Click the mic and say 'Sirius' followed by your command.")
      if (isListening) {
        // If mic was on, turn it back on after speaking
        if (recognitionRef.current && recognitionRef.current.stop) recognitionRef.current.start()
      }
    }
    utterance.onerror = (event) => {
      console.error("SpeechSynthesis Error:", event)
      toast({ title: "TTS Error", description: `Could not speak: ${event.error}`, variant: "destructive" })
      setSystemStatus("IDLE")
    }
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setStatusMessage("Speech recognition not supported in your browser.")
      setSystemStatus("ERROR")
      toast({
        title: "Browser Not Supported",
        description: "Speech recognition is not supported.",
        variant: "destructive",
      })
      return
    }

    recognitionRef.current = new SpeechRecognition()
    const recognition = recognitionRef.current
    recognition.continuous = false // Process after each pause
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onstart = () => {
      setIsListening(true)
      setSystemStatus("LISTENING")
      setStatusMessage("Listening... Say 'Sirius' then your command.")
    }

    recognition.onresult = (event: any) => {
      let interim = ""
      let final = ""
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcriptPart
        } else {
          interim += transcriptPart
        }
      }
      setCurrentTranscript(interim || final) // Show live transcript

      if (final) {
        processCommand(final.trim())
      }
    }

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error)
      if (event.error !== "no-speech" && event.error !== "aborted") {
        toast({ title: "Speech Error", description: `Error: ${event.error}`, variant: "destructive" })
      }
      setIsListening(false)
      setSystemStatus("IDLE")
      setStatusMessage("Error listening. Click mic to try again.")
    }

    recognition.onend = () => {
      setIsListening(false)
      // If it ends and we weren't processing, reset status.
      // If it was processing, it will be handled by processCommand.
      if (systemStatus === "LISTENING") {
        setSystemStatus("IDLE")
        setStatusMessage("Click the mic and say 'Sirius' followed by your command.")
      }
    }

    return () => {
      if (recognitionRef.current && recognitionRef.current.stop) {
        recognitionRef.current.abort() // Use abort to prevent onend from re-triggering logic
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Ran once on mount

  // Effect for ESP32 connection status
  useEffect(() => {
    if (!esp32Ip) {
      const msg = "ESP32 IP not set. Configure in header."
      setStatusMessage(msg)
      // speak(msg) // Optional: speak system messages
    } else if (!isConnected) {
      const msg = `ESP32 at ${esp32Ip} not connected. Trying to connect...`
      setStatusMessage(msg)
      // speak(msg)
      testConnection().then((connected) => {
        if (connected) speak("Connected to ESP32.")
        else speak("Failed to connect to ESP32. Please check the IP and network.")
      })
    } else {
      const msg = `Connected to ESP32 at ${esp32Ip}. Ready for commands.`
      setStatusMessage(msg)
      // speak(msg)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esp32Ip, isConnected])

  const processCommand = async (text: string) => {
    setCurrentTranscript(text) // Show the final recognized text
    if (!text.toLowerCase().startsWith(WAKE_WORD)) {
      setSystemStatus("NO_WAKE_WORD")
      setStatusMessage(`Please start with "${WAKE_WORD}". You said: "${text}"`)
      // speak(`I'm sorry, I only respond to commands starting with ${WAKE_WORD}.`)
      setIsListening(false) // Stop listening if wake word not detected
      return
    }

    const command = text.substring(WAKE_WORD.length).trim()
    if (!command) {
      setSystemStatus("IDLE")
      setStatusMessage("No command after 'Sirius'. Try again.")
      // speak("I heard Sirius, but what is your command?")
      setIsListening(false)
      return
    }

    setSystemStatus("PROCESSING")
    setStatusMessage(`Processing: "${command}"`)
    setIsLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: command }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || `API error: ${res.statusText}`)
      }
      const data = await res.json()

      speak(data.message || "I've processed that.")

      if (data.type === "action" && data.command) {
        if (!esp32Ip || !isConnected) {
          const espErrorMsg = `Understood: ${data.command.action} ${data.command.target}. But ESP32 is not connected.`
          setLastSpokenResponse(espErrorMsg) // Update this for display
          speak(espErrorMsg)
          toast({
            title: "ESP32 Not Connected",
            description: `Command '${data.command.action} ${data.command.target}' not sent.`,
            variant: "destructive",
          })
        } else {
          setSystemStatus("ESP32_COMMAND_SENT")
          setStatusMessage(`Sending to ESP32: ${data.command.action} ${data.command.target}`)
          const commandResult = await sendEsp32Command(data.command)
          // The main AI response is already spoken. Now speak ESP32 feedback.
          speak(commandResult.message) // This will update statusMessage via speak()
          if (!commandResult.success) {
            toast({ title: "ESP32 Command Failed", description: commandResult.message, variant: "destructive" })
          } else {
            toast({ title: "ESP32 Command Success", description: commandResult.message })
          }
        }
      }
    } catch (error: any) {
      console.error("Processing command error:", error)
      const errorMsg = error.message || "Sorry, I encountered an error."
      speak(errorMsg)
      setSystemStatus("ERROR")
      setStatusMessage(`Error: ${errorMsg}`)
      toast({ title: "Processing Error", description: errorMsg, variant: "destructive" })
    } finally {
      setIsLoading(false)
      // recognition.stop() is called implicitly by continuous=false, or by onend if error
      // We want to be ready for the next command, so set to IDLE.
      // speak() will set it to IDLE on utterance.onend
    }
  }

  const toggleListening = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      // onend will set isListening to false and update status
    } else {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel() // Stop speaking if user clicks mic
      }
      setCurrentTranscript("")
      setLastSpokenResponse("")
      recognitionRef.current.start()
    }
  }

  const getStatusIcon = () => {
    switch (systemStatus) {
      case "LISTENING":
        return <Mic className="h-6 w-6 text-blue-400 animate-pulse" />
      case "PROCESSING":
        return <Loader2 className="h-6 w-6 text-yellow-400 animate-spin" />
      case "SPEAKING":
        return <Volume2 className="h-6 w-6 text-green-400 animate-ping" />
      case "ESP32_COMMAND_SENT":
        return <Zap className="h-6 w-6 text-purple-400" />
      case "ERROR":
      case "NO_WAKE_WORD":
        return <AlertCircle className="h-6 w-6 text-red-400" />
      default:
        return <Info className="h-6 w-6 text-gray-400" />
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] p-4">
      <Card className="w-full max-w-md shadow-2xl glass-effect">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold flex items-center justify-center">
            <Mic className="h-7 w-7 mr-2 text-primary" />
            Sirius Voice Control
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 p-6">
          <div className="flex items-center justify-center space-x-3 p-4 rounded-lg bg-background/50 min-h-[60px] w-full text-center">
            {getStatusIcon()}
            <p className="text-sm text-foreground/80">{statusMessage}</p>
          </div>

          {currentTranscript && (
            <div className="w-full p-3 border rounded-md bg-secondary/30">
              <p className="text-xs text-muted-foreground">You said:</p>
              <p className="text-sm italic">{currentTranscript}</p>
            </div>
          )}

          {lastSpokenResponse && systemStatus !== "SPEAKING" && (
            <div className="w-full p-3 border rounded-md bg-primary/10">
              <p className="text-xs text-muted-foreground">Sirius replied:</p>
              <p className="text-sm">{lastSpokenResponse}</p>
            </div>
          )}

          <Button
            onClick={toggleListening}
            disabled={isLoading && systemStatus === "PROCESSING"} // Disable only when strictly processing API call
            variant={isListening ? "outline" : "default"}
            size="lg"
            className={cn(
              "rounded-full w-24 h-24 text-2xl transition-all duration-300 ease-in-out transform hover:scale-105",
              isListening ? "bg-red-500/20 border-red-500 hover:bg-red-500/30" : "bg-primary hover:bg-primary/90",
              isLoading && systemStatus === "PROCESSING" && "opacity-50 cursor-not-allowed",
            )}
          >
            {isListening ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
          </Button>
          <p className="text-xs text-muted-foreground">{isListening ? "Tap to stop" : "Tap to start listening"}</p>
        </CardContent>
      </Card>
      {!esp32Ip && (
        <p className="mt-6 text-sm text-yellow-400 flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" /> ESP32 IP not set. Configure in header for device control.
        </p>
      )}
    </div>
  )
}
