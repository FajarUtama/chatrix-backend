# Test Scenarios for MQTT Receipts System

## Overview

This document describes comprehensive test scenarios for the end-to-end message status tracking system (SENT/DELIVERED/READ) using MQTT watermark receipts.

---

## Test Setup

### Prerequisites
1. MQTT broker running (Mosquitto)
2. Backend server running
3. Two or more test users (userA, userB, userC for group)
4. MQTT client tools (mosquitto_sub, mosquitto_pub, or client library)
5. REST API client (curl, Postman, etc.)

### Test Users
- userA: ID `uA`
- userB: ID `uB`
- userC: ID `uC` (for group chat)

---

## Scenario 1: 1-1 Chat - Basic Flow

**Goal:** Test complete SENT → DELIVERED → READ flow in 1-1 chat

### Step 1: UserA sends message
```bash
# REST API
POST /chat/messages
Authorization: Bearer {userA_token}
{
  "conversationId": "conv_123",
  "content": "Hello, are you there?",
  "type": "text"
}

# Expected Response:
{
  "message_id": "01HZ...",
  "status": "sent",
  "server_ts": "2026-01-03T06:00:00.000Z"
}
```

**Verification:**
- [ ] Message stored in MongoDB with `status: 'sent'`
- [ ] Message has `message_id` (ULID)
- [ ] Message has `server_ts`

### Step 2: UserB receives message via MQTT
```bash
# Subscribe to UserB's inbox
mosquitto_sub -h localhost -t "chat/v1/users/uB/messages" -u uB -P password

# Expected MQTT Message:
{
  "type": "message",
  "message_id": "01HZ...",
  "conversation_id": "conv_123",
  "sender_id": "uA",
  "server_ts": "2026-01-03T06:00:00.000Z",
  "payload": {
    "text": "Hello, are you there?"
  }
}
```

**Verification:**
- [ ] UserB receives message on correct topic
- [ ] Payload matches sent message
- [ ] `message_id` is present

### Step 3: UserB sends delivered_up_to receipt
```bash
# UserB's client publishes receipt after storing message locally
mosquitto_pub -h localhost -t "chat/v1/receipts" -u uB -P password -m '{
  "type": "delivered_up_to",
  "conversation_id": "conv_123",
  "actor_user_id": "uB",
  "last_delivered_message_id": "01HZ...",
  "ts": "2026-01-03T06:00:01.000Z"
}'
```

**Verification:**
- [ ] Receipt stored in `conversation_receipts` collection
- [ ] `last_delivered_message_id` = message_id from Step 1
- [ ] `user_id` = "uB"
- [ ] UserA receives receipt update on `chat/v1/users/uA/receipts`

### Step 4: UserA receives delivered receipt update
```bash
# Subscribe to UserA's receipts
mosquitto_sub -h localhost -t "chat/v1/users/uA/receipts" -u uA -P password

# Expected MQTT Message:
{
  "type": "delivered_up_to",
  "conversation_id": "conv_123",
  "actor_user_id": "uB",
  "last_delivered_message_id": "01HZ...",
  "ts": "2026-01-03T06:00:01.000Z"
}
```

**Verification:**
- [ ] UserA receives receipt update
- [ ] UserA's UI updates message status to "delivered" (double checkmark)

### Step 5: UserB opens chat and sends read_up_to
```bash
# UserB's client publishes read receipt when messages become visible
mosquitto_pub -h localhost -t "chat/v1/receipts" -u uB -P password -m '{
  "type": "read_up_to",
  "conversation_id": "conv_123",
  "actor_user_id": "uB",
  "last_read_message_id": "01HZ...",
  "ts": "2026-01-03T06:01:00.000Z"
}'
```

**Verification:**
- [ ] Receipt stored with `last_read_message_id`
- [ ] UserA receives read receipt update

### Step 6: UserA receives read receipt update
**Expected:** UserA's UI updates message status to "read" (blue double checkmark)

### Step 7: Verify computed status via REST API
```bash
GET /chat/conversations/conv_123/messages
Authorization: Bearer {userA_token}

# Expected: Message has status "read"
{
  "messages": [{
    "message_id": "01HZ...",
    "status": "read",
    ...
  }]
}
```

**Verification:**
- [ ] Status computed correctly from receipts
- [ ] Status = "read" (not "delivered" or "sent")

---

## Scenario 2: Idempotency - Duplicate Receipts

**Goal:** Ensure duplicate receipts don't cause issues

