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
#define GAS_SENSOR 36
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
int gasThreshold = 300; // Adjust based on your sensor

// Valid RFID card UID (change this to your card's UID)
byte validCard[4] = {0x12, 0x34, 0x56, 0x78};

void setup() {
  Serial.begin(115200);
  
  // Initialize pins
  pinMode(ULTRASONIC_TRIG, OUTPUT);
  pinMode(ULTRASONIC_ECHO, INPUT);
  pinMode(GAS_SENSOR, INPUT);
  
  // Initialize LEDs and buzzer
  pinMode(GARAGE_LED, OUTPUT);
  pinMode(ROOM1_LED, OUTPUT);
  pinMode(ROOM2_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  
  // Turn off all LEDs initially
  digitalWrite(GARAGE_LED, LOW);
  digitalWrite(ROOM1_LED, LOW);
  digitalWrite(ROOM2_LED, LOW);
  digitalWrite(BUZZER, LOW);
  
  // Initialize servos
  garageServo.attach(GARAGE_SERVO);
  windowServo.attach(WINDOW_SERVO);
  doorServo.attach(DOOR_SERVO);
  
  // Close all initially
  garageServo.write(0);   // 0 = closed, 90 = open
  windowServo.write(0);
  doorServo.write(0);
  
  // Initialize RFID
  SPI.begin();
  rfid.PCD_Init();
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("WiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  
  // Setup web server endpoints
  setupEndpoints();
  server.begin();
  Serial.println("Web server started");
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
    openGarage();
    Serial.println("Auto: Garage opened - object detected at " + String(distance) + "cm");
  }
  else if (distance > 50 && garageOpen) {
    closeGarage();
    Serial.println("Auto: Garage closed - object moved away");
  }
}

// Auto window control based on gas sensor
void autoWindowControl() {
  int gasLevel = analogRead(GAS_SENSOR);
  
  if (gasLevel > gasThreshold && !windowOpen) {
    openWindow();
    Serial.println("Auto: Window opened - gas detected: " + String(gasLevel));
  }
  else if (gasLevel < (gasThreshold - 50) && windowOpen) {
    closeWindow();
    Serial.println("Auto: Window closed - air quality good");
  }
}

// Check RFID for door control
void checkRFIDForDoor() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }
  
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
      openDoor();
      Serial.println("RFID: Door opened - valid card detected");
    } else {
      closeDoor();
      Serial.println("RFID: Door closed - valid card detected");
    }
  } else {
    Serial.println("RFID: Invalid card detected");
  }
  
  rfid.PICC_HaltA();
}

void openGarage() {
  garageServo.write(90);
  garageOpen = true;
  digitalWrite(GARAGE_LED, HIGH);
  garageLedOn = true;
  playBuzzer(2); // 2 beeps for garage open
}

void closeGarage() {
  garageServo.write(0);
  garageOpen = false;
  digitalWrite(GARAGE_LED, LOW);
  garageLedOn = false;
  playBuzzer(1); // 1 beep for garage close
}

void openWindow() {
  windowServo.write(90);
  windowOpen = true;
  digitalWrite(ROOM1_LED, HIGH);
  room1LedOn = true;
  playBuzzer(3); // 3 beeps for window open
}

void closeWindow() {
  windowServo.write(0);
  windowOpen = false;
  digitalWrite(ROOM1_LED, LOW);
  room1LedOn = false;
  playBuzzer(1); // 1 beep for window close
}

void openDoor() {
  doorServo.write(90);
  doorOpen = true;
  digitalWrite(ROOM2_LED, HIGH);
  room2LedOn = true;
  playBuzzer(2); // 2 beeps for door open
}

void closeDoor() {
  doorServo.write(0);
  doorOpen = false;
  digitalWrite(ROOM2_LED, LOW);
  room2LedOn = false;
  playBuzzer(1); // 1 beep for door close
}

// LED control functions
void garageLedon() {
  digitalWrite(GARAGE_LED, HIGH);
  garageLedOn = true;
}

void garageLedoff() {
  digitalWrite(GARAGE_LED, LOW);
  garageLedOn = false;
}

void room1Ledon() {
  digitalWrite(ROOM1_LED, HIGH);
  room1LedOn = true;
}

void room1Ledoff() {
  digitalWrite(ROOM1_LED, LOW);
  room1LedOn = false;
}

void room2Ledon() {
  digitalWrite(ROOM2_LED, HIGH);
  room2LedOn = true;
}

void room2Ledoff() {
  digitalWrite(ROOM2_LED, LOW);
  room2LedOn = false;
}

// Buzzer control function
void playBuzzer(int beeps) {
  for (int i = 0; i < beeps; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(200);
    digitalWrite(BUZZER, LOW);
    delay(200);
  }
}

void buzzerOn() {
  digitalWrite(BUZZER, HIGH);
}

