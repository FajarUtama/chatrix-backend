# Voice & Video Call Requirements

## 📋 Overview

Dokumen ini menjelaskan semua komponen yang diperlukan untuk implementasi voice dan video call di aplikasi Chatrix.

## 🏗️ Arsitektur Call System

```
User A (Caller)          Backend API          MQTT/WebSocket          User B (Callee)
    |                         |                         |                     |
    |-- Initiate Call ------->|                         |                     |
    |                         |-- Create Call Log       |                     |
    |                         |-- Publish MQTT -------->|                     |
    |                         |                         |-- Forward -------->|
    |                         |                         |                     |-- Receive Call
    |                         |                         |                     |
    |                         |<-- WebRTC Signaling ----|                     |
    |<-- Call State Update ---|                         |<-- ICE Candidates -|
    |                         |                         |                     |
    |-- WebRTC Connection ----|                         |-- WebRTC Connection|
    |                         |                         |                     |
    |<===================== P2P Media Stream ===================>|
    |                         |                         |                     |
    |-- End Call ------------>|                         |                     |
    |                         |-- Update Call Log       |                     |
    |                         |-- Publish MQTT -------->|                     |
    |                         |                         |-- Forward -------->|
    |                         |                         |                     |-- Call Ended
```

## 🔧 Komponen yang Diperlukan

### 1. Backend Components

#### 1.1 Call State Management
- **Initiate Call** - Membuat call request
- **Accept Call** - Menerima call
- **Reject Call** - Menolak call
- **End Call** - Mengakhiri call
- **Cancel Call** - Membatalkan call (sebelum answered)

#### 1.2 Call Logging (Sudah Ada ✅)
- Log call history
- Track call duration
- Store call metadata

#### 1.3 Real-Time Signaling
- **MQTT Topics** untuk call signaling:
  - `call/{userId}/incoming` - Incoming call notification
  - `call/{userId}/state` - Call state updates
  - `call/{callId}/offer` - WebRTC offer
  - `call/{callId}/answer` - WebRTC answer
  - `call/{callId}/ice-candidate` - ICE candidate exchange
  - `call/{callId}/end` - Call ended notification

### 2. WebRTC Components

#### 2.1 STUN Server
**Purpose:** NAT traversal untuk peer-to-peer connection

**Options:**
- **Google STUN:** `stun:stun.l.google.com:19302` (free)
- **Twilio STUN:** `stun:global.stun.twilio.com:3478` (free)
- **Custom STUN:** Self-hosted (coturn)

**Configuration:**
```javascript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];
```

#### 2.2 TURN Server (Required for Firewall/NAT)
**Purpose:** Relay media traffic jika P2P tidak memungkinkan

**Options:**
- **Twilio TURN:** Paid service
- **Coturn:** Self-hosted (open source)
- **Metered TURN:** Paid service

**Configuration:**
```javascript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:turn.example.com:3478',
    username: 'username',
    credential: 'password'
  }
];
```

### 3. Frontend Components

#### 3.1 WebRTC API
- `RTCPeerConnection` - WebRTC connection
- `getUserMedia()` - Access microphone/camera
- `createOffer()` - Create SDP offer
- `createAnswer()` - Create SDP answer
- `setLocalDescription()` - Set local SDP
- `setRemoteDescription()` - Set remote SDP
- `addIceCandidate()` - Add ICE candidate

#### 3.2 Signaling Client
- MQTT client untuk real-time signaling
- WebSocket client (alternatif)

### 4. Database Schema (Sudah Ada ✅)

**CallLog Schema:**
```typescript
{
  caller_id: string,
  callee_id: string,
  type: 'voice' | 'video',
  started_at?: Date,
  ended_at?: Date,
  status: 'ringing' | 'answered' | 'missed' | 'rejected' | 'failed',
  created_at: Date,
  updated_at: Date
}
```

## 📡 MQTT Topics untuk Call Signaling

### 1. Incoming Call Notification
**Topic:** `call/{userId}/incoming`

**Payload:**
```json
{
  "call_id": "call_123456",
  "caller_id": "60d5ec9f5824f70015a1c001",
  "caller_name": "John Doe",
  "caller_avatar": "https://example.com/avatar.jpg",
  "type": "video",
  "timestamp": "2023-04-10T22:00:00.000Z"
}
```

**When:** Sent when caller initiates call

**Receiver:** Callee (userId in topic)

---

### 2. Call State Update
**Topic:** `call/{userId}/state`

**Payload:**
```json
{
  "call_id": "call_123456",
  "state": "ringing" | "answered" | "rejected" | "ended" | "missed" | "failed",
  "timestamp": "2023-04-10T22:00:00.000Z"
}
```

**When:** Sent when call state changes

**Receiver:** Both caller and callee

---

### 3. WebRTC Offer
**Topic:** `call/{callId}/offer`

**Payload:**
```json
{
  "call_id": "call_123456",
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
  },
  "caller_id": "60d5ec9f5824f70015a1c001",
  "callee_id": "60d5ec9f5824f70015a1c002"
}
```