### Test Steps:
1. UserB sends `delivered_up_to` receipt with same `message_id` twice
2. Verify:
   - [ ] Second receipt is ignored (idempotent)
   - [ ] Database not updated twice
   - [ ] No errors thrown

### Test Out-of-Order Receipts:
1. UserB sends `delivered_up_to` for message_id "01HZ...ABC"
2. UserB sends `delivered_up_to` for message_id "01HZ...XYZ" (newer)
3. UserB sends `delivered_up_to` for message_id "01HZ...DEF" (older, should be ignored)
4. Verify:
   - [ ] Watermark only advances forward
   - [ ] Older receipt is ignored
   - [ ] `last_delivered_message_id` = "01HZ...XYZ"

---

## Scenario 3: QoS1 Duplicate Messages

**Goal:** Test handling of duplicate messages from MQTT QoS1

### Test Steps:
1. Simulate MQTT QoS1 duplicate (send same message twice)
2. Verify:
   - [ ] Client handles duplicate gracefully
   - [ ] Only one `delivered_up_to` receipt sent (debounced)
   - [ ] No duplicate entries in local storage

---

## Scenario 4: Group Chat - Multiple Recipients

**Goal:** Test receipt tracking in group chat

### Setup:
- Create group conversation with userA, userB, userC
- Conversation ID: `group_456`

### Test Steps:

#### Step 1: UserA sends message to group
```bash
POST /chat/messages
{
  "conversationId": "group_456",
  "content": "Meeting at 3pm",
  "type": "text"
}
```

#### Step 2: UserB and UserC receive message
- [ ] Both receive on their respective inbox topics
- [ ] Message has correct `conversation_id`

#### Step 3: UserB sends delivered_up_to
- [ ] Receipt stored for userB
- [ ] UserA receives receipt update
- [ ] Status for userA's message shows: `delivered_count: 1, member_count_excluding_sender: 2`

#### Step 4: UserC sends delivered_up_to
- [ ] Receipt stored for userC
- [ ] UserA receives receipt update
- [ ] Status for userA's message shows: `delivered_count: 2, is_fully_delivered: true`

#### Step 5: UserB sends read_up_to
- [ ] Receipt stored for userB
- [ ] Status shows: `read_count: 1, delivered_count: 2`

#### Step 6: UserC sends read_up_to
- [ ] Receipt stored for userC
- [ ] Status shows: `read_count: 2, is_fully_read: true`

### Verification via REST API:
```bash
GET /chat/conversations/group_456/messages
Authorization: Bearer {userA_token}

# Expected response includes status summary for group
{
  "messages": [{
    "message_id": "...",
    "status": "read",
    "delivered_count": 2,
    "read_count": 2,
    "member_count_excluding_sender": 2,
    "is_fully_delivered": true,
    "is_fully_read": true
  }]
}
```

---

## Scenario 5: Offline / Reconnect

**Goal:** Test behavior when client goes offline and reconnects

### Test Steps:

#### Step 1: UserB goes offline
- UserB disconnects MQTT

#### Step 2: UserA sends multiple messages while UserB offline
- Messages stored in MongoDB
- MQTT publish attempted (may fail, but message saved)

#### Step 3: UserB reconnects
- UserB syncs via REST: `GET /chat/conversations/conv_123/messages?after={last_server_ts}`
- UserB receives missed messages via sync
- UserB sends `delivered_up_to` for all received messages

#### Step 4: Verify
- [ ] UserB's watermark updated to latest message
- [ ] UserA receives receipt update with latest `message_id`
- [ ] All messages show as "delivered" to UserA

---

## Scenario 6: Multi-Device Support

**Goal:** Test that DELIVERED/READ counts per user, not per device

### Setup:
- UserB has 2 devices: Device1 and Device2

### Test Steps:

#### Step 1: UserA sends message
- Message published to `chat/v1/users/uB/messages`

#### Step 2: Device1 receives message and sends delivered_up_to
- [ ] Receipt stored for userB (not per-device)
- [ ] UserA sees message as "delivered"