void buzzerOff() {
  digitalWrite(BUZZER, LOW);
}

// Setup web server endpoints
void setupEndpoints() {
  // Enable CORS for all endpoints
  server.enableCORS(true);
  
  // Garage endpoints
  server.on("/api/garage/open", HTTP_GET, []() {
    openGarage();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Garage opened\"}");
  });
  
  server.on("/api/garage/close", HTTP_GET, []() {
    closeGarage();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Garage closed\"}");
  });
  
  // Window endpoints
  server.on("/api/window/open", HTTP_GET, []() {
    openWindow();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Window opened\"}");
  });
  
  server.on("/api/window/close", HTTP_GET, []() {
    closeWindow();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Window closed\"}");
  });
  
  // Door endpoints
  server.on("/api/door/open", HTTP_GET, []() {
    openDoor();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Door opened\"}");
  });
  
  server.on("/api/door/close", HTTP_GET, []() {
    closeDoor();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Door closed\"}");
  });
  
  // LED control endpoints
  server.on("/api/led/garage/on", HTTP_GET, []() {
    garageLedon();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Garage LED turned on\"}");
  });
  
  server.on("/api/led/garage/off", HTTP_GET, []() {
    garageLedoff();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Garage LED turned off\"}");
  });
  
  server.on("/api/led/room1/on", HTTP_GET, []() {
    room1Ledon();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Room 1 LED turned on\"}");
  });
  
  server.on("/api/led/room1/off", HTTP_GET, []() {
    room1Ledoff();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Room 1 LED turned off\"}");
  });
  
  server.on("/api/led/room2/on", HTTP_GET, []() {
    room2Ledon();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Room 2 LED turned on\"}");
  });
  
  server.on("/api/led/room2/off", HTTP_GET, []() {
    room2Ledoff();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Room 2 LED turned off\"}");
  });
  
  // Buzzer control endpoints
  server.on("/api/buzzer/on", HTTP_GET, []() {
    buzzerOn();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Buzzer turned on\"}");
  });
  
  server.on("/api/buzzer/off", HTTP_GET, []() {
    buzzerOff();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Buzzer turned off\"}");
  });
  
  server.on("/api/buzzer/beep", HTTP_GET, []() {
    playBuzzer(1);
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Buzzer beeped\"}");
  });
  
  // Status endpoint
  server.on("/api/status", HTTP_GET, []() {
    DynamicJsonDocument doc(1024);
    
    doc["garage"]["open"] = garageOpen;
    doc["garage"]["distance"] = getDistance();
    doc["garage"]["led"] = garageLedOn;
    
    doc["window"]["open"] = windowOpen;
    doc["window"]["gasLevel"] = analogRead(GAS_SENSOR);
    doc["window"]["led"] = room1LedOn;
    
    doc["door"]["open"] = doorOpen;
    doc["door"]["led"] = room2LedOn;
    
    doc["sensors"]["ultrasonic"] = getDistance();
    doc["sensors"]["gas"] = analogRead(GAS_SENSOR);
    
    doc["leds"]["garage"] = garageLedOn;
    doc["leds"]["room1"] = room1LedOn;
    doc["leds"]["room2"] = room2LedOn;
    
    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
  });
  
  // Control endpoint for AI chatbot
  server.on("/api/control", HTTP_POST, []() {
    if (server.hasArg("plain")) {
      DynamicJsonDocument doc(1024);
      deserializeJson(doc, server.arg("plain"));
      
      String action = doc["action"];
      String target = doc["target"];
      
      String message = "";
      
      if (target == "garage") {
        if (action == "open") {
          openGarage();
          message = "Garage opened";
        } else if (action == "close") {
          closeGarage();
          message = "Garage closed";
        }
      }
      else if (target == "window") {
        if (action == "open") {
          openWindow();
          message = "Window opened";
        } else if (action == "close") {
          closeWindow();
          message = "Window closed";
        }
      }
      else if (target == "door") {
        if (action == "open") {
          openDoor();
          message = "Door opened";
        } else if (action == "close") {
          closeDoor();
          message = "Door closed";
        }
      }
      else if (target == "garage_led") {
        if (action == "on") {
          garageLedon();
          message = "Garage LED turned on";
        } else if (action == "off") {
          garageLedoff();
          message = "Garage LED turned off";
        }
      }
      else if (target == "room1_led") {
        if (action == "on") {
          room1Ledon();
          message = "Room 1 LED turned on";
        } else if (action == "off") {
          room1Ledoff();
          message = "Room 1 LED turned off";
        }
      }
      else if (target == "room2_led") {
        if (action == "on") {
          room2Ledon();
          message = "Room 2 LED turned on";
        } else if (action == "off") {
          room2Ledoff();
          message = "Room 2 LED turned off";
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
        }
      }
      
      server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"" + message + "\"}");
    } else {
      server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Invalid request\"}");
    }
  });
}