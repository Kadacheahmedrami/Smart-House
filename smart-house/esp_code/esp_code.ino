#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>

// WiFi credentials
const char* ssid = "rami";
const char* password = "ramirami";

// Pin definitions
#define ULTRASONIC_TRIG 5
#define ULTRASONIC_ECHO 18
#define GAS_SENSOR 35
#define GARAGE_SERVO 2
#define WINDOW_SERVO 15
#define DOOR_SERVO 4
#define RFID_SS 21
#define RFID_RST 22

// LEDs and Buzzer
#define GARAGE_LED 13
#define ROOM1_LED 12
#define ROOM2_LED 14
#define BUZZER 27

// Servo objects
Servo garageServo;
Servo windowServo;
Servo doorServo;

// RFID
MFRC522 rfid(RFID_SS, RFID_RST);

// Web server
WebServer server(80);

// System states
bool garageOpen = false;
bool windowOpen = false;
bool doorOpen = false;
bool garageLedOn = false;
bool room1LedOn = false;
bool room2LedOn = false;
int gasThreshold = 2500; // Adjust based on your sensor

// Valid RFID card UID (change this to your card's UID)
byte validCard[4] = {0x12, 0x34, 0x56, 0x78};

void setup() {
  Serial.begin(115200);
  Serial.println("=== ESP32 Smart Home System Starting ===");
  
  // Initialize pins
  pinMode(ULTRASONIC_TRIG, OUTPUT);
  pinMode(ULTRASONIC_ECHO, INPUT);
  pinMode(GAS_SENSOR, INPUT);
  Serial.println("[SETUP] Sensor pins initialized");
  
  // Initialize LEDs and buzzer
  pinMode(GARAGE_LED, OUTPUT);
  pinMode(ROOM1_LED, OUTPUT);
  pinMode(ROOM2_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  Serial.println("[SETUP] LED and buzzer pins initialized");
  
  // Turn off all LEDs initially
  digitalWrite(GARAGE_LED, LOW);
  digitalWrite(ROOM1_LED, LOW);
  digitalWrite(ROOM2_LED, LOW);
  digitalWrite(BUZZER, LOW);
  Serial.println("[SETUP] All LEDs and buzzer turned off");
  
  // Initialize servos
  garageServo.attach(GARAGE_SERVO);
  windowServo.attach(WINDOW_SERVO);
  doorServo.attach(DOOR_SERVO);
  Serial.println("[SETUP] Servos attached to pins");
  
  // Close all initially
  garageServo.write(0);   // 0 = closed, 90 = open
  windowServo.write(0);
  doorServo.write(0);
  Serial.println("[SETUP] All servos set to closed position (0 degrees)");
  
  // Initialize RFID
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("[SETUP] RFID module initialized");
  
  // Connect to WiFi
  Serial.println("[WIFI] Connecting to WiFi network: " + String(ssid));
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("[WIFI] WiFi connected successfully!");
  Serial.print("[WIFI] IP address: ");
  Serial.println(WiFi.localIP());
  
  // Setup web server endpoints
  setupEndpoints();
  server.begin();
  Serial.println("[SERVER] Web server started and ready for requests");
  Serial.println("=== System Ready ===");
}

void loop() {
  server.handleClient();
  
  // Auto garage control with ultrasonic
  autoGarageControl();
  
  // Auto window control with gas sensor
  autoWindowControl();
  
  // Check RFID for door control
  checkRFIDForDoor();
  
  delay(100);
}

// Ultrasonic distance measurement
float getDistance() {
  digitalWrite(ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG, LOW);
  
  long duration = pulseIn(ULTRASONIC_ECHO, HIGH);
  float distance = duration * 0.034 / 2;
  return distance;
}

// Auto garage control
void autoGarageControl() {
  float distance = getDistance();
  
  if (distance <= 10 && !garageOpen) {
    Serial.println("[AUTO-GARAGE] Object detected at " + String(distance) + "cm - Opening garage");
    openGarage();
  }
  else if (distance > 50 && garageOpen) {
    Serial.println("[AUTO-GARAGE] Object moved away (distance: " + String(distance) + "cm) - Closing garage");
    closeGarage();
  }
}

// Auto window control based on gas sensor
void autoWindowControl() {
  int gasLevel = analogRead(GAS_SENSOR);
  
  if (gasLevel > gasThreshold && !windowOpen) {
    Serial.println("[AUTO-WINDOW] Gas detected (level: " + String(gasLevel) + ") - Opening window");
    openWindow();
  }
  else if (gasLevel < (gasThreshold - 50) && windowOpen) {
    Serial.println("[AUTO-WINDOW] Air quality good (gas level: " + String(gasLevel) + ") - Closing window");
    closeWindow();
  }
}

// Check RFID for door control
void checkRFIDForDoor() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  Serial.print("[RFID] Card detected - UID: ");
  for (int i = 0; i < 4; i++) {
    Serial.print(rfid.uid.uidByte[i], HEX);
    if (i < 3) Serial.print(":");
  }
  Serial.println();
  
  // Check if card matches
  bool cardValid = true;
  for (int i = 0; i < 4; i++) {
    if (rfid.uid.uidByte[i] != validCard[i]) {
      cardValid = false;
      break;
    }
  }
  
  if (cardValid) {
    if (!doorOpen) {
      Serial.println("[RFID] Valid card - Opening door");
      openDoor();
    } else {
      Serial.println("[RFID] Valid card - Closing door");
      closeDoor();
    }
  } else {
    Serial.println("[RFID] Invalid card - Access denied");
  }
  
  rfid.PICC_HaltA();
}

