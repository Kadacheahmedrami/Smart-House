import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Mic, Zap } from "lucide-react"
import Link from "next/link"
import { DeviceControlPanel } from "@/components/device-control-panel"

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center space-y-8">
      <div className="text-center mb-4">
        <Zap className="h-24 w-24 text-primary mx-auto mb-4 animate-pulse" />
        <h1 className="text-5xl font-bold tracking-tight">ESP32 AI Home Control</h1>
        <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
          Seamlessly control your ESP32-powered smart home devices using intuitive text or voice commands, powered by
          cutting-edge AI.
        </p>
      </div>

      <DeviceControlPanel />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <Card className="hover:shadow-primary/20 hover:shadow-lg transition-shadow duration-300 glass-effect">
          <CardHeader>
            <div className="flex items-center space-x-3 mb-2">
              <MessageCircle className="h-8 w-8 text-primary" />
              <CardTitle className="text-2xl">Text Chat Control</CardTitle>
            </div>
            <CardDescription>
              Type commands to interact with your smart home devices. Quick, easy, and efficient.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/chat" passHref>
              <Button className="w-full" size="lg">
                Open Text Chat
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-primary/20 hover:shadow-lg transition-shadow duration-300 glass-effect">
          <CardHeader>
            <div className="flex items-center space-x-3 mb-2">
              <Mic className="h-8 w-8 text-primary" />
              <CardTitle className="text-2xl">Voice Chat Control</CardTitle>
            </div>
            <CardDescription>
              Speak your commands naturally. Our AI understands your intent for hands-free control.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/voice-chat" passHref>
              <Button className="w-full" size="lg">
                Open Voice Chat
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Ensure your ESP32 is connected and the IP address is configured in the header settings.
      </p>
    </div>
  )
}