**When:** Sent when caller creates WebRTC offer

**Receiver:** Callee

---

### 4. WebRTC Answer
**Topic:** `call/{callId}/answer`

**Payload:**
```json
{
  "call_id": "call_123456",
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n..."
  },
  "caller_id": "60d5ec9f5824f70015a1c001",
  "callee_id": "60d5ec9f5824f70015a1c002"
}
```

**When:** Sent when callee accepts call and creates answer

**Receiver:** Caller

---

### 5. ICE Candidate Exchange
**Topic:** `call/{callId}/ice-candidate`

**Payload:**
```json
{
  "call_id": "call_123456",
  "candidate": {
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  },
  "from_user_id": "60d5ec9f5824f70015a1c001"
}
```

**When:** Sent when ICE candidate is discovered

**Receiver:** Other participant

---

### 6. Call Ended
**Topic:** `call/{callId}/end`

**Payload:**
```json
{
  "call_id": "call_123456",
  "ended_by": "60d5ec9f5824f70015a1c001",
  "reason": "user_ended" | "timeout" | "error",
  "duration": 330,
  "timestamp": "2023-04-10T22:05:30.000Z"
}
```

**When:** Sent when call ends

**Receiver:** Both caller and callee

---

## 🔄 Call Flow

### Flow 1: Successful Call

```
1. Caller initiates call
   POST /calls/initiate
   ↓
2. Backend creates call log (status: 'ringing')
   ↓
3. Backend publishes MQTT → call/{calleeId}/incoming
   ↓
4. Callee receives incoming call notification
   ↓
5. Callee accepts call
   POST /calls/{callId}/accept
   ↓
6. Backend updates call log (status: 'answered')
   ↓
7. Caller creates WebRTC offer
   ↓
8. Backend publishes MQTT → call/{callId}/offer
   ↓
9. Callee receives offer, creates answer
   ↓
10. Backend publishes MQTT → call/{callId}/answer
    ↓
11. ICE candidates exchanged via MQTT
    ↓
12. WebRTC connection established (P2P)
    ↓
13. Media stream flows directly between peers
    ↓
14. Call ends
    POST /calls/{callId}/end
    ↓
15. Backend updates call log (status: 'ended', duration calculated)
    ↓
16. Backend publishes MQTT → call/{callId}/end
```

### Flow 2: Rejected Call

```
1. Caller initiates call
   ↓
2. Callee receives incoming call notification
   ↓
3. Callee rejects call
   POST /calls/{callId}/reject
   ↓
4. Backend updates call log (status: 'rejected')
   ↓
5. Backend publishes MQTT → call/{callId}/state
   ↓
6. Caller receives rejection notification
```

### Flow 3: Missed Call

```
1. Caller initiates call
   ↓
2. Callee receives incoming call notification
   ↓
3. Call timeout (30-60 seconds)
   ↓
4. Backend updates call log (status: 'missed')
   ↓
5. Backend publishes MQTT → call/{callId}/state
```

## 🛠️ Backend Implementation Requirements

### Endpoints yang Diperlukan

#### 1. Initiate Call
**POST** `/calls/initiate`

**Request:**
```json
{
  "callee_id": "60d5ec9f5824f70015a1c002",
  "type": "video"
}
```

**Response:**
```json
{
  "call_id": "call_123456",
  "caller_id": "60d5ec9f5824f70015a1c001",
  "callee_id": "60d5ec9f5824f70015a1c002",
  "type": "video",
  "status": "ringing",
  "created_at": "2023-04-10T22:00:00.000Z"
}
```

**Actions:**
- Create call log (status: 'ringing')
- Publish MQTT to `call/{calleeId}/incoming`
- Return call_id for signaling

---

#### 2. Accept Call
**POST** `/calls/:callId/accept`

**Response:**
```json
{
  "call_id": "call_123456",
  "status": "answered",
  "answered_at": "2023-04-10T22:00:05.000Z"
}
```

**Actions:**
- Update call log (status: 'answered', started_at: now)
- Publish MQTT to `call/{callId}/state`

---

#### 3. Reject Call
**POST** `/calls/:callId/reject`

**Response:**
```json
{
  "call_id": "call_123456",
  "status": "rejected",
  "rejected_at": "2023-04-10T22:00:03.000Z"
}
```

**Actions:**
- Update call log (status: 'rejected')
- Publish MQTT to `call/{callId}/state`

---

#### 4. End Call
**POST** `/calls/:callId/end`

**Response:**
```json
{
  "call_id": "call_123456",
  "status": "ended",
  "ended_at": "2023-04-10T22:05:30.000Z",
  "duration": 330
}
```

**Actions:**
- Update call log (status: 'ended', ended_at: now, calculate duration)
- Publish MQTT to `call/{callId}/end`

---

#### 5. Cancel Call
**POST** `/calls/:callId/cancel`

**Response:**
```json
{
  "call_id": "call_123456",
  "status": "cancelled",
  "cancelled_at": "2023-04-10T22:00:02.000Z"
}
```