void openGarage() {
  Serial.println("[ACTION] Opening garage door");
  garageServo.write(90);
  garageOpen = true;
  digitalWrite(GARAGE_LED, HIGH);
  garageLedOn = true;
  Serial.println("[ACTION] Garage door opened, LED turned on");
  playBuzzer(2); // 2 beeps for garage open
}

void closeGarage() {
  Serial.println("[ACTION] Closing garage door");
  garageServo.write(0);
  garageOpen = false;
  digitalWrite(GARAGE_LED, LOW);
  garageLedOn = false;
  Serial.println("[ACTION] Garage door closed, LED turned off");
  playBuzzer(1); // 1 beep for garage close
}

void openWindow() {
  Serial.println("[ACTION] Opening window");
  windowServo.write(90);
  windowOpen = true;
  digitalWrite(ROOM1_LED, HIGH);
  room1LedOn = true;
  Serial.println("[ACTION] Window opened, Room 1 LED turned on");
  playBuzzer(3); // 3 beeps for window open
}

void closeWindow() {
  Serial.println("[ACTION] Closing window");
  windowServo.write(0);
  windowOpen = false;
  digitalWrite(ROOM1_LED, LOW);
  room1LedOn = false;
  Serial.println("[ACTION] Window closed, Room 1 LED turned off");
  playBuzzer(1); // 1 beep for window close
}

void openDoor() {
  Serial.println("[ACTION] Opening door");
  doorServo.write(90);
  doorOpen = true;
  digitalWrite(ROOM2_LED, HIGH);
  room2LedOn = true;
  Serial.println("[ACTION] Door opened, Room 2 LED turned on");
  playBuzzer(2); // 2 beeps for door open
}

void closeDoor() {
  Serial.println("[ACTION] Closing door");
  doorServo.write(0);
  doorOpen = false;
  digitalWrite(ROOM2_LED, LOW);
  room2LedOn = false;
  Serial.println("[ACTION] Door closed, Room 2 LED turned off");
  playBuzzer(1); // 1 beep for door close
}

// LED control functions
void garageLedon() {
  Serial.println("[LED] Turning on garage LED");
  digitalWrite(GARAGE_LED, HIGH);
  garageLedOn = true;
}

void garageLedoff() {
  Serial.println("[LED] Turning off garage LED");
  digitalWrite(GARAGE_LED, LOW);
  garageLedOn = false;
}

void room1Ledon() {
  Serial.println("[LED] Turning on room 1 LED");
  digitalWrite(ROOM1_LED, HIGH);
  room1LedOn = true;
}

void room1Ledoff() {
  Serial.println("[LED] Turning off room 1 LED");
  digitalWrite(ROOM1_LED, LOW);
  room1LedOn = false;
}

void room2Ledon() {
  Serial.println("[LED] Turning on room 2 LED");
  digitalWrite(ROOM2_LED, HIGH);
  room2LedOn = true;
}

void room2Ledoff() {
  Serial.println("[LED] Turning off room 2 LED");
  digitalWrite(ROOM2_LED, LOW);
  room2LedOn = false;
}

// Buzzer control function
void playBuzzer(int beeps) {
  Serial.println("[BUZZER] Playing " + String(beeps) + " beep(s)");
  for (int i = 0; i < beeps; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(200);
    digitalWrite(BUZZER, LOW);
    delay(200);
  }
}

void buzzerOn() {
  Serial.println("[BUZZER] Turning buzzer ON");
  digitalWrite(BUZZER, HIGH);
}

void buzzerOff() {
  Serial.println("[BUZZER] Turning buzzer OFF");
  digitalWrite(BUZZER, LOW);
}

// Add CORS headers to all responses
void addCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  server.sendHeader("Access-Control-Max-Age", "3600"); // Cache preflight for 1 hour
}

