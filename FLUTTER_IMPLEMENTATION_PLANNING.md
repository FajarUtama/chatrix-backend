# Planning Implementasi Auto Read Chat - Flutter

## 📋 Overview

Dokumen ini berisi planning lengkap untuk implementasi auto-read chat messages di aplikasi Flutter. Backend sudah otomatis menandai pesan sebagai "read" ketika chat dibuka, jadi frontend Flutter perlu disesuaikan untuk memanfaatkan fitur ini.

## 🎯 Tujuan

1. Menghapus manual call ke endpoint `POST /chat/conversations/:id/read` (opsional)
2. Memastikan `GET /chat/conversations/:id/messages` dipanggil tanpa `before` saat pertama kali membuka chat
3. Memastikan `POST /chat/conversations/ensure` dipanggil saat membuka conversation
4. Update UI untuk menampilkan status "read" dengan benar

## 📁 Struktur Folder yang Direkomendasikan

```
lib/
├── models/
│   ├── message.dart
│   ├── conversation.dart
│   └── read_receipt.dart
├── services/
│   ├── api_service.dart (base API service)
│   ├── chat_service.dart
│   └── mqtt_service.dart (jika menggunakan MQTT)
├── providers/
│   └── chat_provider.dart (Riverpod/Provider/Bloc)
├── screens/
│   ├── chat_list_screen.dart
│   └── chat_detail_screen.dart
└── widgets/
    └── message_bubble.dart
```

## 🔧 Step-by-Step Implementation

### Step 1: Update Models

#### 1.1 Message Model (`lib/models/message.dart`)

```dart
class Message {
  final String id;
  final String conversationId;
  final String senderId;
  final String type; // 'text', 'image', 'video', 'file', 'voice', 'system'
  final String? text;
  final MessageMedia? media;
  final String status; // 'pending', 'failed', 'sent', 'delivered', 'read'
  final DateTime? sentAt;
  final DateTime? deliveredAt;
  final DateTime? readAt;
  final List<String> readBy;
  final DateTime createdAt;
  final DateTime? updatedAt;

  Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.type,
    this.text,
    this.media,
    required this.status,
    this.sentAt,
    this.deliveredAt,
    this.readAt,
    required this.readBy,
    required this.createdAt,
    this.updatedAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] ?? json['_id'] ?? '',
      conversationId: json['conversation_id'] ?? '',
      senderId: json['sender_id'] ?? '',
      type: json['type'] ?? 'text',
      text: json['text'],
      media: json['media'] != null ? MessageMedia.fromJson(json['media']) : null,
      status: json['status'] ?? 'sent',
      sentAt: json['sent_at'] != null ? DateTime.parse(json['sent_at']) : null,
      deliveredAt: json['delivered_at'] != null 
          ? DateTime.parse(json['delivered_at']) 
          : null,
      readAt: json['read_at'] != null 
          ? DateTime.parse(json['read_at']) 
          : null,
      readBy: List<String>.from(json['read_by'] ?? []),
      createdAt: DateTime.parse(json['created_at'] ?? json['createdAt'] ?? ''),
      updatedAt: json['updated_at'] != null 
          ? DateTime.parse(json['updated_at']) 
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'conversation_id': conversationId,
      'sender_id': senderId,
      'type': type,
      'text': text,
      'media': media?.toJson(),
      'status': status,
      'sent_at': sentAt?.toIso8601String(),
      'delivered_at': deliveredAt?.toIso8601String(),
      'read_at': readAt?.toIso8601String(),
      'read_by': readBy,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  bool get isRead => status == 'read';
  bool get isDelivered => status == 'delivered' || isRead;
  bool get isSent => status == 'sent' || isDelivered;
}

class MessageMedia {
  final String url;
  final String type;
  final String? fileName;
  final int? size;
  final String? thumbUrl;

  MessageMedia({
    required this.url,
    required this.type,
    this.fileName,
    this.size,
    this.thumbUrl,
  });

  factory MessageMedia.fromJson(Map<String, dynamic> json) {
    return MessageMedia(
      url: json['url'] ?? '',
      type: json['type'] ?? '',
      fileName: json['file_name'],
      size: json['size'],
      thumbUrl: json['thumb_url'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'url': url,
      'type': type,
      'file_name': fileName,
      'size': size,
      'thumb_url': thumbUrl,
    };
  }
}
```

