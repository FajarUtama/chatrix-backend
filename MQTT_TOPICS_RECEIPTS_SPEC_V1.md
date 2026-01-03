# MQTT Topics & Receipts Specification v1

## 📋 Overview

This specification defines the MQTT-based real-time messaging system with end-to-end message status tracking (SENT/DELIVERED/READ) similar to WhatsApp/Telegram.

**Key Features:**
- Watermark-based receipts (efficient, not per-message)
- Idempotent operations (QoS1 duplicate-safe)
- Multi-device support
- 1-1 and group chat support
- ACL-protected topics

---

## 🎯 Status Definitions

### SENT
- **Definition**: Server has received and stored the message in MongoDB
- **UI Indicator**: Single checkmark (✓)
- **Trigger**: POST /chat/messages returns success

### DELIVERED
- **Definition**: At least one device of the recipient user has received the message via MQTT and stored it locally
- **UI Indicator**: Double checkmark (✓✓)
- **Trigger**: Client publishes `delivered_up_to` receipt after receiving message via MQTT

### READ
- **Definition**: Recipient has opened the conversation and the message is visible (based on watermark)
- **UI Indicator**: Double blue checkmark (✓✓)
- **Trigger**: Client publishes `read_up_to` receipt when messages become visible

**Group Chat Rules:**
- DELIVERED: counted per member (e.g., "5 of 10 delivered")
- READ: counted per member (e.g., "3 of 10 read")
- Minimum 1 device per user needs to deliver/read to count for that user

---

## 📡 MQTT Topics (Namespace: chat/v1)

### Client SUBSCRIBE (Inbox Topics)

| Topic Pattern | Purpose | QoS | Retained |
|--------------|---------|-----|----------|
| `chat/v1/users/{myUserId}/messages` | Receive new messages | 1 | false |
| `chat/v1/users/{myUserId}/receipts` | Receive receipt updates for outgoing messages | 1 | false |
| `chat/v1/users/{myUserId}/conversations` | Receive conversation list updates (optional) | 1 | false |

**Example:**
- User ID: `u123` subscribes to:
  - `chat/v1/users/u123/messages`
  - `chat/v1/users/u123/receipts`
  - `chat/v1/users/u123/conversations`

### Client PUBLISH (Receipts)

**Recommended Approach: Shared Topic (Simple ACL)**

| Topic | Purpose | QoS | Retained |
|-------|---------|-----|----------|
| `chat/v1/receipts` | Publish delivered_up_to and read_up_to receipts | 1 | false |

**Why Shared Topic:**
- Simpler ACL configuration (all authenticated users can write to shared topic)
- Server validates actor_user_id from payload
- Easier to implement and maintain

**Alternative: Per-User Topic (Stricter ACL)**
- Topic: `chat/v1/users/{myUserId}/receipts:up`
- Requires more complex ACL but provides better isolation

### Server PUBLISH

| Topic Pattern | Purpose | QoS | Retained |
|--------------|---------|-----|----------|
| `chat/v1/users/{uid}/messages` | Publish new messages to user inbox | 1 | false |
| `chat/v1/users/{uid}/receipts` | Publish receipt updates (delivered/read status) | 1 | false |
| `chat/v1/users/{uid}/conversations` | Publish conversation list updates | 1 | false |

---

## 📦 JSON Payload Schemas

### B1) Message Event (Server → Client)

**Topic:** `chat/v1/users/{userId}/messages`

```json
{
  "type": "message",
  "message_id": "01HZABCDEFGHIJKLMNOPQRSTUV",
  "conversation_id": "conv_123",
  "sender_id": "uA",
  "server_ts": "2026-01-03T06:00:00.000Z",
  "payload": {
    "text": "Hello, how are you?"
  },
  "seq": 12345
}
```

**Required Fields:**
- `type`: `"message"` (string)
- `message_id`: ULID/UUID string (unique per message)
- `conversation_id`: string
- `sender_id`: user ID who sent the message
- `server_ts`: ISO 8601 timestamp (when server received/stored)
- `payload`: object containing message content
  - `text`: string (for text messages)
  - `media`: object (for media messages)
  - Other message types as needed

**Optional Fields:**
- `seq`: server-side sequence number (for ordering)
- `reply_to_message_id`: string (if replying to a message)
- `mentions`: array of user IDs
- `edited_at`: ISO timestamp (if message was edited)

**1-1 Chat Example:**
```json
{
  "type": "message",
  "message_id": "01HZABCDEFGHIJKLMNOPQRSTUV",
  "conversation_id": "conv_123",
  "sender_id": "uA",
  "server_ts": "2026-01-03T06:00:00.000Z",
  "payload": {
    "text": "Hey, are you there?"
  }
}
```

**Group Chat Example:**
```json
{
  "type": "message",
  "message_id": "01HZABCDEFGHIJKLMNOPQRSTUV",
  "conversation_id": "group_456",
  "sender_id": "uA",
  "server_ts": "2026-01-03T06:00:00.000Z",
  "payload": {
    "text": "@uB @uC Meeting at 3pm today",
    "mentions": ["uB", "uC"]
  }
}
```

---

### B2) Receipt Watermark (Client → Server)

#### DELIVERED_UP_TO

**Topic:** `chat/v1/receipts`

```json
{
  "type": "delivered_up_to",
  "conversation_id": "conv_123",
  "actor_user_id": "uB",
  "last_delivered_message_id": "01HZABCDEFGHIJKLMNOPQRSTUV",
  "ts": "2026-01-03T06:00:01.000Z"
}
```

