"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"

interface Esp32ContextType {
  esp32Ip: string | null
  setEsp32Ip: (ip: string | null) => void
  isConnected: boolean
  testConnection: () => Promise<boolean>
  sendCommand: (
    endpoint: string,
    method?: string,
    data?: any,
  ) => Promise<{ success: boolean; message: string; data?: any }>
  deviceStates: any
  refreshDeviceStates: () => Promise<void>
}

const Esp32Context = createContext<Esp32ContextType | undefined>(undefined)

export function Esp32Provider({ children }: { children: ReactNode }) {
  const [esp32Ip, setEsp32IpState] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [deviceStates, setDeviceStates] = useState<any>(null)
  const { toast } = useToast()

  // Load ESP32 IP from backend on mount
  useEffect(() => {
    const loadEsp32Ip = async () => {
      try {
        const response = await fetch("/api/esp32")
        const data = await response.json()
        if (data.success && data.ip) {
          setEsp32IpState(data.ip)
        }
      } catch (error) {
        console.error("Failed to load ESP32 IP:", error)
      }
    }
    loadEsp32Ip()
  }, [])

  const setEsp32Ip = async (ip: string | null) => {
    try {
      if (ip) {
        const cleanIp = ip.trim().replace(/\s+/g, "")
        const response = await fetch("/api/esp32", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setIp", ip: cleanIp }),
        })

        const data = await response.json()
        if (data.success) {
          setEsp32IpState(cleanIp)
          setIsConnected(false)
          setDeviceStates(null)
        } else {
          toast({ title: "Error", description: data.message, variant: "destructive" })
        }
      } else {
        setEsp32IpState(null)
        setIsConnected(false)
        setDeviceStates(null)
      }
    } catch (error) {
      console.error("Failed to set ESP32 IP:", error)
      toast({ title: "Error", description: "Failed to set ESP32 IP address", variant: "destructive" })
    }
  }

  const testConnection = useCallback(async () => {
    if (!esp32Ip) {
      toast({ title: "Error", description: "ESP32 IP Address not set.", variant: "destructive" })
      setIsConnected(false)
      return false
    }

    try {
      const response = await fetch("/api/esp32", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "testConnection" }),
      })

      const data = await response.json()
      if (data.success) {
        toast({ title: "Success", description: data.message })
        setIsConnected(true)
        if (data.data) {
          setDeviceStates(data.data)
        }
        return true
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" })
        setIsConnected(false)
        return false
      }
    } catch (error) {
      console.error("Connection test error:", error)
      toast({ title: "Error", description: "Failed to test connection", variant: "destructive" })
      setIsConnected(false)
      return false
    }
  }, [esp32Ip, toast])

  const sendCommand = async (
    endpoint: string,
    method = "GET",
    data?: any,
  ): Promise<{ success: boolean; message: string; data?: any }> => {
    if (!esp32Ip) {
      return { success: false, message: "ESP32 IP Address not set." }
    }

    try {
      const response = await fetch("/api/esp32", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sendCommand",
          endpoint,
          method,
          data,
        }),
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error("Send command error:", error)
      return { success: false, message: "Failed to send command to ESP32" }
    }
  }

  const refreshDeviceStates = useCallback(async () => {
    if (!esp32Ip || !isConnected) return

    try {
      const result = await sendCommand("/api/status")
      if (result.success && result.data) {
        setDeviceStates(result.data)
      }
    } catch (error) {
      console.error("Failed to refresh device states:", error)
    }
  }, [esp32Ip, isConnected])

  useEffect(() => {
    if (esp32Ip) {
      testConnection()
    }
  }, [esp32Ip, testConnection])

  return (
    <Esp32Context.Provider
      value={{
        esp32Ip,
        setEsp32Ip,
        isConnected,
        testConnection,
        sendCommand,
        deviceStates,
        refreshDeviceStates,
      }}
    >
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
