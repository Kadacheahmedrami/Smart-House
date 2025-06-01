import { type NextRequest, NextResponse } from "next/server"

// Store ESP32 IP in memory (you could use a database or environment variable)
let esp32Ip: string | null = null

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, endpoint, method = "GET", ip, data } = body
    
    // Handle IP configuration
    if (action === "setIp") {
      if (!ip) {
        return NextResponse.json({ success: false, message: "IP address is required" }, { status: 400 })
      }
      esp32Ip = ip.trim().replace(/\s+/g, "")
      return NextResponse.json({ success: true, message: "ESP32 IP address set successfully" })
    }

    // Handle connection test
    if (action === "testConnection") {
      if (!esp32Ip) {
        return NextResponse.json({ success: false, message: "ESP32 IP address not configured" }, { status: 400 })
      }

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`http://${esp32Ip}/api/status`, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          return NextResponse.json({
            success: true,
            message: "Connected to ESP32 successfully",
            data,
            ip: esp32Ip,
          })
        } else {
          return NextResponse.json(
            {
              success: false,
              message: `Failed to connect to ESP32 (status: ${response.status})`,
            },
            { status: response.status },
          )
        }
      } catch (error: any) {
        console.error("ESP32 connection test error:", error)
        let errorMessage = "Could not reach ESP32. Check IP and network."
        if (error.name === "AbortError") {
          errorMessage = "Connection timeout. ESP32 may be offline."
        }
        return NextResponse.json({ success: false, message: errorMessage }, { status: 500 })
      }
    }

    // Handle ESP32 commands
    if (action === "sendCommand") {
      if (!esp32Ip) {
        return NextResponse.json({ success: false, message: "ESP32 IP address not configured" }, { status: 400 })
      }

      if (!endpoint) {
        return NextResponse.json({ success: false, message: "Endpoint is required" }, { status: 400 })
      }

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const options: RequestInit = {
          method: method.toUpperCase(),
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        }

        if (data && method.toUpperCase() !== "GET") {
          options.body = JSON.stringify(data)
        }

        const url = `http://${esp32Ip}${endpoint}`
        console.log(`[ESP32 PROXY] ${method.toUpperCase()} ${url}`, data ? `Body: ${JSON.stringify(data)}` : "")

        const response = await fetch(url, options)
        clearTimeout(timeoutId)

        const responseData = await response.json().catch(() => ({}))

        console.log(`[ESP32 PROXY] Response: ${response.status}`, responseData)

        if (response.ok) {
          return NextResponse.json({
            success: true,
            message: responseData.message || "Command executed successfully",
            data: responseData,
          })
        } else {
          return NextResponse.json(
            {
              success: false,
              message: responseData.message || `ESP32 returned error (status: ${response.status})`,
              data: responseData,
            },
            { status: response.status },
          )
        }
      } catch (error: any) {
        console.error("ESP32 command error:", error)
        let errorMessage = "Error communicating with ESP32"
        if (error.name === "AbortError") {
          errorMessage = "Command timeout. ESP32 may be busy or offline."
        } else if (error.code === "ECONNREFUSED") {
          errorMessage = "ESP32 connection refused. Check if device is online."
        } else if (error.code === "ENOTFOUND") {
          errorMessage = "ESP32 not found. Check IP address."
        }
        return NextResponse.json({ success: false, message: errorMessage }, { status: 500 })
      }
    }

    // Handle get current IP
    if (action === "getIp") {
      return NextResponse.json({
        success: true,
        ip: esp32Ip,
        message: esp32Ip ? `Current ESP32 IP: ${esp32Ip}` : "No ESP32 IP configured",
      })
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("ESP32 API error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Return current ESP32 IP and status
  return NextResponse.json({
    success: true,
    ip: esp32Ip,
    message: esp32Ip ? `Current ESP32 IP: ${esp32Ip}` : "No ESP32 IP configured",
  })
}
