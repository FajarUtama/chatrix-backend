# Backend Real-Time Chat Schema

## 📋 Overview

Dokumen ini menjelaskan skema lengkap real-time chat di backend, termasuk flow pengiriman pesan, mark as read, dan MQTT topics yang digunakan.

## 🏗️ Arsitektur Real-Time Chat

```
User A (Sender)          Backend API          MQTT Broker          User B (Receiver)
    |                         |                     |                     |
    |-- Send Message -------->|                     |                     |
    |                         |-- Create Message ---|                     |
    |                         |-- Update Conv ------|                     |
    |                         |-- Publish MQTT ----->|                     |
    |                         |                     |-- Forward -------->|
    |                         |                     |                     |-- Receive Message
    |                         |                     |                     |
    |                         |                     |<-- Read Receipt ---|
    |                         |<-- Mark as Read ----|                     |
    |                         |-- Publish Read ----->|                     |
    |<-- Read Receipt --------|                     |-- Forward -------->|
    |                         |                     |                     |
```

## 📨 Flow 1: Pengiriman Pesan Baru

### Endpoint
**POST** `/chat/messages`

### Request Body
```json
{
  "conversationId": "80d5ec9f5824f70015a1c004",
  "content": "Hello, how are you?",
  "type": "text",
  "attachments": []
}
```

### Backend Flow

1. **Validasi & Create Message**
   ```typescript
   - Verify conversation exists
   - Check block status
   - Create message document in database
   - Set status: 'sent'
   - Set sent_at: now
   ```

2. **Update Conversation**
   ```typescript
   - Update last_message_at: now
   - Update last_message_preview: message text
   ```

3. **Publish MQTT Message**
   ```typescript
   Topic: chat/{recipientId}/messages
   Payload: {
     conversation_id: "...",
     message: {
       id: "...",
       sender_id: "...",
       type: "text",
       text: "Hello, how are you?",
       media: null,
       status: "sent",
       created_at: "2023-04-10T19:00:00.000Z"
     }
   }
   ```

### Sequence Diagram

```
User A                    Backend                    MQTT                    User B
  |                          |                         |                        |
  |-- POST /messages ------->|                         |                        |
  |                          |-- Create Message        |                        |
  |                          |-- Update Conversation   |                        |
  |                          |-- Publish MQTT -------->|                        |
  |                          |                         |-- Forward ----------->|
  |                          |                         |                        |-- Receive
  |<-- 201 Created ----------|                         |                        |
```

## ✅ Flow 2: Mark as Read (Auto-Read)

### Trigger 1: GET Messages (First Page)
**GET** `/chat/conversations/:id/messages` (tanpa parameter `before`)

### Backend Flow

1. **Load Messages**
   ```typescript
   - Query messages from database
   - Sort by created_at DESC
   - Limit: 20 (default)
   ```

2. **Auto-Mark as Read** (jika `!before`)
   ```typescript
   - Find unread messages (status: 'sent' or 'delivered')
   - Update status to 'read'
   - Set read_at: now
   - Add userId to read_by array
   ```

3. **Publish MQTT Read Receipts** (3 topics)

   **a. Read Receipt untuk Sender**
   ```typescript
   Topic: chat/{senderId}/read-receipts
   Payload: {
     conversation_id: "...",
     read_by: "userId",
     read_at: "2023-04-10T19:00:00.000Z",
     count: 5
   }
   ```

   **b. Message Status Update untuk Reader**
   ```typescript
   Topic: chat/{userId}/messages-status
   Payload: {
     conversation_id: "...",
     action: "marked_as_read",
     read_by: "userId",
     read_at: "2023-04-10T19:00:00.000Z",
     count: 5
   }
   ```

   **c. Conversation Update untuk List Chat**
   ```typescript
   Topic: chat/{participantId}/conversations
   Payload: {
     conversation_id: "...",
     action: "messages_read",
     read_by: "userId",
     read_at: "2023-04-10T19:00:00.000Z",
     unread_count: 0
   }
   ```

### Trigger 2: Ensure Conversation
**POST** `/chat/conversations/ensure`

### Backend Flow

1. **Create or Get Conversation**
   ```typescript
   - Find existing conversation
   - Or create new conversation
   ```

2. **Auto-Mark as Read**
   ```typescript
   - Same as above: mark unread messages as read
   - Publish same 3 MQTT topics
   ```

### Trigger 3: View Conversation (Real-Time)
**POST** `/chat/conversations/:id/view`

### Backend Flow

1. **Mark as Read**
   ```typescript
   - Same as above: mark unread messages as read
   - Publish same 3 MQTT topics
   ```

### Sequence Diagram

```
User B                    Backend                    MQTT                    User A
  |                          |                         |                        |
  |-- GET /messages --------->|                         |                        |
  |                          |-- Load Messages         |                        |
  |                          |-- Mark as Read          |                        |
  |                          |-- Publish Read Receipt ->|                        |
  |                          |                         |-- Forward ----------->|
  |<-- 200 OK ---------------|                         |                        |-- Receive
  |                          |                         |                        |-- Update UI
```

## 📡 MQTT Topics Schema

### 1. New Message
**Topic:** `chat/{userId}/messages`

**Payload Structure:**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "message": {
    "id": "90d5ec9f5824f70015a1c007",
    "sender_id": "60d5ec9f5824f70015a1c001",
    "type": "text",
    "text": "Hello!",
    "media": null,
    "status": "sent",
    "created_at": "2023-04-10T19:00:00.000Z"
  }
}
```

**When:** Sent immediately after message is created

**Receiver:** Recipient user (userId in topic)

---

### 2. Read Receipt (untuk Sender)
**Topic:** `chat/{userId}/read-receipts`

**Payload Structure:**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "read_by": "60d5ec9f5824f70015a1c002",
  "read_at": "2023-04-10T19:00:00.000Z",
  "count": 5
}
```