#### Step 3: Device2 receives message (different device, same user)
- [ ] Device2 should NOT send delivered_up_to if already delivered by Device1
- [ ] OR: Device2 sends, but server treats as same user (watermark doesn't change)

#### Step 4: Device1 marks as read
- [ ] Receipt stored for userB
- [ ] UserA sees message as "read"
- [ ] All devices of UserA receive receipt update

---

## Scenario 7: REST Fallback - Mark as Read

**Goal:** Test REST endpoint as fallback for read receipts

### Test Steps:
```bash
# UserB marks conversation as read via REST
POST /chat/conversations/conv_123/read
Authorization: Bearer {userB_token}
{
  "last_read_message_id": "01HZ..."
}
```

**Verification:**
- [ ] Receipt stored in `conversation_receipts`
- [ ] UserA receives receipt update via MQTT
- [ ] Status updated correctly

---

## Scenario 8: Edge Cases

### 8.1: User Leaves Group
- UserC leaves group
- UserA sends message
- Verify:
  - [ ] UserC doesn't receive message
  - [ ] `member_count_excluding_sender` doesn't include UserC
  - [ ] Receipts from UserC are ignored

### 8.2: User Blocks Another User
- UserB blocks UserA
- UserA sends message
- Verify:
  - [ ] Message creation fails with 403 Forbidden
  - [ ] No MQTT publish

### 8.3: Invalid Receipt (Wrong Conversation)
- UserB sends receipt with wrong `conversation_id`
- Verify:
  - [ ] Receipt rejected
  - [ ] Error logged

### 8.4: Invalid Receipt (Wrong Actor)
- UserB tries to send receipt with `actor_user_id: "uC"` (not themselves)
- Verify:
  - [ ] Receipt rejected (if server validates actor matches authenticated user)
  - [ ] Error logged

### 8.5: Message Deleted
- UserA deletes message
- UserB sends receipt for deleted message
- Verify:
  - [ ] Receipt processed (message may exist in receipts even if deleted)
  - [ ] OR: Receipt rejected if message lookup fails

---

## Scenario 9: Performance - Large Group

**Goal:** Test with large group (10+ members)

### Setup:
- Create group with 10 members
- UserA sends message

### Test Steps:
1. All members receive message
2. Members send delivered_up_to (staggered)
3. Verify:
   - [ ] All receipts processed correctly
   - [ ] Status computation efficient (not N+1 queries)
   - [ ] MQTT publishes to all members don't cause issues

---

## Scenario 10: Watermark Monotonicity

**Goal:** Ensure watermarks only advance forward

### Test Steps:
1. UserB has `last_delivered_message_id: "01HZ...XYZ"` (newer)
2. UserB sends receipt with `last_delivered_message_id: "01HZ...ABC"` (older)
3. Verify:
   - [ ] Receipt ignored
   - [ ] Watermark stays at "01HZ...XYZ"
   - [ ] Log shows "out-of-order receipt ignored"

---

## Verification Checklist

After running all scenarios, verify:

### Database State:
- [ ] All messages have `message_id` and `server_ts`
- [ ] `conversation_receipts` has correct watermarks
- [ ] Watermarks are monotonic (only advance)
- [ ] Indexes are created and working

### MQTT Topics:
- [ ] Messages published to `chat/v1/users/{uid}/messages`
- [ ] Receipts published to `chat/v1/users/{uid}/receipts`
- [ ] Clients can subscribe to correct topics
- [ ] ACL prevents unauthorized access

### API Responses:
- [ ] GET messages returns computed status
- [ ] Status correct for 1-1 and group chats
- [ ] Group status includes counts

### Real-Time Updates:
- [ ] Receipt updates arrive in real-time
- [ ] UI updates correctly on receipt
- [ ] No duplicate updates

---

## Tools for Testing

### MQTT Client (Command Line):
```bash
# Subscribe to inbox
mosquitto_sub -h localhost -t "chat/v1/users/uB/messages" -u uB -P password -v

# Subscribe to receipts
mosquitto_sub -h localhost -t "chat/v1/users/uA/receipts" -u uA -P password -v

# Publish receipt
mosquitto_pub -h localhost -t "chat/v1/receipts" -u uB -P password -m '{"type":"delivered_up_to",...}'
```

### REST API (curl):
```bash
# Send message
curl -X POST http://localhost:3000/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"conv_123","content":"Hello","type":"text"}'

# Get messages
curl -X GET "http://localhost:3000/chat/conversations/conv_123/messages" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Expected Behavior Summary

1. **SENT**: Message stored in DB → Status = "sent"
2. **DELIVERED**: Client receives via MQTT → Sends `delivered_up_to` → Status = "delivered"
3. **READ**: Client opens chat → Sends `read_up_to` → Status = "read"
4. **Idempotent**: Duplicate receipts ignored
5. **Monotonic**: Watermarks only advance forward
6. **Group**: Status shows counts per member
7. **Multi-device**: Counts per user, not per device
8. **Offline**: Sync via REST, then send receipts

