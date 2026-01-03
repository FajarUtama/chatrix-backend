# Client Implementation Guide - MQTT Receipts System

## Overview

This guide describes how to implement the client-side logic for the MQTT-based message status tracking system (SENT/DELIVERED/READ).

---

## E1) On Message Received (MQTT)

### Subscribe to Inbox
```javascript
// Subscribe to user's inbox
mqttClient.subscribe(`chat/v1/users/${userId}/messages`, { qos: 1 });

// Handle incoming messages
mqttClient.on('message', (topic, message) => {
  if (topic === `chat/v1/users/${userId}/messages`) {
    const payload = JSON.parse(message.toString());
    handleNewMessage(payload);
  }
});
```

### Handle New Message
```javascript
async function handleNewMessage(payload) {
  const { message_id, conversation_id, sender_id, server_ts, payload: messagePayload } = payload;
  
  // 1. Store message in local database/cache
  await localDb.messages.insert({
    message_id,
    conversation_id,
    sender_id,
    server_ts,
    text: messagePayload.text,
    media: messagePayload.media,
    // ... other fields
  });
  
  // 2. Debounce and send delivered_up_to receipt
  // Debounce prevents sending receipt for every message individually
  // Accumulate messages and send single receipt for latest message_id
  debouncedSendDelivered(conversation_id, message_id);
}
```

### Send Delivered Receipt (Debounced)
```javascript
const deliveredDebouncers = new Map(); // conversation_id -> debounce timer

function debouncedSendDelivered(conversationId, messageId) {
  // Clear existing timer
  if (deliveredDebouncers.has(conversationId)) {
    clearTimeout(deliveredDebouncers.get(conversationId));
  }
  
  // Set new timer (500-1500ms debounce)
  const timer = setTimeout(() => {
    sendDeliveredUpTo(conversationId, messageId);
    deliveredDebouncers.delete(conversationId);
  }, 1000); // 1 second debounce
  
  deliveredDebouncers.set(conversationId, timer);
}

async function sendDeliveredUpTo(conversationId, lastMessageId) {
  const receipt = {
    type: 'delivered_up_to',
    conversation_id: conversationId,
    actor_user_id: currentUserId,
    last_delivered_message_id: lastMessageId,
    ts: new Date().toISOString(),
  };
  
  // Publish to shared receipts topic
  mqttClient.publish('chat/v1/receipts', JSON.stringify(receipt), { qos: 1 }, (error) => {
    if (error) {
      console.error('Failed to publish delivered receipt:', error);
      // Retry logic here
    }
  });
}
```

**Important Notes:**
- Send receipt **after** message is stored locally (ideally)
- Use debouncing (500-1500ms) to batch receipts
- Only send receipt for the **latest** message_id (watermark approach)
- Store message locally before sending receipt (ensures delivery happened)

---

## E2) On Chat Opened & Messages Visible

### Detect Visible Messages
```javascript
// When user opens chat detail screen
function onChatOpened(conversationId) {
  // Load messages from local DB or REST API
  const messages = await loadMessages(conversationId);
  
  // Determine last visible message_id (bottom of screen)
  const visibleMessages = getVisibleMessages(); // From scroll position
  const lastVisibleMessageId = visibleMessages[visibleMessages.length - 1]?.message_id;
  
  if (lastVisibleMessageId) {
    sendReadUpTo(conversationId, lastVisibleMessageId);
  }
}

// On scroll (optional: debounced for performance)
let readDebounceTimer;
function onMessagesScroll(conversationId) {
  clearTimeout(readDebounceTimer);
  
  readDebounceTimer = setTimeout(() => {
    const visibleMessages = getVisibleMessages();
    const lastVisibleMessageId = visibleMessages[visibleMessages.length - 1]?.message_id;
    
    if (lastVisibleMessageId) {
      sendReadUpTo(conversationId, lastVisibleMessageId);
    }
  }, 500); // 500ms debounce
}
```

### Send Read Receipt (Debounced)
```javascript
const readDebouncers = new Map(); // conversation_id -> { timer, lastMessageId }

function sendReadUpTo(conversationId, lastMessageId) {
  // Get existing debouncer
  const existing = readDebouncers.get(conversationId);
  
  // Update last message ID if newer
  if (!existing || lastMessageId > existing.lastMessageId) {
    // Clear existing timer
    if (existing) {
      clearTimeout(existing.timer);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      const receipt = {
        type: 'read_up_to',
        conversation_id: conversationId,
        actor_user_id: currentUserId,
        last_read_message_id: lastMessageId,
        ts: new Date().toISOString(),
      };
      
      mqttClient.publish('chat/v1/receipts', JSON.stringify(receipt), { qos: 1 }, (error) => {
        if (error) {
          console.error('Failed to publish read receipt:', error);
        }
      });
      
      readDebouncers.delete(conversationId);
    }, 500); // 500ms debounce
    
    readDebouncers.set(conversationId, { timer, lastMessageId });
  }
}
```