**Required Fields:**
- `type`: `"delivered_up_to"` (string)
- `conversation_id`: string
- `actor_user_id`: user ID who is acknowledging delivery (must match authenticated user)
- `last_delivered_message_id`: ULID of the last message that has been delivered to client
- `ts`: ISO 8601 timestamp (client timestamp, but server will use server time)

**Semantics:**
- All messages up to and including `last_delivered_message_id` are considered delivered
- Watermark must be monotonic (only advance forward)
- If out-of-order or older than existing watermark, server ignores it

#### READ_UP_TO

**Topic:** `chat/v1/receipts`

```json
{
  "type": "read_up_to",
  "conversation_id": "conv_123",
  "actor_user_id": "uB",
  "last_read_message_id": "01HZABCDEFGHIJKLMNOPQRSTUV",
  "ts": "2026-01-03T06:01:00.000Z"
}
```

**Required Fields:**
- `type`: `"read_up_to"` (string)
- `conversation_id`: string
- `actor_user_id`: user ID who is acknowledging read (must match authenticated user)
- `last_read_message_id`: ULID of the last message that has been read by user
- `ts`: ISO 8601 timestamp

**Semantics:**
- All messages up to and including `last_read_message_id` are considered read
- Watermark must be monotonic (only advance forward)
- Client should send this when messages become visible in UI

---

### B3) Receipt Update (Server → Sender/Members)

**Topic:** `chat/v1/users/{uid}/receipts`

```json
{
  "type": "read_up_to",
  "conversation_id": "conv_123",
  "actor_user_id": "uB",
  "last_read_message_id": "01HZABCDEFGHIJKLMNOPQRSTUV",
  "ts": "2026-01-03T06:01:00.000Z"
}
```

**1-1 Chat:**
- Published to sender only
- Sender updates UI: messages up to `last_read_message_id` show as "read"

**Group Chat:**
- Published to all members (or only relevant senders - implementer choice)
- Each member can compute which of their messages have been read by which members

**Delivered Example:**
```json
{
  "type": "delivered_up_to",
  "conversation_id": "conv_123",
  "actor_user_id": "uB",
  "last_delivered_message_id": "01HZABCDEFGHIJKLMNOPQRSTUV",
  "ts": "2026-01-03T06:00:01.000Z"
}
```

---

## 🔐 Mosquitto ACL Configuration

### Basic Setup (password_file + acl_file)

**mosquitto.conf:**
```conf
allow_anonymous false
password_file /etc/mosquitto/passwd
acl_file /etc/mosquitto/acl

# Enable ACL
acl_type file
```

**passwd file** (created with `mosquitto_passwd`):
```
user1:$7$...
user2:$7$...
```

**acl file** (`/etc/mosquitto/acl`):
```
# User {uid} can read their own inbox topics
user {uid}
topic read chat/v1/users/{uid}/#
topic write chat/v1/receipts

# Deny all other topics
topic read #
```

**Dynamic ACL (Better Approach):**

Since user IDs are dynamic, you have two options:

1. **Pattern-based ACL (Mosquitto 2.0+):**
```conf
# acl file
user $SYS/#
topic read $SYS/#

# User can read their own inbox (pattern matching)
user {uid}
topic read chat/v1/users/%u/#
topic write chat/v1/receipts

# Deny everything else
topic deny #
```

2. **Gateway/Bridge Approach (Recommended):**
- Use MQTT broker as internal service
- Implement gateway that handles authentication
- Gateway validates JWT token and maps to user ID
- Gateway subscribes client to correct topics based on user ID
- This allows dynamic topic subscription without ACL file updates

**JWT Authentication with Mosquitto:**

Mosquitto doesn't natively support JWT. Options:

1. **Custom Auth Plugin:**
   - Use `mosquitto-auth-plug` or write custom plugin
   - Plugin validates JWT and extracts user ID
   - More complex but more secure

2. **MQTT Gateway (Recommended):**
   - Client connects to gateway with JWT
   - Gateway validates JWT → extracts user ID
   - Gateway maintains MQTT connection to Mosquitto
   - Gateway subscribes client to `chat/v1/users/{userId}/#`
   - Simpler to implement, easier to maintain

---

## 🔄 Idempotency & Ordering

### Message ID
- Must be unique per message
- Recommended: ULID (time-ordered, sortable)
- Server uses `message_id` for idempotency (upsert on duplicate)

### Watermark Receipts
- Must be monotonic (only advance forward)
- Server compares using message ordering (ULID time or server_ts)
- Out-of-order receipts are ignored
- Duplicate receipts (same watermark) are idempotent (no-op)

### Ordering
- Messages ordered by `server_ts` (server timestamp)
- ULID provides natural ordering if using ULID
- Client should sort by `server_ts` for consistency

---

## 🔄 Multi-Device Support

### DELIVERED Rule
- If **any** device of user receives message → user is considered "delivered"
- Server tracks per-user, not per-device

### READ Rule
- If **any** device of user reads message → user is considered "read"
- Server tracks per-user, not per-device

### Receipt Propagation
- Server publishes receipt updates to **all devices** of sender
- Each device can independently update UI

---

## 📝 Migration Notes

### From Old Topic Structure

**Old:** `chat/{userId}/messages`
**New:** `chat/v1/users/{userId}/messages`

**Migration Strategy:**
1. Support both old and new topics during transition period
2. Publish to both topics simultaneously
3. Deprecate old topics after clients migrate

---

## 🧪 Test Scenarios

See `TEST_SCENARIOS.md` for detailed test cases.

---

## 📚 References

- ULID: https://github.com/ulid/spec
- MQTT QoS: https://www.hivemq.com/blog/mqtt-essentials-part-6-mqtt-quality-of-service-levels/
- Mosquitto ACL: https://mosquitto.org/man/mosquitto-conf-5.html

