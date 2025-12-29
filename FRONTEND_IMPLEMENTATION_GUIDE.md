# Frontend Implementation Guide - Auto Read Chat Messages

## Overview

Backend telah diupdate untuk secara otomatis menandai pesan sebagai "read" ketika chat dibuka. Implementasi ini sudah dilakukan di backend, jadi frontend tidak perlu melakukan perubahan besar. Namun, ada beberapa hal yang perlu diperhatikan dan optimasi yang bisa dilakukan.

## Perubahan Backend

### 1. Auto-Read pada Get Messages
Endpoint `GET /chat/conversations/:id/messages` sekarang secara otomatis akan menandai semua pesan sebagai "read" ketika dipanggil **hanya pada halaman pertama** (tanpa parameter `before` untuk pagination).

### 2. Auto-Read pada Ensure Conversation
Endpoint `POST /chat/conversations/ensure` sekarang secara otomatis akan menandai semua pesan sebagai "read" ketika conversation dibuka.

## Implementasi Frontend

### Opsi 1: Tidak Perlu Perubahan (Recommended)
Karena backend sudah otomatis menandai pesan sebagai read, frontend **tidak perlu** memanggil endpoint `POST /chat/conversations/:id/read` secara manual lagi. Backend akan menangani ini secara otomatis.

**Yang perlu dilakukan:**
- Pastikan ketika user membuka chat detail, frontend memanggil `GET /chat/conversations/:id/messages` tanpa parameter `before` untuk halaman pertama
- Pastikan ketika user membuka/ensure conversation, frontend memanggil `POST /chat/conversations/ensure`

### Opsi 2: Optimasi dengan Menghapus Manual Read Call
Jika sebelumnya frontend memanggil `POST /chat/conversations/:id/read` secara manual, **bisa dihapus** karena sudah otomatis.

**Contoh sebelum (tidak perlu lagi):**
```javascript
// ❌ Tidak perlu lagi
async function openChat(conversationId) {
  await fetch(`/chat/conversations/${conversationId}/messages`);
  await fetch(`/chat/conversations/${conversationId}/read`, { method: 'POST' }); // Hapus ini
}
```

**Contoh setelah:**
```javascript
// ✅ Cukup ini saja
async function openChat(conversationId) {
  await fetch(`/chat/conversations/${conversationId}/messages`);
  // Auto-read sudah ditangani backend
}
```

### Opsi 3: Tetap Mempertahankan Manual Read (Optional)
Jika ingin tetap mempertahankan kontrol manual, endpoint `POST /chat/conversations/:id/read` masih tersedia dan bisa digunakan. Namun, ini akan redundant karena backend sudah otomatis menandai sebagai read.

## Contoh Implementasi

### React/Next.js Example

```typescript
// hooks/useChat.ts
import { useState, useEffect } from 'react';

export function useChat(conversationId: string) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadMessages = async (before?: string) => {
    setLoading(true);
    try {
      const url = `/chat/conversations/${conversationId}/messages${before ? `?before=${before}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      
      // Messages sudah otomatis ter-mark as read oleh backend
      // Tidak perlu memanggil read endpoint lagi
      
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (conversationId) {
      // Load first page - akan otomatis mark as read
      loadMessages();
    }
  }, [conversationId]);

  return { messages, loading, loadMore: (before) => loadMessages(before) };
}
```

### Vue.js Example

```javascript
// composables/useChat.js
import { ref, onMounted } from 'vue';

export function useChat(conversationId) {
  const messages = ref([]);
  const loading = ref(false);

  const loadMessages = async (before = null) => {
    loading.value = true;
    try {
      const url = `/chat/conversations/${conversationId}/messages${before ? `?before=${before}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      
      // Messages sudah otomatis ter-mark as read oleh backend
      messages.value = data.messages;
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    if (conversationId) {
      // Load first page - akan otomatis mark as read
      loadMessages();
    }
  });

  return { messages, loading, loadMessages };
}
```

### Flutter/Dart Example

```dart
// services/chat_service.dart
class ChatService {
  Future<List<Message>> getMessages(String conversationId, {String? before}) async {
    final url = Uri.parse(
      '/chat/conversations/$conversationId/messages${before != null ? '?before=$before' : ''}'
    );
    
    final response = await http.get(
      url,
      headers: {
        'Authorization': 'Bearer $token',
      },
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      // Messages sudah otomatis ter-mark as read oleh backend
      // Tidak perlu memanggil read endpoint lagi
      return (data['messages'] as List)
          .map((msg) => Message.fromJson(msg))
          .toList();
    }
    
    throw Exception('Failed to load messages');
  }
}
```

## MQTT Read Receipts

Backend akan mengirim read receipt melalui MQTT ke pengirim pesan ketika pesan ditandai sebagai read. Frontend bisa subscribe ke topic ini untuk update real-time:

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

## Catatan Penting

1. **Pagination:** Auto-read hanya terjadi pada halaman pertama (tanpa parameter `before`). Ini untuk mencegah pesan lama ter-mark as read saat user melakukan pagination ke history.

2. **Error Handling:** Jika auto-read gagal di backend, request tetap akan berhasil. Error hanya di-log di backend dan tidak akan mengganggu user experience.

3. **Backward Compatibility:** Endpoint `POST /chat/conversations/:id/read` masih tersedia jika diperlukan untuk use case khusus.

4. **Performance:** Auto-read dilakukan secara asynchronous di backend, jadi tidak akan memperlambat response time secara signifikan.

## Testing

Untuk testing, pastikan:
1. Ketika user membuka chat detail, pesan otomatis ter-mark as read
2. Ketika user membuka conversation dari list, pesan otomatis ter-mark as read
3. Ketika user melakukan pagination (load more), pesan lama tidak ter-mark as read
4. Read receipt dikirim ke pengirim melalui MQTT

## Migration Checklist

- [ ] Hapus manual call ke `POST /chat/conversations/:id/read` (opsional)
- [ ] Pastikan `GET /chat/conversations/:id/messages` dipanggil tanpa `before` saat pertama kali membuka chat
- [ ] Pastikan `POST /chat/conversations/ensure` dipanggil saat membuka conversation
- [ ] Test bahwa pesan otomatis ter-mark as read
- [ ] Test bahwa read receipt diterima melalui MQTT (jika menggunakan MQTT)
- [ ] Update UI untuk menampilkan status "read" dengan benar

