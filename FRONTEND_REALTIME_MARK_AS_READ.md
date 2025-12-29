# Frontend Implementation Guide - Real-Time Mark as Read

## 📋 Overview

Backend sudah menyediakan fitur auto-read dan real-time mark as read via MQTT. Dokumen ini menjelaskan cara implementasi di frontend untuk memastikan pesan ter-mark as read secara real-time baik di detail chat maupun list chat.

## 🎯 Tujuan

1. Pesan otomatis ter-mark as read saat user membuka detail chat
2. Pesan ter-mark as read secara real-time saat user sedang berada di detail chat
3. Status "read" ter-update secara real-time di detail chat (untuk sender)
4. Unread count ter-update secara real-time di conversation list

## 🔌 Backend Endpoints

### 1. Auto-Read (Otomatis)
- **GET** `/chat/conversations/:id/messages` (tanpa parameter `before`)
  - Auto-mark as read saat pertama kali load messages
  - Hanya berlaku untuk first page (tanpa pagination)

- **POST** `/chat/conversations/ensure`
  - Auto-mark as read saat user membuka/ensure conversation dari list

### 2. Manual Mark as Read
- **POST** `/chat/conversations/:id/read`
  - Manual mark as read (opsional, karena sudah ada auto-read)

- **POST** `/chat/conversations/:id/view` ⭐ **NEW - Recommended**
  - Real-time mark as read saat user sedang berada di detail chat
  - Dapat dipanggil secara berkala untuk memastikan pesan ter-mark as read

## 📡 MQTT Topics untuk Subscribe

Frontend perlu subscribe ke MQTT topics berikut untuk real-time updates:

### 1. Read Receipts (untuk Sender)
**Topic:** `chat/{userId}/read-receipts`

**Payload:**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "read_by": "60d5ec9f5824f70015a1c001",
  "read_at": "2023-04-10T19:00:00.000Z",
  "count": 5
}
```

**Use Case:** Update status pesan yang dikirim dari "sent"/"delivered" menjadi "read" di detail chat

### 2. Message Status Update (untuk Reader)
**Topic:** `chat/{userId}/messages-status`

**Payload:**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "action": "marked_as_read",
  "read_by": "60d5ec9f5824f70015a1c001",
  "read_at": "2023-04-10T19:00:00.000Z",
  "count": 5
}
```

**Use Case:** Update status pesan yang diterima di detail chat (opsional, untuk konfirmasi)

### 3. Conversation Update (untuk List Chat)
**Topic:** `chat/{userId}/conversations`

**Payload:**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "action": "messages_read",
  "read_by": "60d5ec9f5824f70015a1c001",
  "read_at": "2023-04-10T19:00:00.000Z",
  "unread_count": 0
}
```

**Use Case:** Update unread count/badge di conversation list

## 🚀 Implementasi Step-by-Step

### Step 1: Setup MQTT Subscription

```javascript
// Subscribe ke semua topics yang diperlukan
mqttClient.subscribe(`chat/${userId}/read-receipts`);
mqttClient.subscribe(`chat/${userId}/messages-status`);
mqttClient.subscribe(`chat/${userId}/conversations`);

// Handle incoming messages
mqttClient.on('message', (topic, message) => {
  const payload = JSON.parse(message.toString());
  
  if (topic === `chat/${userId}/read-receipts`) {
    handleReadReceipt(payload);
  } else if (topic === `chat/${userId}/messages-status`) {
    handleMessageStatusUpdate(payload);
  } else if (topic === `chat/${userId}/conversations`) {
    handleConversationUpdate(payload);
  }
});
```

### Step 2: Handle Read Receipt (Update Status di Detail Chat)

```javascript
function handleReadReceipt(payload) {
  const { conversation_id, read_by, read_at, count } = payload;
  
  // Update status pesan di detail chat
  // Cari semua pesan di conversation_id yang statusnya belum "read"
  // Update status menjadi "read" dan set read_at
  
  updateMessagesStatus(conversation_id, {
    status: 'read',
    read_at: read_at,
    read_by: read_by
  });
  
  // Update UI untuk menampilkan status "read" (double check icon)
  refreshChatDetail(conversation_id);
}
```

### Step 3: Handle Conversation Update (Update List Chat)

```javascript
function handleConversationUpdate(payload) {
  const { conversation_id, action, unread_count } = payload;
  
  if (action === 'messages_read') {
    // Update unread count di conversation list
    updateConversationInList(conversation_id, {
      unread_count: unread_count,
      last_message_status: 'read'
    });
    
    // Update badge count
    updateUnreadBadge();
  }
}
```

### Step 4: Real-Time Mark as Read saat User di Detail Chat

**Opsi A: Polling Endpoint View (Recommended)**

```javascript
let viewChatInterval = null;