#### 1.2 Conversation Model (`lib/models/conversation.dart`)

```dart
class Conversation {
  final String id;
  final String type; // 'direct' or 'group'
  final List<String> participantIds;
  final DateTime? lastMessageAt;
  final String? lastMessagePreview;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Conversation({
    required this.id,
    required this.type,
    required this.participantIds,
    this.lastMessageAt,
    this.lastMessagePreview,
    this.createdAt,
    this.updatedAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] ?? json['_id'] ?? '',
      type: json['type'] ?? 'direct',
      participantIds: List<String>.from(json['participant_ids'] ?? []),
      lastMessageAt: json['last_message_at'] != null
          ? DateTime.parse(json['last_message_at'])
          : null,
      lastMessagePreview: json['last_message_preview'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
```

### Step 2: Update Chat Service

#### 2.1 Chat Service (`lib/services/chat_service.dart`)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/message.dart';
import '../models/conversation.dart';
import 'api_service.dart'; // Base API service dengan auth handling

class ChatService {
  final ApiService _apiService;
  final String baseUrl;

  ChatService({
    required ApiService apiService,
    required this.baseUrl,
  }) : _apiService = apiService;

  /// Get messages in a conversation
  /// IMPORTANT: Jangan pass parameter 'before' saat pertama kali load
  /// Backend akan otomatis mark as read jika 'before' tidak ada
  Future<List<Message>> getMessages(
    String conversationId, {
    int limit = 20,
    String? before, // Hanya untuk pagination, bukan untuk first load
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
      };
      
      // Hanya tambahkan 'before' jika ada (untuk pagination)
      // Jika tidak ada 'before', backend akan otomatis mark as read
      if (before != null) {
        queryParams['before'] = before;
      }

      final uri = Uri.parse('$baseUrl/chat/conversations/$conversationId/messages')
          .replace(queryParameters: queryParams);

      final response = await _apiService.get(uri);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final messages = (data['messages'] as List)
            .map((msg) => Message.fromJson(msg))
            .toList();

        // ✅ Messages sudah otomatis ter-mark as read oleh backend
        // Tidak perlu memanggil markAsRead() lagi
        
        return messages;
      } else {
        throw Exception('Failed to load messages: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error loading messages: $e');
    }
  }

  /// Ensure conversation exists (create or get existing)
  /// Backend akan otomatis mark as read ketika conversation dibuka
  Future<Conversation> ensureConversation(String recipientId) async {
    try {
      final uri = Uri.parse('$baseUrl/chat/conversations/ensure');
      
      final response = await _apiService.post(
        uri,
        body: json.encode({'recipientId': recipientId}),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        // ✅ Messages sudah otomatis ter-mark as read oleh backend
        // Tidak perlu memanggil markAsRead() lagi
        
        return Conversation.fromJson(data);
      } else {
        throw Exception('Failed to ensure conversation: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error ensuring conversation: $e');
    }
  }

  /// Get list of conversations
  Future<List<Conversation>> getConversations({
    int limit = 20,
    String? before,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
      };
      
      if (before != null) {
        queryParams['before'] = before;
      }

      final uri = Uri.parse('$baseUrl/chat/conversations')
          .replace(queryParameters: queryParams);

      final response = await _apiService.get(uri);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return (data['conversations'] as List)
            .map((conv) => Conversation.fromJson(conv))
            .toList();
      } else {
        throw Exception('Failed to load conversations: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error loading conversations: $e');
    }
  }

  /// Send a message
  Future<Message> sendMessage({
    required String conversationId,
    required String content,
    String type = 'text',
    Map<String, dynamic>? media,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/chat/messages');
      
      final body = {
        'conversationId': conversationId,
        'content': content,
        'type': type,
        if (media != null) 'attachments': [media],
      };

      final response = await _apiService.post(
        uri,
        body: json.encode(body),
      );

      if (response.statusCode == 201) {
        final data = json.decode(response.body);
        return Message.fromJson(data);
      } else {
        throw Exception('Failed to send message: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error sending message: $e');
    }
  }

  /// ❌ DEPRECATED: Tidak perlu lagi karena backend sudah auto-read
  /// Tapi masih tersedia jika diperlukan untuk use case khusus
  @Deprecated('Backend sudah otomatis mark as read. Gunakan getMessages() atau ensureConversation() saja.')
  Future<void> markAsRead(String conversationId) async {
    try {
      final uri = Uri.parse('$baseUrl/chat/conversations/$conversationId/read');
      
      final response = await _apiService.post(uri);

      if (response.statusCode != 200) {
        throw Exception('Failed to mark as read: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error marking as read: $e');
    }
  }
}
```

### Step 3: Update Chat Provider/State Management

#### 3.1 Chat Provider dengan Riverpod (`lib/providers/chat_provider.dart`)

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/message.dart';
import '../models/conversation.dart';
import '../services/chat_service.dart';

// Chat Service Provider
final chatServiceProvider = Provider<ChatService>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  return ChatService(
    apiService: apiService,
    baseUrl: 'https://your-api-url.com', // Ganti dengan base URL Anda
  );
});

// Messages Provider untuk chat detail
final messagesProvider = StateNotifierProvider<MessagesNotifier, MessagesState>(
  (ref) => MessagesNotifier(ref.watch(chatServiceProvider)),
);

class MessagesState {
  final List<Message> messages;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final String? nextCursor;
  final bool hasMore;

  MessagesState({
    this.messages = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.nextCursor,
    this.hasMore = false,
  });

  MessagesState copyWith({
    List<Message>? messages,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    String? nextCursor,
    bool? hasMore,
  }) {
    return MessagesState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: error ?? this.error,
      nextCursor: nextCursor ?? this.nextCursor,
      hasMore: hasMore ?? this.hasMore,
    );
  }
}

class MessagesNotifier extends StateNotifier<MessagesState> {
  final ChatService _chatService;
  String? _currentConversationId;

  MessagesNotifier(this._chatService) : super(MessagesState());

  /// Load messages untuk pertama kali (akan otomatis mark as read)
  Future<void> loadMessages(String conversationId) async {
    if (_currentConversationId == conversationId && state.messages.isNotEmpty) {
      // Sudah loaded, tidak perlu reload
      return;
    }

    _currentConversationId = conversationId;
    state = state.copyWith(isLoading: true, error: null);

    try {
      // ✅ PENTING: Jangan pass 'before' parameter untuk first load
      // Backend akan otomatis mark as read jika 'before' tidak ada
      final messages = await _chatService.getMessages(conversationId);

      state = state.copyWith(
        messages: messages.reversed.toList(), // Reverse untuk tampilan chat
        isLoading: false,
        hasMore: messages.length >= 20, // Asumsi limit 20
        nextCursor: messages.isNotEmpty ? messages.last.id : null,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  /// Load more messages (pagination) - TIDAK akan mark as read
  Future<void> loadMoreMessages() async {
    if (state.isLoadingMore || !state.hasMore || state.nextCursor == null) {
      return;
    }

    if (_currentConversationId == null) return;

    state = state.copyWith(isLoadingMore: true);

    try {
      // ✅ Pass 'before' untuk pagination - tidak akan mark as read
      final messages = await _chatService.getMessages(
        _currentConversationId!,
        before: state.nextCursor,
      );

      if (messages.isEmpty) {
        state = state.copyWith(
          isLoadingMore: false,
          hasMore: false,
        );
        return;
      }

      final updatedMessages = [
        ...messages.reversed.toList(),
        ...state.messages,
      ];

      state = state.copyWith(
        messages: updatedMessages,
        isLoadingMore: false,
        hasMore: messages.length >= 20,
        nextCursor: messages.last.id,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        error: e.toString(),
      );
    }
  }

  /// Add new message (untuk real-time update)
  void addMessage(Message message) {
    final updatedMessages = [...state.messages, message];
    state = state.copyWith(messages: updatedMessages);
  }

  /// Update message status (untuk read receipt dari MQTT)
  void updateMessageStatus(String messageId, String status, DateTime? readAt) {
    final updatedMessages = state.messages.map((msg) {
      if (msg.id == messageId) {
        return Message(
          id: msg.id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          type: msg.type,
          text: msg.text,
          media: msg.media,
          status: status,
          sentAt: msg.sentAt,
          deliveredAt: msg.deliveredAt,
          readAt: readAt,
          readBy: msg.readBy,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
        );
      }
      return msg;
    }).toList();

    state = state.copyWith(messages: updatedMessages);
  }

  void clear() {
    _currentConversationId = null;
    state = MessagesState();
  }
}

// Conversations Provider
final conversationsProvider = StateNotifierProvider<ConversationsNotifier, ConversationsState>(
  (ref) => ConversationsNotifier(ref.watch(chatServiceProvider)),
);

class ConversationsState {
  final List<Conversation> conversations;
  final bool isLoading;
  final String? error;

  ConversationsState({
    this.conversations = const [],
    this.isLoading = false,
    this.error,
  });

  ConversationsState copyWith({
    List<Conversation>? conversations,
    bool? isLoading,
    String? error,
  }) {
    return ConversationsState(
      conversations: conversations ?? this.conversations,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}

class ConversationsNotifier extends StateNotifier<ConversationsState> {
  final ChatService _chatService;

  ConversationsNotifier(this._chatService) : super(ConversationsState());

  Future<void> loadConversations() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final conversations = await _chatService.getConversations();
      state = state.copyWith(
        conversations: conversations,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }
}
```

### Step 4: Update Chat Detail Screen

#### 4.1 Chat Detail Screen (`lib/screens/chat_detail_screen.dart`)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/chat_provider.dart';

class ChatDetailScreen extends ConsumerStatefulWidget {
  final String conversationId;
  final String? recipientId; // Untuk ensure conversation jika belum ada

  const ChatDetailScreen({
    Key? key,
    required this.conversationId,
    this.recipientId,
  }) : super(key: key);

  @override
  ConsumerState<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends ConsumerState<ChatDetailScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    
    // Load messages saat screen pertama kali dibuka
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadMessages();
    });

    // Setup scroll controller untuk pagination
    _scrollController.addListener(_onScroll);
  }

  void _loadMessages() async {
    final chatService = ref.read(chatServiceProvider);
    
    // Jika ada recipientId, ensure conversation dulu
    if (widget.recipientId != null) {
      try {
        await chatService.ensureConversation(widget.recipientId!);
        // ✅ ensureConversation sudah otomatis mark as read
      } catch (e) {
        print('Error ensuring conversation: $e');
      }
    }
    
    // Load messages - akan otomatis mark as read jika first load
    ref.read(messagesProvider.notifier).loadMessages(widget.conversationId);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= 
        _scrollController.position.maxScrollExtent * 0.8) {
      // Load more ketika scroll mendekati atas
      ref.read(messagesProvider.notifier).loadMoreMessages();
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    ref.read(messagesProvider.notifier).clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final messagesState = ref.watch(messagesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat'),
      ),
      body: Column(
        children: [
          // Messages List
          Expanded(
            child: messagesState.isLoading && messagesState.messages.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : messagesState.error != null
                    ? Center(child: Text('Error: ${messagesState.error}'))
                    : messagesState.messages.isEmpty
                        ? const Center(child: Text('No messages'))
                        : ListView.builder(
                            controller: _scrollController,
                            reverse: true, // Chat biasanya reverse
                            itemCount: messagesState.messages.length + 
                                (messagesState.isLoadingMore ? 1 : 0),
                            itemBuilder: (context, index) {
                              if (index == messagesState.messages.length) {
                                return const Center(
                                  child: Padding(
                                    padding: EdgeInsets.all(8.0),
                                    child: CircularProgressIndicator(),
                                  ),
                                );
                              }

                              final message = messagesState.messages[index];
                              return MessageBubble(message: message);
                            },
                          ),
          ),
          
          // Input field untuk send message
          // ... (implementasi input field)
        ],
      ),
    );
  }
}
```

### Step 5: Update Message Bubble Widget

#### 5.1 Message Bubble (`lib/widgets/message_bubble.dart`)

```dart
import 'package:flutter/material.dart';
import '../models/message.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe; // Dari current user atau tidak

  const MessageBubble({
    Key? key,
    required this.message,
    required this.isMe,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isMe ? Colors.blue : Colors.grey[300],
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.text ?? '',
              style: TextStyle(
                color: isMe ? Colors.white : Colors.black,
              ),
            ),
            const SizedBox(height: 4),
            // Status indicator
            if (isMe)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Status icon
                  Icon(
                    _getStatusIcon(),
                    size: 12,
                    color: Colors.white70,
                  ),
                  const SizedBox(width: 4),
                  // Status text
                  Text(
                    _getStatusText(),
                    style: const TextStyle(
                      fontSize: 10,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  IconData _getStatusIcon() {
    switch (message.status) {
      case 'read':
        return Icons.done_all;
      case 'delivered':
        return Icons.done_all;
      case 'sent':
        return Icons.done;
      default:
        return Icons.schedule;
    }
  }

  String _getStatusText() {
    switch (message.status) {
      case 'read':
        return 'Read';
      case 'delivered':
        return 'Delivered';
      case 'sent':
        return 'Sent';
      default:
        return 'Pending';
    }
  }
}
```

### Step 6: MQTT Integration (Optional)

Jika menggunakan MQTT untuk real-time updates:

```dart
// lib/services/mqtt_service.dart
class MqttService {
  // ... existing MQTT setup ...

  void subscribeToReadReceipts(String userId) {
    subscribe('chat/$userId/read-receipts', (payload) {
      final data = json.decode(payload);
      final conversationId = data['conversation_id'];
      final readBy = data['read_by'];
      final readAt = DateTime.parse(data['read_at']);
      
      // Update messages status di provider
      // ref.read(messagesProvider.notifier).updateMessageStatus(...)
    });
  }
}
```

## ✅ Migration Checklist

### Code Changes
- [ ] Update `Message` model untuk include `readAt` dan `readBy`
- [ ] Update `ChatService.getMessages()` - hapus manual `markAsRead()` call
- [ ] Update `ChatService.ensureConversation()` - hapus manual `markAsRead()` call
- [ ] Pastikan `getMessages()` dipanggil tanpa `before` untuk first load
- [ ] Update Chat Provider untuk handle auto-read
- [ ] Update Chat Detail Screen untuk load messages dengan benar
- [ ] Update Message Bubble untuk tampilkan status "read"

### Testing
- [ ] Test: Buka chat detail → Pesan otomatis ter-mark as read
- [ ] Test: Buka conversation dari list → Pesan otomatis ter-mark as read
- [ ] Test: Load more messages → Pesan lama tidak ter-mark as read
- [ ] Test: Read receipt dari MQTT → Status update dengan benar
- [ ] Test: UI menampilkan status "read" dengan benar

### Cleanup (Optional)
- [ ] Hapus manual call ke `markAsRead()` jika ada
- [ ] Hapus atau deprecate method `markAsRead()` di service
- [ ] Update dokumentasi internal

## 🚨 Important Notes

1. **Pagination:** Auto-read hanya terjadi pada first load (tanpa `before`). Pastikan saat load more, selalu pass parameter `before`.

2. **Error Handling:** Backend sudah handle error dengan baik, jadi frontend tidak perlu worry jika auto-read gagal.

3. **Performance:** Auto-read dilakukan async di backend, jadi tidak akan memperlambat response time.

4. **Backward Compatibility:** Endpoint `POST /chat/conversations/:id/read` masih tersedia jika diperlukan untuk use case khusus.

## 📚 Dependencies yang Diperlukan

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
  flutter_riverpod: ^2.4.0  # atau provider/bloc sesuai pilihan
  # ... dependencies lainnya
```

## 🎯 Expected Behavior

1. User membuka chat detail → Messages otomatis ter-mark as read
2. User membuka conversation dari list → Messages otomatis ter-mark as read
3. User scroll ke atas (load more) → Messages lama tidak ter-mark as read
4. Read receipt dari MQTT → UI update status dengan benar

## 📝 Next Steps

1. Review planning ini dengan team
2. Implement sesuai step-by-step di atas
3. Test thoroughly
4. Deploy ke staging
5. Monitor untuk memastikan tidak ada issue

