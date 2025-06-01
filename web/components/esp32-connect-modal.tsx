"use client"

import { useState } from "react"
import { useEsp32 } from "@/app/contexts/esp32-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Wifi, Zap, XCircle, CheckCircle2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export function Esp32ConnectModal() {
  const { esp32Ip, setEsp32Ip, isConnected, testConnection } = useEsp32()
  const [currentIp, setCurrentIp] = useState(esp32Ip || "")
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    // Trim any whitespace from the IP address
    const trimmedIp = currentIp.trim()
    if (!trimmedIp) {
      toast({ title: "Error", description: "Please enter a valid IP address", variant: "destructive" })
      return
    }

    setEsp32Ip(trimmedIp)
    const success = await testConnection()
    if (success) {
      setIsOpen(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      setCurrentIp(esp32Ip || "") // Reset input to current IP when dialog opens
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Wifi className="h-5 w-5" />
          {esp32Ip && (
            <span
              className={`absolute top-0 right-0 block h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] glass-effect">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Zap className="mr-2 h-5 w-5 text-primary" /> Connect to ESP32
          </DialogTitle>
          <DialogDescription>Enter the IP address of your ESP32 device to control your smart home.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="esp32-ip" className="text-right">
              IP Address
            </Label>
            <Input
              id="esp32-ip"
              value={currentIp}
              onChange={(e) => setCurrentIp(e.target.value)}
              placeholder="e.g., 192.168.1.100"
              className="col-span-3"
            />
          </div>
          {esp32Ip && (
            <div className="flex items-center justify-center space-x-2 text-sm">
              {isConnected ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span>
                Current status: {isConnected ? `Connected to ${esp32Ip}` : `Disconnected or ${esp32Ip} unreachable`}
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => testConnection()}>
            Test Connection
          </Button>
          <Button onClick={handleSave}>Save & Connect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