function startViewingChat(conversationId) {
  // Mark as read saat pertama kali masuk
  markAsRead(conversationId);
  
  // Polling setiap 3 detik untuk memastikan pesan ter-mark as read
  viewChatInterval = setInterval(() => {
    if (isUserViewingChat(conversationId)) {
      markAsRead(conversationId);
    }
  }, 3000);
}

function stopViewingChat() {
  if (viewChatInterval) {
    clearInterval(viewChatInterval);
    viewChatInterval = null;
  }
}

async function markAsRead(conversationId) {
  try {
    await fetch(`/chat/conversations/${conversationId}/view`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error('Failed to mark as read:', error);
  }
}
```

**Opsi B: Saat Screen Visible/Focus**

```javascript
useEffect(() => {
  if (isScreenVisible && conversationId) {
    // Mark as read saat screen visible
    markAsRead(conversationId);
    
    // Setup interval untuk polling
    const interval = setInterval(() => {
      markAsRead(conversationId);
    }, 3000);
    
    return () => clearInterval(interval);
  }
}, [isScreenVisible, conversationId]);
```

**Opsi C: Reload Messages tanpa Before**

```javascript
// Reload messages tanpa before parameter untuk trigger auto-read
async function reloadMessagesForAutoRead(conversationId) {
  try {
    // Panggil tanpa before = auto-read akan terjadi
    await fetch(`/chat/conversations/${conversationId}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error('Failed to reload messages:', error);
  }
}

// Panggil setiap beberapa detik saat user di detail chat
setInterval(() => {
  if (isUserViewingChat) {
    reloadMessagesForAutoRead(conversationId);
  }
}, 5000);
```

## 📱 Framework-Specific Examples

### Flutter/Dart

```dart
class ChatDetailScreen extends StatefulWidget {
  final String conversationId;
  
  @override
  _ChatDetailScreenState createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends State<ChatDetailScreen> 
    with WidgetsBindingObserver {
  Timer? _markAsReadTimer;
  bool _isScreenVisible = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    
    // Mark as read saat pertama kali masuk
    _markAsRead();
    
    // Setup timer untuk polling
    _startMarkAsReadTimer();
    
    // Setup MQTT subscription
    _setupMqttSubscription();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _markAsReadTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _isScreenVisible = state == AppLifecycleState.resumed;
    if (_isScreenVisible) {
      _markAsRead();
      _startMarkAsReadTimer();
    } else {
      _markAsReadTimer?.cancel();
    }
  }

  void _startMarkAsReadTimer() {
    _markAsReadTimer?.cancel();
    _markAsReadTimer = Timer.periodic(Duration(seconds: 3), (timer) {
      if (_isScreenVisible) {
        _markAsRead();
      }
    });
  }

  Future<void> _markAsRead() async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/chat/conversations/${widget.conversationId}/view'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );
      
      if (response.statusCode == 200) {
        print('Messages marked as read');
      }
    } catch (e) {
      print('Failed to mark as read: $e');
    }
  }

  void _setupMqttSubscription() {
    // Subscribe to read receipts
    mqttClient.subscribe('chat/$userId/read-receipts', (payload) {
      final data = json.decode(payload);
      _handleReadReceipt(data);
    });
    
    // Subscribe to conversation updates
    mqttClient.subscribe('chat/$userId/conversations', (payload) {
      final data = json.decode(payload);
      _handleConversationUpdate(data);
    });
  }

  void _handleReadReceipt(Map<String, dynamic> payload) {
    final conversationId = payload['conversation_id'];
    final readAt = payload['read_at'];
    
    if (conversationId == widget.conversationId) {
      // Update message status in UI
      setState(() {
        // Update messages status to 'read'
        // Update read_at timestamp
      });
    }
  }

  void _handleConversationUpdate(Map<String, dynamic> payload) {
    if (payload['action'] == 'messages_read') {
      // Update conversation list
      // Update unread count
    }
  }
}
```

### React/Next.js

```typescript
import { useEffect, useRef } from 'react';
import { useMqtt } from '@/hooks/useMqtt';

export function ChatDetailScreen({ conversationId }: { conversationId: string }) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { subscribe, unsubscribe } = useMqtt();

  useEffect(() => {
    // Mark as read saat pertama kali masuk
    markAsRead(conversationId);

    // Setup polling untuk real-time mark as read
    intervalRef.current = setInterval(() => {
      markAsRead(conversationId);
    }, 3000);

    // Setup MQTT subscription
    const readReceiptHandler = (payload: any) => {
      if (payload.conversation_id === conversationId) {
        // Update message status in state
        updateMessageStatus(payload);
      }
    };

    const conversationUpdateHandler = (payload: any) => {
      if (payload.action === 'messages_read') {
        // Update conversation list
        updateConversationList(payload);
      }
    };

    subscribe(`chat/${userId}/read-receipts`, readReceiptHandler);
    subscribe(`chat/${userId}/conversations`, conversationUpdateHandler);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      unsubscribe(`chat/${userId}/read-receipts`);
      unsubscribe(`chat/${userId}/conversations`);
    };
  }, [conversationId]);

  const markAsRead = async (conversationId: string) => {
    try {
      await fetch(`/chat/conversations/${conversationId}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  return (
    // Chat UI
  );
}
```

### Vue.js

```javascript
export default {
  name: 'ChatDetailScreen',
  props: {
    conversationId: String
  },
  data() {
    return {
      markAsReadInterval: null
    };
  },
  mounted() {
    // Mark as read saat pertama kali masuk
    this.markAsRead();
    
    // Setup polling
    this.markAsReadInterval = setInterval(() => {
      this.markAsRead();
    }, 3000);
    
    // Setup MQTT subscription
    this.setupMqttSubscription();
  },
  beforeUnmount() {
    if (this.markAsReadInterval) {
      clearInterval(this.markAsReadInterval);
    }
    this.unsubscribeMqtt();
  },
  methods: {
    async markAsRead() {
      try {
        await this.$http.post(
          `/chat/conversations/${this.conversationId}/view`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${this.token}`
            }
          }
        );
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    },
    setupMqttSubscription() {
      this.$mqtt.subscribe(`chat/${this.userId}/read-receipts`, (payload) => {
        if (payload.conversation_id === this.conversationId) {
          this.updateMessageStatus(payload);
        }
      });
      
      this.$mqtt.subscribe(`chat/${this.userId}/conversations`, (payload) => {
        if (payload.action === 'messages_read') {
          this.updateConversationList(payload);
        }
      });
    }
  }
};
```

## ✅ Checklist Implementasi

- [ ] Setup MQTT subscription untuk `chat/{userId}/read-receipts`
- [ ] Setup MQTT subscription untuk `chat/{userId}/messages-status`
- [ ] Setup MQTT subscription untuk `chat/{userId}/conversations`
- [ ] Implementasi handler untuk read receipt (update status di detail chat)
- [ ] Implementasi handler untuk conversation update (update list chat)
- [ ] Implementasi polling endpoint `/view` saat user di detail chat
- [ ] Handle screen visibility/focus untuk pause/resume polling
- [ ] Update UI untuk menampilkan status "read" dengan benar
- [ ] Update unread count/badge di conversation list
- [ ] Test real-time mark as read di detail chat
- [ ] Test real-time update di conversation list

## 🎯 Best Practices

1. **Polling Interval:** Gunakan interval 3-5 detik untuk polling endpoint `/view`
2. **Screen Visibility:** Pause polling saat screen tidak visible untuk save resources
3. **Error Handling:** Handle error dengan baik, jangan biarkan polling gagal terus menerus
4. **MQTT Reconnection:** Handle MQTT reconnection untuk memastikan subscription tetap aktif
5. **Debouncing:** Pertimbangkan debouncing untuk update UI yang terlalu sering

## 🐛 Troubleshooting

### Pesan tidak ter-mark as read
- Pastikan endpoint `/view` dipanggil secara berkala
- Pastikan tidak ada parameter `before` saat memanggil `getMessages` untuk first load
- Check log backend untuk memastikan auto-read terjadi

### Status tidak ter-update real-time
- Pastikan MQTT subscription aktif
- Check MQTT connection status
- Verify topic subscription benar

### Unread count tidak ter-update
- Pastikan subscribe ke `chat/{userId}/conversations`
- Check handler untuk `action: 'messages_read'`
- Verify payload structure sesuai

## 📚 Additional Resources

- Backend API Documentation: `DOCUMENTATION.md`
- MQTT Configuration: Check MQTT broker settings
- Real-time Updates: Ensure WebSocket/MQTT connection is stable

---

**Note:** Implementasi ini memastikan pesan ter-mark as read secara real-time baik saat user membuka chat maupun saat user sedang berada di detail chat, tanpa perlu reload atau keluar-masuk chat.