// Handle OPTIONS requests for any endpoint
void handleOptions() {
  addCORSHeaders();
  server.send(200, "text/plain", "");
}

// Setup web server endpoints
void setupEndpoints() {
  Serial.println("[SERVER] Setting up API endpoints...");
  
  // Handle OPTIONS requests for ALL endpoints
  server.on("/api/garage/open", HTTP_OPTIONS, handleOptions);
  server.on("/api/garage/close", HTTP_OPTIONS, handleOptions);
  server.on("/api/window/open", HTTP_OPTIONS, handleOptions);
  server.on("/api/window/close", HTTP_OPTIONS, handleOptions);
  server.on("/api/door/open", HTTP_OPTIONS, handleOptions);
  server.on("/api/door/close", HTTP_OPTIONS, handleOptions);
  server.on("/api/led/garage/on", HTTP_OPTIONS, handleOptions);
  server.on("/api/led/garage/off", HTTP_OPTIONS, handleOptions);
  server.on("/api/led/room1/on", HTTP_OPTIONS, handleOptions);
  server.on("/api/led/room1/off", HTTP_OPTIONS, handleOptions);
  server.on("/api/led/room2/on", HTTP_OPTIONS, handleOptions);
  server.on("/api/led/room2/off", HTTP_OPTIONS, handleOptions);
  server.on("/api/buzzer/on", HTTP_OPTIONS, handleOptions);
  server.on("/api/buzzer/off", HTTP_OPTIONS, handleOptions);
  server.on("/api/buzzer/beep", HTTP_OPTIONS, handleOptions);
  server.on("/api/status", HTTP_OPTIONS, handleOptions);
  server.on("/api/control", HTTP_OPTIONS, handleOptions);
  
  // Handle 404 and OPTIONS for unknown endpoints
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      handleOptions();
    } else {
      addCORSHeaders();
      server.send(404, "application/json", "{\"status\":\"error\",\"message\":\"Endpoint not found\"}");
    }
  });
  
  // Garage endpoints
  server.on("/api/garage/open", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/garage/open - Request received");
    openGarage();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Garage opened\"}");
    Serial.println("[API] Response sent: Garage opened");
  });
  
  server.on("/api/garage/close", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/garage/close - Request received");
    closeGarage();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Garage closed\"}");
    Serial.println("[API] Response sent: Garage closed");
  });
  
  // Window endpoints
  server.on("/api/window/open", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/window/open - Request received");
    openWindow();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Window opened\"}");
    Serial.println("[API] Response sent: Window opened");
  });
  
  server.on("/api/window/close", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/window/close - Request received");
    closeWindow();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Window closed\"}");
    Serial.println("[API] Response sent: Window closed");
  });
  
  // Door endpoints
  server.on("/api/door/open", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/door/open - Request received");
    openDoor();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Door opened\"}");
    Serial.println("[API] Response sent: Door opened");
  });
  
  server.on("/api/door/close", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/door/close - Request received");
    closeDoor();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Door closed\"}");
    Serial.println("[API] Response sent: Door closed");
  });
  
  // LED control endpoints
  server.on("/api/led/garage/on", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/led/garage/on - Request received");
    garageLedon();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Garage LED turned on\"}");
    Serial.println("[API] Response sent: Garage LED turned on");
  });
  
  server.on("/api/led/garage/off", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/led/garage/off - Request received");
    garageLedoff();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Garage LED turned off\"}");
    Serial.println("[API] Response sent: Garage LED turned off");
  });
  
  server.on("/api/led/room1/on", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/led/room1/on - Request received");
    room1Ledon();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Room 1 LED turned on\"}");
    Serial.println("[API] Response sent: Room 1 LED turned on");
  });
  
  server.on("/api/led/room1/off", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/led/room1/off - Request received");
    room1Ledoff();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Room 1 LED turned off\"}");
    Serial.println("[API] Response sent: Room 1 LED turned off");
  });
  
  server.on("/api/led/room2/on", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/led/room2/on - Request received");
    room2Ledon();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Room 2 LED turned on\"}");
    Serial.println("[API] Response sent: Room 2 LED turned on");
  });
  
  server.on("/api/led/room2/off", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/led/room2/off - Request received");
    room2Ledoff();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Room 2 LED turned off\"}");
    Serial.println("[API] Response sent: Room 2 LED turned off");
  });
  
  // Buzzer control endpoints
  server.on("/api/buzzer/on", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/buzzer/on - Request received");
    buzzerOn();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Buzzer turned on\"}");
    Serial.println("[API] Response sent: Buzzer turned on");
  });
  
  server.on("/api/buzzer/off", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/buzzer/off - Request received");
    buzzerOff();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Buzzer turned off\"}");
    Serial.println("[API] Response sent: Buzzer turned off");
  });
  
  server.on("/api/buzzer/beep", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/buzzer/beep - Request received");
    playBuzzer(1);
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Buzzer beeped\"}");
    Serial.println("[API] Response sent: Buzzer beeped");
  });
  
  // Status endpoint
  server.on("/api/status", HTTP_GET, []() {
    addCORSHeaders();
    Serial.println("[API] GET /api/status - Request received");
    DynamicJsonDocument doc(1024);
    
    float currentDistance = getDistance();
    int currentGasLevel = analogRead(GAS_SENSOR);
    
    doc["status"] = "online";
    doc["ip"] = WiFi.localIP().toString();
    
    // Format the response to match what the web app expects
    doc["devices"]["garage"]["open"] = garageOpen;
    doc["devices"]["window"]["open"] = windowOpen;
    doc["devices"]["door"]["open"] = doorOpen;
    doc["devices"]["garage_led"]["on"] = garageLedOn;
    doc["devices"]["room1_led"]["on"] = room1LedOn;
    doc["devices"]["room2_led"]["on"] = room2LedOn;
    doc["devices"]["buzzer"]["on"] = (digitalRead(BUZZER) == HIGH);
    
    // Additional sensor data
    doc["sensors"]["ultrasonic"] = currentDistance;
    doc["sensors"]["gas"] = currentGasLevel;
    
    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
    Serial.println("[API] Status response sent - Distance: " + String(currentDistance) + "cm, Gas: " + String(currentGasLevel));
  });
  
  // Control endpoint for AI chatbot
  server.on("/api/control", HTTP_POST, []() {
    addCORSHeaders();
    Serial.println("[API] POST /api/control - Request received");
    
    if (server.hasArg("plain")) {
      String requestBody = server.arg("plain");
      Serial.println("[API] Request body: " + requestBody);
      
      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, requestBody);
      
      if (error) {
        Serial.println("[API] ERROR: JSON parsing failed");
        server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Invalid JSON format\"}");
        return;
      }
      
      String action = doc["action"];
      String target = doc["target"];
      Serial.println("[API] Action: " + action + ", Target: " + target);
      
      String message = "";
      bool success = true;
      
      if (target == "garage") {
        if (action == "open") {
          openGarage();
          message = "Garage opened";
        } else if (action == "close") {
          closeGarage();
          message = "Garage closed";
        } else {
          success = false;
          message = "Unknown action for garage: " + action;
        }
      }
      else if (target == "window") {
        if (action == "open") {
          openWindow();
          message = "Window opened";
        } else if (action == "close") {
          closeWindow();
          message = "Window closed";
        } else {
          success = false;
          message = "Unknown action for window: " + action;
        }
      }
      else if (target == "door") {
        if (action == "open") {
          openDoor();
          message = "Door opened";
        } else if (action == "close") {
          closeDoor();
          message = "Door closed";
        } else {
          success = false;
          message = "Unknown action for door: " + action;
        }
      }
      else if (target == "garage_led") {
        if (action == "on") {
          garageLedon();
          message = "Garage LED turned on";
        } else if (action == "off") {
          garageLedoff();
          message = "Garage LED turned off";
        } else {
          success = false;
          message = "Unknown action for garage LED: " + action;
        }
      }
      else if (target == "room1_led") {
        if (action == "on") {
          room1Ledon();
          message = "Room 1 LED turned on";
        } else if (action == "off") {
          room1Ledoff();
          message = "Room 1 LED turned off";
        } else {
          success = false;
          message = "Unknown action for room 1 LED: " + action;
        }
      }
      else if (target == "room2_led") {
        if (action == "on") {
          room2Ledon();
          message = "Room 2 LED turned on";
        } else if (action == "off") {
          room2Ledoff();
          message = "Room 2 LED turned off";
        } else {
          success = false;
          message = "Unknown action for room 2 LED: " + action;
        }
      }
      else if (target == "buzzer") {
        if (action == "on") {
          buzzerOn();
          message = "Buzzer turned on";
        } else if (action == "off") {
          buzzerOff();
          message = "Buzzer turned off";
        } else if (action == "beep") {
          playBuzzer(1);
          message = "Buzzer beeped";
        } else {
          success = false;
          message = "Unknown action for buzzer: " + action;
        }
      }
      else {
        success = false;
        message = "Unknown target: " + target;
      }
      
      if (success) {
        server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"" + message + "\"}");
      } else {
        server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"" + message + "\"}");
      }
      Serial.println("[API] Control response sent: " + message);
    } else {
      Serial.println("[API] ERROR: Invalid request - no body found");
      server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Invalid request - no body data\"}");
    }
  });
  
  Serial.println("[SERVER] All API endpoints configured successfully");
}
