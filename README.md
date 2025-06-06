# 🏠 Smart House System with ESP32

[![ESP32](https://img.shields.io/badge/ESP32-Powered-blue?style=for-the-badge&logo=espressif)](https://espressif.com/)
[![Arduino](https://img.shields.io/badge/Arduino-Compatible-green?style=for-the-badge&logo=arduino)](https://arduino.cc/)
[![Next.js](https://img.shields.io/badge/Next.js-AI_Chatbot-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)

> **Transform your home into a smart, automated living space with AI-powered voice control, automated sensors, and seamless integration!**

## 🚀 Features

### 🤖 **AI-Powered Control**
- **Natural Language Commands**: "Open garage door", "Turn on room lights"
- **Next.js Chatbot Integration**: Chat with your house!
- **RESTful API**: Full remote control capabilities

### 🏡 **Smart Automation**
- **🚗 Auto Garage**: Opens when car approaches (15cm detection)
- **🪟 Smart Window**: Auto-opens when gas/smoke detected
- **🚪 RFID Door Lock**: Secure access with contactless cards
- **💡 Intelligent Lighting**: Auto LEDs with visual feedback
- **🔊 Audio Alerts**: Buzzer notifications for all actions

### 📱 **Remote Monitoring**
- **Real-time Status**: Monitor all sensors and devices
- **Mobile Friendly**: Control from anywhere with internet
- **Security Alerts**: Instant notifications for gas/intrusion

## 🛠️ Hardware Components

| Component | Quantity | Purpose |
|-----------|----------|---------|
| **ESP32 DevKit** | 1 | Main controller |
| **Servo Motors (SG90)** | 3 | Garage, window, door control |
| **Ultrasonic Sensor (HC-SR04)** | 1 | Distance detection |
| **Gas Sensor (MQ-2/MQ-135)** | 1 | Air quality monitoring |
| **RFID Reader (RC522)** | 1 | Access control |
| **LEDs** | 3 | Status indicators |
| **Buzzer** | 1 | Audio feedback |

## 🔌 Pin Configuration

```cpp
// Sensors & Actuators
#define ULTRASONIC_TRIG 5    // Distance sensor trigger
#define ULTRASONIC_ECHO 18   // Distance sensor echo
#define GAS_SENSOR 36        // Air quality (analog)

// Servo Motors
#define GARAGE_SERVO 2       // Garage door control
#define WINDOW_SERVO 15      // Window control  
#define DOOR_SERVO 4         // House door control

// RFID Module
#define RFID_SS 21           // SPI slave select
#define RFID_RST 22          // Reset pin

// Indicators & Alerts
#define GARAGE_LED 13        // Garage status LED
#define ROOM1_LED 12         // Room 1 status LED
#define ROOM2_LED 14         // Room 2 status LED
#define BUZZER 27            // Audio feedback
```

## 📡 API Endpoints

### 🏠 **Device Control**
```http
GET /api/garage/open         # Open garage door
GET /api/garage/close        # Close garage door
GET /api/window/open         # Open window
GET /api/window/close        # Close window
GET /api/door/open           # Open house door
GET /api/door/close          # Close house door
```

### 💡 **LED Control**
```http
GET /api/led/garage/on       # Turn on garage LED
GET /api/led/garage/off      # Turn off garage LED
GET /api/led/room1/on        # Turn on room 1 LED
GET /api/led/room1/off       # Turn off room 1 LED
GET /api/led/room2/on        # Turn on room 2 LED
GET /api/led/room2/off       # Turn off room 2 LED
```

### 🔊 **Audio Control**
```http
GET /api/buzzer/on           # Turn on buzzer
GET /api/buzzer/off          # Turn off buzzer
GET /api/buzzer/beep         # Single beep
```

### 📊 **System Status**
```http
GET /api/status              # Get all sensor readings & device states
```

### 🤖 **AI Chatbot Integration**
```http
POST /api/control
Content-Type: application/json

{
  "action": "open",
  "target": "garage"
}
```

## 🧠 Smart Automation Logic

### 🚗 **Garage System**
- **Auto Open**: When object detected ≤ 15cm
- **Auto Close**: When object moves away > 50cm
- **Visual**: LED indicates garage status
- **Audio**: 2 beeps open, 1 beep close

### 🪟 **Window System**  
- **Auto Open**: When gas levels exceed threshold
- **Auto Close**: When air quality improves
- **Safety**: Prevents gas buildup indoors

### 🚪 **Door System**
- **RFID Access**: Secure contactless entry
- **Toggle Mode**: Same card opens/closes
- **Security**: Invalid card attempts logged

## 🚀 Quick Start

### 1. **Hardware Setup**
```bash
# Connect components according to pin configuration
# Ensure proper power supply (5V for servos, 3.3V for sensors)
```

### 2. **Software Installation**
```bash
# Install Arduino IDE libraries:
# - ESP32Servo
# - MFRC522  
# - ArduinoJson
# - WiFi (built-in)
```

### 3. **Configuration**
```cpp
// Update WiFi credentials
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// Set your RFID card UID
byte validCard[4] = {0x12, 0x34, 0x56, 0x78};
```

### 4. **Upload & Test**
```bash
# Upload code to ESP32
# Check Serial Monitor for IP address
# Test endpoints: http://ESP32_IP/api/status
```

## 🎯 Next.js Integration Example

```javascript
// Example chatbot integration
const controlDevice = async (action, target) => {
  const response = await fetch(`http://${ESP32_IP}/api/control`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, target })
  });
  
  const result = await response.json();
  return result.message;
};

// Usage examples:
await controlDevice('open', 'garage');        // "Garage opened"
await controlDevice('on', 'garage_led');      // "Garage LED turned on"  
await controlDevice('beep', 'buzzer');        // "Buzzer beeped"
```

## 🔒 Security Features

- **🔐 RFID Authentication**: Secure physical access
- **🛡️ WiFi Encryption**: WPA2/WPA3 protected network
- **🚨 Intrusion Detection**: Motion and access logging
- **⚠️ Safety Alerts**: Gas leak detection & emergency response

## 🎨 Customization

### **Add New Devices**
```cpp
// Add new servo/sensor
#define NEW_DEVICE_PIN 26
// Update endpoints and control logic
```

### **Modify Automation**
```cpp
// Change thresholds
int gasThreshold = 300;        // Gas sensitivity
float triggerDistance = 15.0;  // Garage trigger distance
```

### **Expand RFID Cards**
```cpp
// Multiple valid cards
byte validCards[][4] = {
  {0x12, 0x34, 0x56, 0x78},  // Family member 1
  {0xAB, 0xCD, 0xEF, 0x12}   // Family member 2
};
```

## 🏗️ System Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Next.js App   │◄──►│     WiFi     │◄──►│     ESP32       │
│   (Chatbot)     │    │   Network    │    │  (Controller)   │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
                           ┌─────────────────────────┼─────────────────────────┐
                           │                         │                         │
                    ┌──────▼──────┐         ┌───────▼────────┐       ┌────────▼────────┐
                    │   Sensors   │         │    Actuators   │       │   Indicators    │
                    │• Ultrasonic │         │• Servo Motors  │       │• Status LEDs    │
                    │• Gas Sensor │         │• Garage Door   │       │• Audio Buzzer   │
                    │• RFID Reader│         │• Window/Door   │       │• Visual Alerts  │
                    └─────────────┘         └────────────────┘       └─────────────────┘
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** your feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Espressif Systems** for the amazing ESP32 platform
- **Arduino Community** for extensive library support
- **Next.js Team** for the powerful React framework
- **IoT Enthusiasts** worldwide for inspiration and support

---

<div align="center">

**Made with ❤️ for Smart Home Automation**

[![GitHub stars](https://img.shields.io/github/stars/yourusername/smart-house-esp32?style=social)](https://github.com/yourusername/smart-house-esp32)
[![GitHub forks](https://img.shields.io/github/forks/yourusername/smart-house-esp32?style=social)](https://github.com/yourusername/smart-house-esp32)

</div>