**Important Notes:**
- Send `read_up_to` when messages become **visible** in UI
- Use debouncing (500ms) to avoid excessive receipts
- Only send if message_id is **newer** than last sent receipt
- Can be called periodically while user is viewing chat

---

## E3) On Receipt Update Received (MQTT)

### Subscribe to Receipts
```javascript
// Subscribe to receipt updates for outgoing messages
mqttClient.subscribe(`chat/v1/users/${userId}/receipts`, { qos: 1 });

// Handle receipt updates
mqttClient.on('message', (topic, message) => {
  if (topic === `chat/v1/users/${userId}/receipts`) {
    const payload = JSON.parse(message.toString());
    handleReceiptUpdate(payload);
  }
});
```

### Handle Receipt Update
```javascript
async function handleReceiptUpdate(receipt) {
  const { type, conversation_id, actor_user_id, last_delivered_message_id, last_read_message_id } = receipt;
  
  // Get conversation and messages
  const conversation = await getConversation(conversation_id);
  const messages = await getMessages(conversation_id);
  
  // Filter to only outgoing messages (sent by current user)
  const outgoingMessages = messages.filter(msg => msg.sender_id === currentUserId);
  
  if (type === 'delivered_up_to' && last_delivered_message_id) {
    // Update status for messages up to last_delivered_message_id
    updateMessageStatuses(outgoingMessages, last_delivered_message_id, 'delivered', actor_user_id);
  }
  
  if (type === 'read_up_to' && last_read_message_id) {
    // Update status for messages up to last_read_message_id
    updateMessageStatuses(outgoingMessages, last_read_message_id, 'read', actor_user_id);
  }
}

function updateMessageStatuses(messages, watermarkMessageId, status, actorUserId) {
  // For 1-1 chat: simple status update
  // For group chat: update counts per member
  
  // Find watermark message
  const watermarkMessage = messages.find(msg => msg.message_id === watermarkMessageId);
  if (!watermarkMessage) return;
  
  // Update all messages up to watermark
  for (const message of messages) {
    // Compare message ordering (use server_ts or message_id lexicographic)
    if (isMessageBeforeOrEqual(message, watermarkMessage)) {
      if (message.conversationType === 'direct') {
        // 1-1: simple status update
        message.status = status;
      } else {
        // Group: update counts
        if (status === 'delivered') {
          message.delivered_count = (message.delivered_count || 0) + 1;
          message.status = message.delivered_count === message.member_count_excluding_sender 
            ? 'delivered' 
            : 'sent';
        } else if (status === 'read') {
          message.read_count = (message.read_count || 0) + 1;
          message.status = message.read_count === message.member_count_excluding_sender 
            ? 'read' 
            : message.status;
        }
      }
      
      // Update UI
      updateMessageInUI(message);
    }
  }
}

function isMessageBeforeOrEqual(msg1, msg2) {
  // Compare by server_ts or message_id (ULID is sortable)
  if (msg1.server_ts && msg2.server_ts) {
    return new Date(msg1.server_ts) <= new Date(msg2.server_ts);
  }
  // Fallback: lexicographic comparison (works for ULID)
  return msg1.message_id <= msg2.message_id;
}
```

---

## E4) Reconnect & Sync

### On MQTT Reconnect
```javascript
mqttClient.on('reconnect', () => {
  console.log('MQTT reconnected, syncing messages...');
  syncAfterReconnect();
});

async function syncAfterReconnect() {
  // 1. Get last known server_ts from local DB
  const lastSync = await localDb.syncState.get('last_server_ts');
  const lastServerTs = lastSync?.timestamp || null;
  
  // 2. Sync messages via REST API
  const url = lastServerTs 
    ? `/chat/conversations?after=${lastServerTs}`
    : '/chat/conversations';
  
  const conversations = await api.get(url);
  
  // 3. For each conversation, sync messages
  for (const conv of conversations) {
    await syncConversationMessages(conv.id, lastServerTs);
  }
  
  // 4. Send delivered_up_to for all messages received via sync
  await sendPendingReceipts();
}

async function syncConversationMessages(conversationId, afterTs) {
  // Get messages from REST API
  const url = afterTs
    ? `/chat/conversations/${conversationId}/messages?after=${afterTs}`
    : `/chat/conversations/${conversationId}/messages`;
  
  const response = await api.get(url);
  const messages = response.messages;
  
  // Store messages locally
  for (const msg of messages) {
    await localDb.messages.upsert(msg);
  }
  
  // Update last_server_ts
  if (messages.length > 0) {
    const latestTs = messages[messages.length - 1].server_ts;
    await localDb.syncState.upsert({ 
      key: 'last_server_ts', 
      timestamp: latestTs 
    });
  }
}

async function sendPendingReceipts() {
  // Get all conversations
  const conversations = await localDb.conversations.getAll();
  
  for (const conv of conversations) {
    // Get latest message in conversation
    const messages = await localDb.messages.getByConversation(conv.id);
    if (messages.length === 0) continue;
    
    const latestMessage = messages[messages.length - 1];
    
    // Send delivered_up_to if not already sent
    const lastSentReceipt = await localDb.receipts.getLastSent(conv.id, 'delivered');
    if (!lastSentReceipt || latestMessage.message_id > lastSentReceipt.message_id) {
      await sendDeliveredUpTo(conv.id, latestMessage.message_id);
    }
    
    // Send read_up_to if conversation is currently open and visible
    if (conv.isOpen && conv.isVisible) {
      const lastReadReceipt = await localDb.receipts.getLastSent(conv.id, 'read');
      if (!lastReadReceipt || latestMessage.message_id > lastReadReceipt.message_id) {
        await sendReadUpTo(conv.id, latestMessage.message_id);
      }
    }
  }
}
```

