"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"

interface Esp32ContextType {
  esp32Ip: string | null
  setEsp32Ip: (ip: string | null) => void
  isConnected: boolean
  testConnection: () => Promise<boolean>
  sendEsp32Command: (command: { action: string; target: string }) => Promise<{ success: boolean; message: string }>
}

const Esp32Context = createContext<Esp32ContextType | undefined>(undefined)

const ESP32_IP_KEY = "esp32IpAddress"

export function Esp32Provider({ children }: { children: ReactNode }) {
  const [esp32Ip, setEsp32IpState] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const { toast } = useToast()

  useEffect(() => {
    const storedIp = localStorage.getItem(ESP32_IP_KEY)
    if (storedIp) {
      setEsp32IpState(storedIp)
    }
  }, [])

  const setEsp32Ip = (ip: string | null) => {
    if (ip) {
      localStorage.setItem(ESP32_IP_KEY, ip)
    } else {
      localStorage.removeItem(ESP32_IP_KEY)
    }
    setEsp32IpState(ip)
    setIsConnected(false) // Reset connection status when IP changes
  }

  const testConnection = useCallback(async () => {
    if (!esp32Ip) {
      toast({ title: "Error", description: "ESP32 IP Address not set.", variant: "destructive" })
      setIsConnected(false)
      return false
    }
    try {
      const response = await fetch(`http://${esp32Ip}/api/status`)
      if (response.ok) {
        toast({ title: "Success", description: "Connected to ESP32 successfully!" })
        setIsConnected(true)
        return true
      } else {
        toast({
          title: "Error",
          description: `Failed to connect to ESP32 (status: ${response.status}).`,
          variant: "destructive",
        })
        setIsConnected(false)
        return false
      }
    } catch (error) {
      console.error("ESP32 connection test error:", error)
      toast({ title: "Error", description: "Could not reach ESP32. Check IP and network.", variant: "destructive" })
      setIsConnected(false)
      return false
    }
  }, [esp32Ip, toast])

  useEffect(() => {
    if (esp32Ip) {
      testConnection()
    }
  }, [esp32Ip, testConnection])

  const sendEsp32Command = async (command: { action: string; target: string }): Promise<{
    success: boolean
    message: string
  }> => {
    if (!esp32Ip) {
      return { success: false, message: "ESP32 IP Address not set." }
    }
    if (!isConnected && !(await testConnection())) {
      return { success: false, message: "ESP32 not connected. Please check IP and connection." }
    }

    try {
      const response = await fetch(`http://${esp32Ip}/api/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      })
      const data = await response.json()
      if (response.ok && data.status === "success") {
        return { success: true, message: data.message || "Command executed successfully." }
      } else {
        return { success: false, message: data.message || `Failed to execute command (status: ${response.status}).` }
      }
    } catch (error) {
      console.error("Send ESP32 command error:", error)
      return { success: false, message: "Error sending command to ESP32. Check network." }
    }
  }

  return (
    <Esp32Context.Provider value={{ esp32Ip, setEsp32Ip, isConnected, testConnection, sendEsp32Command }}>
      {children}
    </Esp32Context.Provider>
  )
}

export function useEsp32() {
  const context = useContext(Esp32Context)
  if (context === undefined) {
    throw new Error("useEsp32 must be used within an Esp32Provider")
  }
  return context
}
