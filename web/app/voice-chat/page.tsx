import { GoogleGenerativeAI } from "@google/generative-ai"
import { type NextRequest, NextResponse } from "next/server"

// Function to check if the input contains Sirius or similar wake words
function containsSiriusWakeWord(input: string): boolean {
  const normalizedInput = input.toLowerCase().trim()
  
  // List of Sirius variations and similar words
  const siriusVariations = [
    'sirius',
    'serious',
    'syrius',
    'cyrius',
    'sirus',
    'sirous',
    'serius',
    'sirious',
    'hey sirius',
    'ok sirius',
    'sirius,',
    'sirius.'
  ]
  
  // Check if any variation is found
  return siriusVariations.some(variation => 
    normalizedInput.includes(variation) || 
    normalizedInput.startsWith(variation) ||
    normalizedInput === variation
  )
}

// Function to remove Sirius wake word from the command
function removeSiriusWakeWord(input: string): string {
  let cleanInput = input.toLowerCase().trim()
  
  const siriusVariations = [
    'hey sirius',
    'ok sirius',
    'sirius,',
    'sirius.',
    'sirius',
    'serious',
    'syrius',
    'cyrius',
    'sirus',
    'sirous',
    'serius',
    'sirious'
  ]
  
  // Remove the wake word and clean up
  for (const variation of siriusVariations) {
    if (cleanInput.startsWith(variation)) {
      cleanInput = cleanInput.substring(variation.length).trim()
      break
    }
    if (cleanInput.includes(variation)) {
      cleanInput = cleanInput.replace(variation, '').trim()
      break
    }
  }
  
  // Remove leading punctuation and extra spaces
  cleanInput = cleanInput.replace(/^[,.\s]+/, '').trim()
  
  return cleanInput || input // Return original if cleaning resulted in empty string
}

export async function POST(req: NextRequest) {
  try {
    const { message: userInput } = await req.json()

    if (!userInput?.trim()) {
      return NextResponse.json({ error: "User input is required." }, { status: 400 })
    }

    // Check if the input contains Sirius wake word
    const hasSiriusWakeWord = containsSiriusWakeWord(userInput)
    
    // If no Sirius wake word is detected, respond with a gentle prompt
    if (!hasSiriusWakeWord) {
      return NextResponse.json({
        type: "conversation",
        message: "I'm listening! Try starting your command with 'Sirius' or 'Hey Sirius' to activate smart home controls."
      })
    }

    // Remove the wake word to get the actual command
    const actualCommand = removeSiriusWakeWord(userInput)

    // Initialize the Google Generative AI with the API key
    const genAI = new GoogleGenerativeAI(process.env.GeminiApiKey || "no api key")
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const prompt = `
      You are Sirius, an AI assistant for a smart home system controlled by an ESP32.
      The user has activated you with a wake word, and now you need to process their command.
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

      - If the user's query is a general question, greeting, or something not related to a direct command, respond conversationally as Sirius.
        In this case, respond with ONLY a JSON object:
        {"type": "conversation", "message": "Your conversational response here."}
        Example: User says "Hello". You respond: {"type": "conversation", "message": "Hello! I'm Sirius, your smart home assistant. How can I help you today?"}

      - If the user's command is ambiguous or unclear, ask for clarification.
        Respond with ONLY a JSON object:
        {"type": "clarification", "message": "Your clarification question here."}
        Example: User says "Turn off the light". You respond: {"type": "clarification", "message": "Which light would you like me to turn off? The garage, room 1, or room 2 light?"}

      - If the user's query is a command but for an unsupported action or device, inform them.
        Respond with ONLY a JSON object:
        {"type": "error", "message": "Sorry, I can't perform that action. I can control the garage, window, door, specific LEDs, and the buzzer."}

      IMPORTANT: 
      - Respond with ONLY the JSON object, no additional text or explanation.
      - You are Sirius, so respond in character when having conversations.
      - Be helpful and friendly in your responses.

      User command (wake word already removed): "${actualCommand}"
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