---

## Complete Example: React Hook

```typescript
import { useEffect, useCallback, useRef } from 'react';
import { useMqtt } from './useMqtt';

export function useChatReceipts(userId: string) {
  const { subscribe, publish } = useMqtt();
  const deliveredDebouncers = useRef(new Map<string, NodeJS.Timeout>());
  const readDebouncers = useRef(new Map<string, { timer: NodeJS.Timeout; lastMessageId: string }>());
  
  // Subscribe to inbox
  useEffect(() => {
    subscribe(`chat/v1/users/${userId}/messages`, handleNewMessage);
    subscribe(`chat/v1/users/${userId}/receipts`, handleReceiptUpdate);
    
    return () => {
      // Cleanup subscriptions
    };
  }, [userId]);
  
  const handleNewMessage = useCallback(async (payload: MessagePayload) => {
    // Store message
    await storeMessage(payload);
    
    // Debounced delivered receipt
    debounceDelivered(payload.conversation_id, payload.message_id);
  }, []);
  
  const debounceDelivered = useCallback((conversationId: string, messageId: string) => {
    const existing = deliveredDebouncers.current.get(conversationId);
    if (existing) clearTimeout(existing);
    
    const timer = setTimeout(() => {
      publish('chat/v1/receipts', {
        type: 'delivered_up_to',
        conversation_id: conversationId,
        actor_user_id: userId,
        last_delivered_message_id: messageId,
        ts: new Date().toISOString(),
      });
      deliveredDebouncers.current.delete(conversationId);
    }, 1000);
    
    deliveredDebouncers.current.set(conversationId, timer);
  }, [userId, publish]);
  
  const sendReadReceipt = useCallback((conversationId: string, lastMessageId: string) => {
    const existing = readDebouncers.current.get(conversationId);
    if (existing && lastMessageId <= existing.lastMessageId) return;
    
    if (existing) clearTimeout(existing.timer);
    
    const timer = setTimeout(() => {
      publish('chat/v1/receipts', {
        type: 'read_up_to',
        conversation_id: conversationId,
        actor_user_id: userId,
        last_read_message_id: lastMessageId,
        ts: new Date().toISOString(),
      });
      readDebouncers.current.delete(conversationId);
    }, 500);
    
    readDebouncers.current.set(conversationId, { timer, lastMessageId });
  }, [userId, publish]);
  
  const handleReceiptUpdate = useCallback((receipt: ReceiptPayload) => {
    // Update UI based on receipt
    updateMessageStatus(receipt);
  }, []);
  
  return { sendReadReceipt };
}
```

---

## Best Practices

1. **Debouncing**: Always debounce receipts (500-1500ms) to reduce MQTT traffic
2. **Watermark**: Only send receipt for latest message_id, not per-message
3. **Local Storage**: Store messages locally before sending receipts
4. **Idempotency**: Handle duplicate receipts gracefully (client shouldn't send duplicates, but handle if server sends)
5. **Error Handling**: Retry failed receipts with exponential backoff
6. **Offline**: Queue receipts when offline, send on reconnect
7. **Ordering**: Use `server_ts` or ULID for message ordering
8. **UI Updates**: Update UI optimistically, then confirm with receipt updates

---

## Testing Checklist

- [ ] Receives messages via MQTT
- [ ] Stores messages locally
- [ ] Sends delivered_up_to after storing
- [ ] Debounces delivered receipts
- [ ] Sends read_up_to when messages visible
- [ ] Debounces read receipts
- [ ] Updates UI on receipt updates
- [ ] Handles reconnect and sync
- [ ] Sends pending receipts after sync
- [ ] Handles duplicate messages (QoS1)
- [ ] Handles out-of-order receipts

