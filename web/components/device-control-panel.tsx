"use client"

import { useState, useEffect } from "react"
import { useEsp32 } from "@/app/contexts/esp32-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, DoorOpen, Wind, BarcodeIcon as Garage, Lightbulb, Volume2 } from "lucide-react"

export function DeviceControlPanel() {
  const { sendCommand, isConnected, esp32Ip } = useEsp32()
  const [isLoading, setIsLoading] = useState(false)
  const [deviceStates, setDeviceStates] = useState<any>(null)
  const { toast } = useToast()

  const refreshDeviceStates = async () => {
    if (!isConnected || !esp32Ip) return

    setIsLoading(true)
    try {
      const result = await sendCommand("/api/status")
      if (result.success && result.data) {
        setDeviceStates(result.data)
      }
    } catch (error) {
      console.error("Failed to refresh device states:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected) {
      refreshDeviceStates()
    }
  }, [isConnected])

  const handleCommand = async (endpoint: string, description: string) => {
    setIsLoading(true)
    try {
      const result = await sendCommand(endpoint)
      if (result.success) {
        toast({ title: "Success", description: result.message })
        refreshDeviceStates()
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: `Failed to ${description}`, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  if (!esp32Ip || !isConnected) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Device Control</CardTitle>
          <CardDescription>Connect to ESP32 to control your devices</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-40">
          <p className="text-muted-foreground">Please connect to your ESP32 device first</p>
        </CardContent>
      </Card>
    )
  }

  const garageOpen = deviceStates?.garage?.open || false
  const windowOpen = deviceStates?.window?.open || false
  const doorOpen = deviceStates?.door?.open || false
  const garageLedOn = deviceStates?.leds?.garage || false
  const room1LedOn = deviceStates?.leds?.room1 || false
  const room2LedOn = deviceStates?.leds?.room2 || false

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <span>Smart Home Control</span>
          {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
        </CardTitle>
        <CardDescription>Control your ESP32 connected devices</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Garage Control */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Garage className="mr-2 h-5 w-5 text-primary" />
                Garage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span>Status: {garageOpen ? "Open" : "Closed"}</span>
                <div className="space-x-2">
                  <Button
                    size="sm"
                    variant={garageOpen ? "outline" : "default"}
                    onClick={() => handleCommand("/api/garage/open", "open garage")}
                    disabled={isLoading || garageOpen}
                  >
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant={!garageOpen ? "outline" : "default"}
                    onClick={() => handleCommand("/api/garage/close", "close garage")}
                    disabled={isLoading || !garageOpen}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Window Control */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Wind className="mr-2 h-5 w-5 text-primary" />
                Window
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span>Status: {windowOpen ? "Open" : "Closed"}</span>
                <div className="space-x-2">
                  <Button
                    size="sm"
                    variant={windowOpen ? "outline" : "default"}
                    onClick={() => handleCommand("/api/window/open", "open window")}
                    disabled={isLoading || windowOpen}
                  >
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant={!windowOpen ? "outline" : "default"}
                    onClick={() => handleCommand("/api/window/close", "close window")}
                    disabled={isLoading || !windowOpen}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Door Control */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <DoorOpen className="mr-2 h-5 w-5 text-primary" />
                Door
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span>Status: {doorOpen ? "Open" : "Closed"}</span>
                <div className="space-x-2">
                  <Button
                    size="sm"
                    variant={doorOpen ? "outline" : "default"}
                    onClick={() => handleCommand("/api/door/open", "open door")}
                    disabled={isLoading || doorOpen}
                  >
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant={!doorOpen ? "outline" : "default"}
                    onClick={() => handleCommand("/api/door/close", "close door")}
                    disabled={isLoading || !doorOpen}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lights Control */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Lightbulb className="mr-2 h-5 w-5 text-primary" />
                Lights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="garage-led">Garage Light</Label>
                <Switch
                  id="garage-led"
                  checked={garageLedOn}
                  onCheckedChange={(checked) =>
                    handleCommand(checked ? "/api/led/garage/on" : "/api/led/garage/off", "toggle garage light")
                  }
                  disabled={isLoading}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="room1-led">Room 1 Light</Label>
                <Switch
                  id="room1-led"
                  checked={room1LedOn}
                  onCheckedChange={(checked) =>
                    handleCommand(checked ? "/api/led/room1/on" : "/api/led/room1/off", "toggle room 1 light")
                  }
                  disabled={isLoading}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="room2-led">Room 2 Light</Label>
                <Switch
                  id="room2-led"
                  checked={room2LedOn}
                  onCheckedChange={(checked) =>
                    handleCommand(checked ? "/api/led/room2/on" : "/api/led/room2/off", "toggle room 2 light")
                  }
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Buzzer Control */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Volume2 className="mr-2 h-5 w-5 text-primary" />
                Buzzer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="buzzer-switch">Buzzer</Label>
                  <Switch
                    id="buzzer-switch"
                    checked={deviceStates?.buzzer?.on || false}
                    onCheckedChange={(checked) =>
                      handleCommand(checked ? "/api/buzzer/on" : "/api/buzzer/off", "toggle buzzer")
                    }
                    disabled={isLoading}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCommand("/api/buzzer/beep", "beep buzzer")}
                  disabled={isLoading}
                >
                  Beep Once
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Refresh Button */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">System</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <Button variant="outline" onClick={() => refreshDeviceStates()} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refresh Status
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
