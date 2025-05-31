import { GoogleGenerativeAI } from "@google/generative-ai"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { message: userInput } = await req.json()

    if (!userInput?.trim()) {
      return NextResponse.json({ error: "User input is required." }, { status: 400 })
    }

    // Initialize the Google Generative AI with the API key
    const genAI = new GoogleGenerativeAI(process.env.GeminiApiKey || "no api key")
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const prompt = `
      You are an AI assistant for a smart home system controlled by an ESP32.
      Your goal is to understand the user's command and translate it into a specific action for the ESP32, or respond conversationally if it's not a command.

      Available devices and actions (target names are case-sensitive as used in the ESP32 API):
      - Garage: "open", "close" (target: "garage")
      - Window: "open", "close" (target: "window")
      - Door: "open", "close" (target: "door")
      - Garage LED: "on", "off" (target: "garage_led")
      - Room 1 LED: "on", "off" (target: "room1_led")
      - Room 2 LED: "on", "off" (target: "room2_led")
      - Buzzer: "on", "off", "beep" (target: "buzzer")

      Response Format:
      - If the user's query is a command for one of the above actions, respond with ONLY a JSON object:
        {"type": "action", "command": {"action": "ACTION_NAME", "target": "TARGET_NAME"}}
        Example: User says "Turn on the garage light". You respond: {"type": "action", "command": {"action": "on", "target": "garage_led"}}

      - If the user's query is a general question, greeting, or something not related to a direct command, respond conversationally.
        In this case, respond with ONLY a JSON object:
        {"type": "conversation", "message": "Your conversational response here."}
        Example: User says "Hello". You respond: {"type": "conversation", "message": "Hello! How can I assist with your smart home today?"}

      - If the user's command is ambiguous or unclear, ask for clarification.
        Respond with ONLY a JSON object:
        {"type": "clarification", "message": "Your clarification question here."}
        Example: User says "Turn off the light". You respond: {"type": "clarification", "message": "Which light would you like to turn off? The garage, room 1, or room 2 light?"}

      - If the user's query is a command but for an unsupported action or device, inform them.
        Respond with ONLY a JSON object:
        {"type": "error", "message": "Sorry, I can't perform that action. I can control garage, window, door, specific LEDs, and the buzzer."}

      IMPORTANT: Respond with ONLY the JSON object, no additional text or explanation.

      User query: "${userInput}"
    `

    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()

    // Clean up the response text to extract just the JSON
    let cleanResponse = responseText
    
    // Remove markdown code blocks if present
    if (cleanResponse.includes('```json')) {
      cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '')
    } else if (cleanResponse.includes('```')) {
      cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '')
    }
    
    // Remove any extra text before or after the JSON
    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanResponse = jsonMatch[0]
    }

    try {
      const jsonResponse = JSON.parse(cleanResponse)
      
      // Validate the response structure
      if (!jsonResponse.type) {
        throw new Error("Invalid response structure")
      }
      
      return NextResponse.json(jsonResponse)
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", responseText, parseError)
      
      // Fallback response
      return NextResponse.json({
        type: "conversation",
        message: "I had trouble understanding that command. Could you try rephrasing it?",
      })
    }
  } catch (error) {
    console.error("Error in smart home API:", error)
    return NextResponse.json({ 
      error: "Internal server error processing your request.",
      details: String(error)
    }, { status: 500 })
  }
}