"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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

const WAKE_WORDS = ["sirius", "serious", "syria", "series", "siri", "cyrus", "circus"]

type SystemStatusType =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "ESP32_COMMAND_SENT"
  | "ERROR"
  | "NO_WAKE_WORD"
  | "WAKE_WORD_DETECTED"

export default function VoiceChatPage() {
  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [systemStatus, setSystemStatus] = useState<SystemStatusType>("IDLE")
  const [statusMessage, setStatusMessage] = useState("Click the mic and say 'Sirius' followed by your command.")
  const [lastSpokenResponse, setLastSpokenResponse] = useState("")
  const [audioData, setAudioData] = useState<number[]>(new Array(64).fill(0))
  const [wakeWordDetected, setWakeWordDetected] = useState(false)

  const recognitionRef = useRef<any>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const { esp32Ip, sendCommand, isConnected, testConnection } = useEsp32()
  const { toast } = useToast()

  // Fuzzy matching for wake word detection
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = []
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        }
      }
    }
    return matrix[str2.length][str1.length]
  }

  const detectWakeWord = (text: string): boolean => {
    const words = text.toLowerCase().split(/\s+/)
    return words.some((word) => {
      return WAKE_WORDS.some((wakeWord) => {
        const distance = levenshteinDistance(word, wakeWord)
        const threshold = Math.ceil(wakeWord.length * 0.3) // Allow 30% character difference
        return distance <= threshold
      })
    })
  }

  // Audio spectrum visualization
  const setupAudioContext = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)

      analyserRef.current.fftSize = 128
      analyserRef.current.smoothingTimeConstant = 0.8
      microphoneRef.current.connect(analyserRef.current)

      const updateAudioData = () => {
        if (analyserRef.current) {
          const bufferLength = analyserRef.current.frequencyBinCount
          const dataArray = new Uint8Array(bufferLength)
          analyserRef.current.getByteFrequencyData(dataArray)
          setAudioData(Array.from(dataArray))
        }
        animationFrameRef.current = requestAnimationFrame(updateAudioData)
      }
      updateAudioData()
    } catch (error) {
      console.error("Error setting up audio context:", error)
    }
  }, [])

  // TTS Helper
  const speak = (text: string) => {
    if (!window.speechSynthesis) {
      toast({ title: "TTS Error", description: "Text-to-speech not supported.", variant: "destructive" })
      return
    }
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utteranceRef.current = utterance
    setSystemStatus("SPEAKING")
    setStatusMessage(`Sirius says: "${text}"`)
    setLastSpokenResponse(text)

    utterance.onend = () => {
      setSystemStatus("IDLE")
      setStatusMessage("Click the mic and say 'Sirius' followed by your command.")
      if (isListening && recognitionRef.current) {
        recognitionRef.current.start()
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
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onstart = () => {
      setIsListening(true)
      setSystemStatus("LISTENING")
      setStatusMessage("Listening... Say 'Sirius' then your command.")
      setupAudioContext()
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
      setCurrentTranscript(interim || final)

      if (final) {
        processCommand(final.trim())
      }
    }

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error)

      // Don't treat "aborted" as an error - it's expected when stopping recognition
      if (event.error === "aborted") {
        return
      }

      // Don't show toast for common non-critical errors
      if (event.error !== "no-speech" && event.error !== "network") {
        toast({ title: "Speech Error", description: `Error: ${event.error}`, variant: "destructive" })
      }

      setIsListening(false)
      setSystemStatus("IDLE")
      setStatusMessage("Error listening. Click mic to try again.")
    }

    recognition.onend = () => {
      setIsListening(false)
      if (systemStatus === "LISTENING") {
        setSystemStatus("IDLE")
        setStatusMessage("Click the mic and say 'Sirius' followed by your command.")
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {
          // Ignore cleanup errors
        })
      }
    }
  }, [setupAudioContext, systemStatus])

  useEffect(() => {
    if (!esp32Ip) {
      const msg = "ESP32 IP not set. Configure in header."
      setStatusMessage(msg)
    } else if (!isConnected) {
      const msg = `ESP32 at ${esp32Ip} not connected. Trying to connect...`
      setStatusMessage(msg)
      testConnection().then((connected) => {
        if (connected) speak("Connected to ESP32.")
        else speak("Failed to connect to ESP32. Please check the IP and network.")
      })
    } else {
      const msg = `Connected to ESP32 at ${esp32Ip}. Ready for commands.`
      setStatusMessage(msg)
    }
  }, [esp32Ip, isConnected, testConnection])

  const processCommand = async (text: string) => {
    setCurrentTranscript(text)

    if (!detectWakeWord(text)) {
      setSystemStatus("NO_WAKE_WORD")
      setStatusMessage(`Please start with "Sirius". You said: "${text}"`)
      setIsListening(false)
      return
    }

    // Wake word detected - trigger visual effect
    setWakeWordDetected(true)
    setSystemStatus("WAKE_WORD_DETECTED")
    setStatusMessage("Wake word detected! Processing command...")

    setTimeout(() => setWakeWordDetected(false), 2000)

    // Extract command after wake word
    const words = text.toLowerCase().split(/\s+/)
    const wakeWordIndex = words.findIndex((word) =>
      WAKE_WORDS.some((wakeWord) => {
        const distance = levenshteinDistance(word, wakeWord)
        const threshold = Math.ceil(wakeWord.length * 0.3)
        return distance <= threshold
      }),
    )

    const command = words
      .slice(wakeWordIndex + 1)
      .join(" ")
      .trim()
    if (!command) {
      setSystemStatus("IDLE")
      setStatusMessage("No command after wake word. Try again.")
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
          setLastSpokenResponse(espErrorMsg)
          speak(espErrorMsg)
          toast({
            title: "ESP32 Not Connected",
            description: `Command '${data.command.action} ${data.command.target}' not sent.`,
            variant: "destructive",
          })
        } else {
          setSystemStatus("ESP32_COMMAND_SENT")
          setStatusMessage(`Sending to ESP32: ${data.command.action} ${data.command.target}`)

          // Map the command to the appropriate direct endpoint
          let endpoint = ""
          const { action, target } = data.command

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
            speak(commandResult.message)
            if (!commandResult.success) {
              toast({ title: "ESP32 Command Failed", description: commandResult.message, variant: "destructive" })
            } else {
              toast({ title: "ESP32 Command Success", description: commandResult.message })
            }
          } else {
            // Fallback to /api/control if no direct endpoint is found
            const commandResult = await sendCommand("/api/control", "POST", data.command)
            speak(commandResult.message)
            if (!commandResult.success) {
              toast({ title: "ESP32 Command Failed", description: commandResult.message, variant: "destructive" })
            } else {
              toast({ title: "ESP32 Command Success", description: commandResult.message })
            }
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
    }
  }

  const toggleListening = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        // If stop fails, try abort
        try {
          recognitionRef.current.abort()
        } catch (abortError) {
          // Force state reset if both fail
          setIsListening(false)
          setSystemStatus("IDLE")
          setStatusMessage("Click the mic and say 'Sirius' followed by your command.")
        }
      }
    } else {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
      }
      setCurrentTranscript("")
      setLastSpokenResponse("")
      try {
        recognitionRef.current.start()
      } catch (error) {
        console.error("Failed to start recognition:", error)
        toast({
          title: "Microphone Error",
          description: "Could not start voice recognition. Please check microphone permissions.",
          variant: "destructive",
        })
      }
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
      case "WAKE_WORD_DETECTED":
        return <Zap className="h-6 w-6 text-cyan-400 animate-bounce" />
      case "ERROR":
      case "NO_WAKE_WORD":
        return <AlertCircle className="h-6 w-6 text-red-400" />
      default:
        return <Info className="h-6 w-6 text-gray-400" />
    }
  }

  // Generate spectrum bars for circular visualization
  const generateSpectrumBars = () => {
    const bars = []
    const numBars = 32
    const radius = 120

    for (let i = 0; i < numBars; i++) {
      const angle = (i / numBars) * 360
      const height = (Math.max(audioData[i] || 0, 10) / 255) * 60
      const hue = (angle + (wakeWordDetected ? 180 : 0)) % 360

      bars.push(
        <div
          key={i}
          className="absolute origin-bottom"
          style={{
            transform: `rotate(${angle}deg) translateY(-${radius}px)`,
            width: "4px",
            height: `${height + 10}px`,
            background: wakeWordDetected
              ? `linear-gradient(to top, hsl(${hue}, 100%, 50%), hsl(${hue + 60}, 100%, 70%))`
              : `linear-gradient(to top, hsl(${hue}, 70%, 40%), hsl(${hue + 30}, 80%, 60%))`,
            borderRadius: "2px",
            boxShadow: wakeWordDetected ? `0 0 10px hsl(${hue}, 100%, 50%)` : `0 0 5px hsl(${hue}, 70%, 40%)`,
            transition: "all 0.1s ease-out",
          }}
        />,
      )
    }
    return bars
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] p-4">
      <Card className="w-full max-w-lg shadow-2xl glass-effect">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold flex items-center justify-center">
            <Mic className="h-7 w-7 mr-2 text-primary" />
            Sirius Voice Control
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 p-6">
          {/* Circular Audio Spectrum */}
          <div className="relative w-80 h-80 flex items-center justify-center">
            {/* Outer glow ring */}
            <div
              className={cn(
                "absolute inset-0 rounded-full transition-all duration-500",
                wakeWordDetected
                  ? "bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-pink-500/30 animate-pulse"
                  : isListening
                    ? "bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20"
                    : "bg-gradient-to-r from-gray-500/10 to-gray-600/10",
              )}
              style={{
                filter: wakeWordDetected ? "blur(20px)" : isListening ? "blur(15px)" : "blur(10px)",
                boxShadow: wakeWordDetected
                  ? "0 0 100px rgba(0, 255, 255, 0.5), inset 0 0 50px rgba(255, 0, 255, 0.3)"
                  : isListening
                    ? "0 0 60px rgba(59, 130, 246, 0.4)"
                    : "0 0 30px rgba(107, 114, 128, 0.2)",
              }}
            />

            {/* Spectrum bars */}
            <div className="absolute inset-0 flex items-center justify-center">{generateSpectrumBars()}</div>

            {/* Center button */}
            <Button
              onClick={toggleListening}
              disabled={isLoading && systemStatus === "PROCESSING"}
              variant={isListening ? "outline" : "default"}
              size="lg"
              className={cn(
                "relative z-10 rounded-full w-32 h-32 text-2xl transition-all duration-300 ease-in-out transform hover:scale-105",
                isListening ? "bg-red-500/20 border-red-500 hover:bg-red-500/30" : "bg-primary hover:bg-primary/90",
                wakeWordDetected && "animate-pulse bg-gradient-to-r from-cyan-500 to-purple-500",
                isLoading && systemStatus === "PROCESSING" && "opacity-50 cursor-not-allowed",
              )}
              style={{
                boxShadow: wakeWordDetected
                  ? "0 0 30px rgba(0, 255, 255, 0.8), 0 0 60px rgba(255, 0, 255, 0.6)"
                  : isListening
                    ? "0 0 20px rgba(239, 68, 68, 0.5)"
                    : "0 0 15px rgba(59, 130, 246, 0.3)",
              }}
            >
              {isListening ? <MicOff className="h-12 w-12" /> : <Mic className="h-12 w-12" />}
            </Button>

            {/* Ripple effect for wake word detection */}
            {wakeWordDetected && (
              <div className="absolute inset-0 rounded-full border-4 border-cyan-400 animate-ping opacity-75" />
            )}
          </div>

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

          <p className="text-xs text-muted-foreground text-center">
            {isListening ? "Tap to stop listening" : "Tap to start listening"}
            <br />
            <span className="text-cyan-400">Wake words: Sirius, Serious, Siri, Cyrus, etc.</span>
          </p>
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