**When:** Sent immediately after messages are marked as read

**Receiver:** Sender of the messages (userId in topic)

**Use Case:** Update message status from "sent"/"delivered" to "read" in sender's chat detail

---

### 3. Message Status Update (untuk Reader)
**Topic:** `chat/{userId}/messages-status`

**Payload Structure:**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "action": "marked_as_read",
  "read_by": "60d5ec9f5824f70015a1c002",
  "read_at": "2023-04-10T19:00:00.000Z",
  "count": 5
}
```

**When:** Sent immediately after messages are marked as read

**Receiver:** Reader (userId in topic)

**Use Case:** Update message status in reader's chat detail (optional)

---

### 4. Conversation Update (untuk List Chat)
**Topic:** `chat/{userId}/conversations`

**Payload Structure (New Message):**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "last_message_at": "2023-04-10T19:00:00.000Z",
  "last_message_preview": "Hello!",
  "action": "updated"
}
```

**Payload Structure (Mark as Read):**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "action": "messages_read",
  "read_by": "60d5ec9f5824f70015a1c002",
  "read_at": "2023-04-10T19:00:00.000Z",
  "unread_count": 0
}
```

**When:** 
- Sent after new message is created (action: "updated")
- Sent after messages are marked as read (action: "messages_read")

**Receiver:** All participants in conversation

**Use Case:** Update conversation list (last message, unread count, badge)

---

## 🔄 Complete Flow Example

### Scenario: User A mengirim pesan ke User B, User B membaca

```
Step 1: User A mengirim pesan
  POST /chat/messages
  ↓
  Backend: Create message
  Backend: Update conversation
  Backend: Publish MQTT → chat/userB/messages
  ↓
  User B: Receive message via MQTT ✅

Step 2: User B membuka detail chat
  GET /chat/conversations/:id/messages (tanpa before)
  ↓
  Backend: Load messages
  Backend: Auto-mark as read
  Backend: Publish MQTT → chat/userA/read-receipts
  Backend: Publish MQTT → chat/userB/messages-status
  Backend: Publish MQTT → chat/userA/conversations
  Backend: Publish MQTT → chat/userB/conversations
  ↓
  User A: Receive read receipt via MQTT ✅
  User B: Receive status update via MQTT ✅
  Both: Receive conversation update via MQTT ✅
```

## ⚡ Timing & Performance

### Message Delivery
- **Database Write:** ~10-50ms
- **MQTT Publish:** Immediate (fire-and-forget)
- **Total Latency:** ~10-50ms (database write only)

### Mark as Read
- **Database Update:** ~10-50ms
- **MQTT Publish (3 topics):** Immediate (parallel, fire-and-forget)
- **Total Latency:** ~10-50ms (database update only)

### Key Points
1. **No Blocking:** MQTT publish tidak menunggu acknowledgment
2. **Fire-and-Forget:** Publish langsung tanpa await
3. **Parallel Publishing:** 3 MQTT topics dipublish secara parallel
4. **QoS 1:** Guaranteed delivery untuk semua MQTT messages

## 🗄️ Database Schema

### Message Document
```typescript
{
  conversation_id: string,
  sender_id: string,
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'system',
  text?: string,
  media?: MessageMedia,
  status: 'pending' | 'failed' | 'sent' | 'delivered' | 'read',
  sent_at?: Date,
  delivered_at?: Date,
  read_at?: Date,
  read_by: string[],
  created_at: Date,
  updated_at: Date
}
```

### Conversation Document
```typescript
{
  type: 'direct' | 'group',
  participant_ids: string[],
  last_message_at?: Date,
  last_message_preview?: string,
  created_at: Date,
  updated_at: Date
}
```

## 🔐 Security & Validation

### Message Creation
- ✅ Verify conversation exists
- ✅ Verify user is participant
- ✅ Check block status (both directions)
- ✅ Validate message content

### Mark as Read
- ✅ Verify conversation exists
- ✅ Verify user is participant
- ✅ Only mark messages from other participants
- ✅ Only mark unread messages (status: 'sent' or 'delivered')

## 📊 MQTT Configuration

### Connection Settings
```typescript
{
  reconnectPeriod: 5000,
  connectTimeout: 30000,
  queueQoSZero: false
}
```

### Publish Settings
```typescript
{
  qos: 1,        // Guaranteed delivery
  retain: false, // Don't retain (immediate delivery only)
  dup: false     // No duplicate flag
}
```

## 🎯 Best Practices

1. **Immediate Publish:** MQTT publish dilakukan langsung setelah database operation
2. **No Await:** MQTT publish tidak menggunakan await (fire-and-forget)
3. **Error Handling:** MQTT errors tidak mengganggu main flow
4. **Logging:** Semua MQTT publish di-log untuk debugging
5. **Payload Size:** Keep payload minimal untuk fast delivery

## 🐛 Troubleshooting

### Message tidak terkirim via MQTT
- Check MQTT client connection status
- Check MQTT broker connectivity
- Verify topic subscription
- Check logs for MQTT publish errors

### Read receipt tidak terkirim
- Verify mark as read terjadi (check database)
- Check MQTT publish logs
- Verify senderId is correct
- Check MQTT topic subscription

### Delay dalam delivery
- Check database query performance
- Check MQTT broker performance
- Verify no blocking operations
- Check network latency

---

**Note:** Semua MQTT publish dilakukan secara immediate dan non-blocking untuk memastikan real-time delivery tanpa delay.