**Actions:**
- Update call log (status: 'cancelled')
- Publish MQTT to `call/{callId}/state`

---

#### 6. Send WebRTC Offer
**POST** `/calls/:callId/offer`

**Request:**
```json
{
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
  }
}
```

**Actions:**
- Validate call exists and user is participant
- Publish MQTT to `call/{callId}/offer`

---

#### 7. Send WebRTC Answer
**POST** `/calls/:callId/answer`

**Request:**
```json
{
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n..."
  }
}
```

**Actions:**
- Validate call exists and user is participant
- Publish MQTT to `call/{callId}/answer`

---

#### 8. Send ICE Candidate
**POST** `/calls/:callId/ice-candidate`

**Request:**
```json
{
  "candidate": {
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  }
}
```

**Actions:**
- Validate call exists and user is participant
- Publish MQTT to `call/{callId}/ice-candidate`

---

#### 9. Get Call History (Sudah Ada ✅)
**GET** `/calls/history`

---

#### 10. Get Active Call
**GET** `/calls/active`

**Response:**
```json
{
  "call_id": "call_123456",
  "caller_id": "60d5ec9f5824f70015a1c001",
  "callee_id": "60d5ec9f5824f70015a1c002",
  "type": "video",
  "status": "answered",
  "started_at": "2023-04-10T22:00:05.000Z"
}
```

---

## 🔐 Security & Validation

### Checks Required

1. **User Authentication**
   - Verify user is authenticated
   - Verify user is participant in call

2. **Block Status**
   - Check if caller/callee is blocked
   - Prevent calls between blocked users

3. **Call State Validation**
   - Only accept call if status is 'ringing'
   - Only end call if status is 'answered'
   - Prevent duplicate calls

4. **Rate Limiting**
   - Limit number of calls per user per time period
   - Prevent call spam

## 📊 Call States

| State | Description | Transitions To |
|-------|-------------|----------------|
| **ringing** | Call initiated, waiting for answer | answered, rejected, missed, cancelled |
| **answered** | Call accepted, connection established | ended |
| **rejected** | Call rejected by callee | (final) |
| **missed** | Call not answered (timeout) | (final) |
| **cancelled** | Call cancelled by caller | (final) |
| **failed** | Call failed (error) | (final) |
| **ended** | Call ended normally | (final) |

## 🌐 Infrastructure Requirements

### 1. STUN Server (Required)
- **Purpose:** NAT traversal
- **Options:** Google STUN (free), Twilio STUN (free), Custom STUN
- **Cost:** Free (public STUN) or self-hosted

### 2. TURN Server (Recommended)
- **Purpose:** Relay media if P2P fails
- **Options:** Twilio TURN (paid), Coturn (self-hosted), Metered TURN (paid)
- **Cost:** Paid service or self-hosted infrastructure

### 3. MQTT Broker (Sudah Ada ✅)
- **Purpose:** Real-time signaling
- **Current:** MQTT service already implemented

### 4. Database (Sudah Ada ✅)
- **Purpose:** Call logging
- **Current:** MongoDB with CallLog schema

## 📱 Frontend Requirements

### 1. WebRTC API Support
- Browser support for WebRTC
- Mobile SDK support (WebRTC for mobile)

### 2. Media Permissions
- Microphone permission (voice & video)
- Camera permission (video only)

### 3. Signaling Client
- MQTT client for call signaling
- Subscribe to call topics

### 4. UI Components
- Call screen (incoming/outgoing)
- Call controls (mute, video on/off, end call)
- Call history screen

## 🚀 Implementation Priority

### Phase 1: Basic Call (Minimum)
- [x] Call logging (already exists)
- [ ] Initiate call endpoint
- [ ] Accept/Reject call endpoints
- [ ] End call endpoint
- [ ] MQTT signaling for call state
- [ ] Frontend: Basic call UI

### Phase 2: WebRTC Integration
- [ ] WebRTC offer/answer endpoints
- [ ] ICE candidate exchange
- [ ] STUN server configuration
- [ ] Frontend: WebRTC implementation

### Phase 3: Advanced Features
- [ ] TURN server integration
- [ ] Call quality monitoring
- [ ] Call recording (optional)
- [ ] Group calls (future)

## 📝 Current Status

### ✅ Already Implemented
- Call logging (POST /calls/log)
- Call history (GET /calls/history)
- CallLog schema with status tracking
- MQTT infrastructure

### ❌ Not Yet Implemented
- Call initiation endpoint
- Call state management endpoints
- WebRTC signaling endpoints
- MQTT topics for call signaling
- Call timeout handling
- Active call tracking

## 🔗 Related Documentation

- WebRTC Specification: https://www.w3.org/TR/webrtc/
- STUN/TURN: https://datatracker.ietf.org/doc/html/rfc8489
- Coturn Server: https://github.com/coturn/coturn

---

**Note:** Implementasi call memerlukan koordinasi antara backend (signaling) dan frontend (WebRTC). Backend hanya menangani signaling, sedangkan media stream mengalir langsung peer-to-peer antara users.

