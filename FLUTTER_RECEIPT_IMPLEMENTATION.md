# Implementasi Read Receipt untuk Flutter

Dokumen ini berisi contoh implementasi lengkap untuk read receipt realtime di Flutter yang sesuai dengan backend.

---

## 📋 Struktur File

```
lib/
├── core/
│   └── realtime/
│       └── mqtt_service.dart          # MQTT service (sudah ada)
├── features/
│   └── chat/
│       ├── data/
│       │   ├── models/
│       │   │   └── receipt_model.dart
│       │   └── receipt_publisher.dart
│       ├── domain/
│       │   └── entities/
│       │       └── receipt.dart
│       └── presentation/
│           ├── cubit/
│           │   └── chat_cubit.dart    # Update untuk handle receipt
│           └── pages/
│               └── chat_page.dart     # Update untuk listen receipt
```

---

## 1. Model: Receipt Entity

**File:** `lib/features/chat/domain/entities/receipt.dart`

```dart
enum ReceiptType {
  readUpTo,
  deliveredUpTo,
}

class Receipt {
  final ReceiptType type;
  final String conversationId;
  final String actorUserId;
  final String? lastReadMessageId;
  final String? lastDeliveredMessageId;
  final DateTime timestamp;

  Receipt({
    required this.type,
    required this.conversationId,
    required this.actorUserId,
    this.lastReadMessageId,
    this.lastDeliveredMessageId,
    required this.timestamp,
  });

  factory Receipt.fromJson(Map<String, dynamic> json) {
    final typeStr = json['type'] as String;
    final type = typeStr == 'read_up_to' 
        ? ReceiptType.readUpTo 
        : ReceiptType.deliveredUpTo;

    return Receipt(
      type: type,
      conversationId: json['conversation_id'] as String,
      actorUserId: json['actor_user_id'] as String,
      lastReadMessageId: json['last_read_message_id'] as String?,
      lastDeliveredMessageId: json['last_delivered_message_id'] as String?,
      timestamp: DateTime.parse(json['ts'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type == ReceiptType.readUpTo ? 'read_up_to' : 'delivered_up_to',
      'conversation_id': conversationId,
      'actor_user_id': actorUserId,
      if (lastReadMessageId != null) 'last_read_message_id': lastReadMessageId,
      if (lastDeliveredMessageId != null) 
        'last_delivered_message_id': lastDeliveredMessageId,
      'ts': timestamp.toIso8601String(),
    };
  }
}
```

---

## 2. Receipt Publisher Service

**File:** `lib/features/chat/data/receipt_publisher.dart`

```dart
import 'package:mqtt_client/mqtt_client.dart';
import '../domain/entities/receipt.dart';

/// Service untuk publish read/delivered receipts ke MQTT
class ReceiptPublisher {
  final MqttClient mqttClient;
  static const String receiptsTopic = 'chat/v1/receipts';

  ReceiptPublisher(this.mqttClient);

  /// Publish read_up_to receipt
  /// Dipanggil ketika user membaca pesan (mark as read)
  Future<void> publishReadUpTo({
    required String conversationId,
    required String actorUserId,
    required String lastReadMessageId,
  }) async {
    final receipt = Receipt(
      type: ReceiptType.readUpTo,
      conversationId: conversationId,
      actorUserId: actorUserId,
      lastReadMessageId: lastReadMessageId,
      timestamp: DateTime.now(),
    );

    await _publishReceipt(receipt);
  }

  /// Publish delivered_up_to receipt
  /// Dipanggil ketika user menerima pesan (delivered)
  Future<void> publishDeliveredUpTo({
    required String conversationId,
    required String actorUserId,
    required String lastDeliveredMessageId,
  }) async {
    final receipt = Receipt(
      type: ReceiptType.deliveredUpTo,
      conversationId: conversationId,
      actorUserId: actorUserId,
      lastDeliveredMessageId: lastDeliveredMessageId,
      timestamp: DateTime.now(),
    );

    await _publishReceipt(receipt);
  }

  Future<void> _publishReceipt(Receipt receipt) async {
    try {
      final builder = MqttClientPayloadBuilder();
      builder.addString(jsonEncode(receipt.toJson()));

      mqttClient.publishMessage(
        receiptsTopic,
        MqttQos.atLeastOnce,
        builder.payload!,
      );

      print('✅ Published receipt: ${receipt.type} for conversation ${receipt.conversationId}');
    } catch (e) {
      print('❌ Error publishing receipt: $e');
      rethrow;
    }
  }
}
```

---

## 3. Update MQTT Service untuk Subscribe Receipts

**File:** `lib/core/realtime/mqtt_service.dart` (update existing)

```dart
import 'package:mqtt_client/mqtt_client.dart';
import 'package:rxdart/rxdart.dart';
import '../../features/chat/domain/entities/receipt.dart';

class MqttService {
  MqttClient? _client;
  final String userId;
  
  // Stream untuk receipt updates
  final _receiptController = BehaviorSubject<Receipt>();
  Stream<Receipt> get receiptStream => _receiptController.stream;

  MqttService(this.userId);

  Future<void> connect() async {
    // ... existing connection code ...
    
    // Subscribe ke receipts topic setelah connect
    await _subscribeToReceipts();
  }

  /// Subscribe ke topic receipts untuk user ini
  Future<void> _subscribeToReceipts() async {
    if (_client == null || _client!.connectionStatus?.state != MqttConnectionState.connected) {
      return;
    }

    final receiptsTopic = 'chat/v1/users/$userId/receipts';
    
    _client!.subscribe(receiptsTopic, MqttQos.atLeastOnce);
    print('✅ Subscribed to receipts topic: $receiptsTopic');

    // Listen untuk messages di topic ini
    _client!.upstream!.listen((MqttReceivedMessage<MqttMessage> message) {
      final topic = message.topic;
      
      if (topic == receiptsTopic) {
        _handleReceiptMessage(message);
      }
      // ... handle other topics ...
    });
  }

  /// Handle receipt message dari MQTT
  void _handleReceiptMessage(MqttReceivedMessage<MqttMessage> message) {
    try {
      final payload = MqttPublishMessage.bytesToStringAsString(
        message.message.payload.message,
      );
      
      final json = jsonDecode(payload) as Map<String, dynamic>;
      final receipt = Receipt.fromJson(json);
      
      print('📨 Received receipt: ${receipt.type} for conversation ${receipt.conversationId}');
      
      // Emit ke stream
      _receiptController.add(receipt);
    } catch (e) {
      print('❌ Error parsing receipt message: $e');
    }
  }

  void dispose() {
    _receiptController.close();
  }
}
```

---

## 4. Update Chat Cubit untuk Handle Receipts

**File:** `lib/features/chat/presentation/cubit/chat_cubit.dart` (update existing)

```dart
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/receipt.dart';
import '../../domain/entities/message.dart';
import '../../../core/realtime/mqtt_service.dart';
import '../../data/receipt_publisher.dart';

class ChatState extends Equatable {
  final List<Message> messages;
  final bool isLoading;
  final String? error;

  const ChatState({
    required this.messages,
    this.isLoading = false,
    this.error,
  });

  ChatState copyWith({
    List<Message>? messages,
    bool? isLoading,
    String? error,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }

  @override
  List<Object?> get props => [messages, isLoading, error];
}

class ChatCubit extends Cubit<ChatState> {
  final MqttService mqttService;
  final ReceiptPublisher receiptPublisher;
  final String currentUserId;
  final String conversationId;

  StreamSubscription<Receipt>? _receiptSubscription;

  ChatCubit({
    required this.mqttService,
    required this.receiptPublisher,
    required this.currentUserId,
    required this.conversationId,
    required List<Message> initialMessages,
  }) : super(ChatState(messages: initialMessages)) {
    _listenToReceipts();
  }

  /// Listen ke receipt stream dari MQTT
  void _listenToReceipts() {
    _receiptSubscription = mqttService.receiptStream.listen((receipt) {
      // Hanya process receipt untuk conversation ini
      if (receipt.conversationId == conversationId) {
        applyReceiptUpdate(receipt);
      }
    });
  }

  /// Apply receipt update ke messages
  /// Update status message berdasarkan receipt yang diterima
  void applyReceiptUpdate(Receipt receipt) {
    final updatedMessages = List<Message>.from(state.messages);

    // Cari message yang perlu di-update berdasarkan receipt
    for (int i = 0; i < updatedMessages.length; i++) {
      final message = updatedMessages[i];

      // Hanya update message yang dikirim oleh current user
      if (message.senderId != currentUserId) {
        continue;
      }

      // Update berdasarkan receipt type
      if (receipt.type == ReceiptType.readUpTo && receipt.lastReadMessageId != null) {
        // Jika message_id <= last_read_message_id, status = 'read'
        if (_isMessageIdLessThanOrEqual(message.messageId, receipt.lastReadMessageId!)) {
          updatedMessages[i] = message.copyWith(status: MessageStatus.read);
        }
      } else if (receipt.type == ReceiptType.deliveredUpTo && 
                 receipt.lastDeliveredMessageId != null) {
        // Jika message_id <= last_delivered_message_id dan belum read, status = 'delivered'
        if (_isMessageIdLessThanOrEqual(message.messageId, receipt.lastDeliveredMessageId!) &&
            message.status != MessageStatus.read) {
          updatedMessages[i] = message.copyWith(status: MessageStatus.delivered);
        }
      }
    }

    emit(state.copyWith(messages: updatedMessages));
  }

  /// Helper: compare message IDs (ULID comparison)
  bool _isMessageIdLessThanOrEqual(String messageId, String watermarkId) {
    // ULID adalah lexicographically sortable
    return messageId.compareTo(watermarkId) <= 0;
  }

  /// Publish read receipt ketika user membaca pesan
  /// Dipanggil dari ChatPage ketika pesan terlihat di screen
  Future<void> publishReadUpToVisible() async {
    if (state.messages.isEmpty) return;

    // Ambil message terbaru yang terlihat (biasanya message pertama di list)
    final visibleMessage = state.messages.first;
    
    // Hanya publish jika message bukan dari current user
    if (visibleMessage.senderId == currentUserId) return;

    try {
      await receiptPublisher.publishReadUpTo(
        conversationId: conversationId,
        actorUserId: currentUserId,
        lastReadMessageId: visibleMessage.messageId,
      );
      
      print('✅ Published read_up_to for message: ${visibleMessage.messageId}');
    } catch (e) {
      print('❌ Error publishing read receipt: $e');
    }
  }

  /// Publish delivered receipt ketika pesan diterima
  /// Dipanggil ketika menerima message baru via MQTT
  Future<void> publishDeliveredUpTo(String messageId) async {
    try {
      await receiptPublisher.publishDeliveredUpTo(
        conversationId: conversationId,
        actorUserId: currentUserId,
        lastDeliveredMessageId: messageId,
      );
      
      print('✅ Published delivered_up_to for message: $messageId');
    } catch (e) {
      print('❌ Error publishing delivered receipt: $e');
    }
  }

  @override
  Future<void> close() {
    _receiptSubscription?.cancel();
    return super.close();
  }
}
```

---

## 5. Update Chat Page untuk Listen Receipts

**File:** `lib/features/chat/presentation/pages/chat_page.dart` (update existing)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubit/chat_cubit.dart';
import '../widgets/message_bubble.dart';

class ChatPage extends StatefulWidget {
  final String conversationId;
  final String currentUserId;

  const ChatPage({
    Key? key,
    required this.conversationId,
    required this.currentUserId,
  }) : super(key: key);

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final ScrollController _scrollController = ScrollController();
  bool _isUserScrolling = false;

  @override
  void initState() {
    super.initState();
    
    // Listen scroll untuk detect ketika user melihat pesan terbaru
    _scrollController.addListener(_onScroll);
    
    // Publish read receipt ketika page pertama kali dibuka
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _publishReadUpToVisible();
    });
  }

  void _onScroll() {
    // Detect jika user scroll ke atas (melihat pesan lama)
    if (_scrollController.position.pixels < 
        _scrollController.position.maxScrollExtent - 100) {
      _isUserScrolling = true;
    } else {
      // User scroll kembali ke bawah (melihat pesan terbaru)
      if (_isUserScrolling) {
        _isUserScrolling = false;
        _publishReadUpToVisible();
      }
    }
  }

  /// Publish read receipt untuk pesan yang terlihat di screen
  void _publishReadUpToVisible() {
    final cubit = context.read<ChatCubit>();
    cubit.publishReadUpToVisible();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat'),
      ),
      body: BlocConsumer<ChatCubit, ChatState>(
        listener: (context, state) {
          // Auto-scroll ke bawah ketika ada message baru
          if (state.messages.isNotEmpty) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (_scrollController.hasClients) {
                _scrollController.animateTo(
                  0,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOut,
                );
              }
            });
          }

          // Publish read receipt setelah message baru muncul
          _publishReadUpToVisible();
        },
        builder: (context, state) {
          return ListView.builder(
            controller: _scrollController,
            reverse: true, // Pesan terbaru di atas
            itemCount: state.messages.length,
            itemBuilder: (context, index) {
              final message = state.messages[index];
              return MessageBubble(
                message: message,
                isOwnMessage: message.senderId == widget.currentUserId,
              );
            },
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }
}
```

---

## 6. Update Message Model untuk Status

**File:** `lib/features/chat/domain/entities/message.dart` (update existing)

```dart
enum MessageStatus {
  sent,
  delivered,
  read,
}

class Message {
  final String messageId;
  final String conversationId;
  final String senderId;
  final String text;
  final MessageStatus status;
  final DateTime createdAt;

  Message({
    required this.messageId,
    required this.conversationId,
    required this.senderId,
    required this.text,
    required this.status,
    required this.createdAt,
  });

  Message copyWith({
    String? messageId,
    String? conversationId,
    String? senderId,
    String? text,
    MessageStatus? status,
    DateTime? createdAt,
  }) {
    return Message(
      messageId: messageId ?? this.messageId,
      conversationId: conversationId ?? this.conversationId,
      senderId: senderId ?? this.senderId,
      text: text ?? this.text,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory Message.fromJson(Map<String, dynamic> json) {
    // Parse status dari string
    MessageStatus status = MessageStatus.sent;
    final statusStr = json['status'] as String?;
    if (statusStr == 'delivered') {
      status = MessageStatus.delivered;
    } else if (statusStr == 'read') {
      status = MessageStatus.read;
    }

    return Message(
      messageId: json['message_id'] as String,
      conversationId: json['conversation_id'] as String,
      senderId: json['sender_id'] as String,
      text: json['text'] as String? ?? '',
      status: status,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
```

---

## 7. Update Message Bubble untuk Tampilkan Status

**File:** `lib/features/chat/presentation/widgets/message_bubble.dart`

```dart
import 'package:flutter/material.dart';
import '../../domain/entities/message.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final bool isOwnMessage;

  const MessageBubble({
    Key? key,
    required this.message,
    required this.isOwnMessage,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isOwnMessage ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isOwnMessage ? Colors.blue : Colors.grey[300],
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.text,
              style: TextStyle(
                color: isOwnMessage ? Colors.white : Colors.black,
              ),
            ),
            if (isOwnMessage) ...[
              const SizedBox(height: 4),
              _buildStatusIndicator(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusIndicator() {
    IconData icon;
    Color color;

    switch (message.status) {
      case MessageStatus.sent:
        icon = Icons.check;
        color = Colors.grey[400]!;
        break;
      case MessageStatus.delivered:
        icon = Icons.done_all;
        color = Colors.grey[400]!;
        break;
      case MessageStatus.read:
        icon = Icons.done_all;
        color = Colors.blue;
        break;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 4),
        Text(
          _getStatusText(),
          style: TextStyle(
            fontSize: 12,
            color: color,
          ),
        ),
      ],
    );
  }

  String _getStatusText() {
    switch (message.status) {
      case MessageStatus.sent:
        return 'Sent';
      case MessageStatus.delivered:
        return 'Delivered';
      case MessageStatus.read:
        return 'Read';
    }
  }
}
```

---

## 8. Integration: Setup di Main/App

**File:** `lib/main.dart` atau `lib/app.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/realtime/mqtt_service.dart';
import 'features/chat/data/receipt_publisher.dart';
import 'features/chat/presentation/cubit/chat_cubit.dart';

class App extends StatelessWidget {
  final String userId;
  final MqttService mqttService;

  const App({
    Key? key,
    required this.userId,
    required this.mqttService,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // Initialize ReceiptPublisher
    final receiptPublisher = ReceiptPublisher(mqttService.client!);

    return MaterialApp(
      home: BlocProvider(
        create: (context) => ChatCubit(
          mqttService: mqttService,
          receiptPublisher: receiptPublisher,
          currentUserId: userId,
          conversationId: 'conv-123', // dari navigation
          initialMessages: [], // load dari API
        ),
        child: ChatPage(
          conversationId: 'conv-123',
          currentUserId: userId,
        ),
      ),
    );
  }
}
```

---

## 9. Alur Lengkap Read Receipt

### Scenario: User A kirim pesan ke User B

1. **User A kirim pesan**
   - Backend publish ke `chat/v1/users/{B}/messages`
   - Frontend User B terima via MQTT
   - Frontend User B publish `delivered_up_to` ke `chat/v1/receipts`

2. **Backend relay delivered receipt**
   - Backend subscribe `chat/v1/receipts`
   - Backend lookup conversation participants
   - Backend publish ke `chat/v1/users/{A}/receipts`

3. **Frontend User A terima delivered receipt**
   - MQTT service receive dari `chat/v1/users/{A}/receipts`
   - ChatCubit apply receipt update
   - UI update: status message jadi "Delivered"

4. **User B baca pesan**
   - ChatPage detect pesan terlihat di screen
   - Publish `read_up_to` ke `chat/v1/receipts`

5. **Backend relay read receipt**
   - Backend subscribe `chat/v1/receipts`
   - Backend publish ke `chat/v1/users/{A}/receipts`

6. **Frontend User A terima read receipt**
   - MQTT service receive dari `chat/v1/users/{A}/receipts`
   - ChatCubit apply receipt update
   - UI update: status message jadi "Read" ✅

---

## 10. Testing

### Test Publish Receipt
```dart
// Test publish read receipt
final receiptPublisher = ReceiptPublisher(mqttClient);
await receiptPublisher.publishReadUpTo(
  conversationId: 'conv-123',
  actorUserId: 'user-B-id',
  lastReadMessageId: 'msg-456',
);
```

### Test Listen Receipt
```dart
// Test listen receipt stream
mqttService.receiptStream.listen((receipt) {
  print('Received receipt: ${receipt.type}');
  print('Conversation: ${receipt.conversationId}');
  print('Actor: ${receipt.actorUserId}');
});
```

---

## 11. Best Practices

1. **Debounce Read Receipt**
   - Jangan publish read receipt terlalu sering
   - Gunakan debounce (contoh: 500ms) sebelum publish

2. **Handle Offline**
   - Queue receipt jika offline
   - Publish semua queued receipt saat online kembali

3. **Error Handling**
   - Handle MQTT connection errors
   - Retry mechanism untuk failed publish

4. **Performance**
   - Hanya update message yang relevan
   - Jangan rebuild seluruh list jika hanya 1 message berubah

---

## 12. Contoh dengan Debounce

**Update ReceiptPublisher:**

```dart
import 'dart:async';

class ReceiptPublisher {
  final MqttClient mqttClient;
  Timer? _readReceiptTimer;
  String? _pendingConversationId;
  String? _pendingActorUserId;
  String? _pendingLastReadMessageId;

  /// Publish read receipt dengan debounce
  void publishReadUpToDebounced({
    required String conversationId,
    required String actorUserId,
    required String lastReadMessageId,
  }) {
    // Cancel timer sebelumnya
    _readReceiptTimer?.cancel();

    // Simpan pending receipt
    _pendingConversationId = conversationId;
    _pendingActorUserId = actorUserId;
    _pendingLastReadMessageId = lastReadMessageId;

    // Set timer untuk publish setelah 500ms
    _readReceiptTimer = Timer(const Duration(milliseconds: 500), () {
      if (_pendingConversationId != null &&
          _pendingActorUserId != null &&
          _pendingLastReadMessageId != null) {
        publishReadUpTo(
          conversationId: _pendingConversationId!,
          actorUserId: _pendingActorUserId!,
          lastReadMessageId: _pendingLastReadMessageId!,
        );
        
        // Clear pending
        _pendingConversationId = null;
        _pendingActorUserId = null;
        _pendingLastReadMessageId = null;
      }
    });
  }
}
```

---

## ✅ Checklist Implementasi

- [x] Model Receipt entity
- [x] ReceiptPublisher service
- [x] MQTT service subscribe ke receipts topic
- [x] ChatCubit handle receipt updates
- [x] ChatPage publish read receipt
- [x] MessageBubble tampilkan status
- [x] Integration di main app
- [x] Error handling
- [x] Debounce untuk performance

---

## 📝 Catatan Penting

1. **Topic harus exact match** (case-sensitive):
   - Publish: `chat/v1/receipts`
   - Subscribe: `chat/v1/users/{userId}/receipts`

2. **Payload format harus sesuai**:
   - Field required: `type`, `conversation_id`, `actor_user_id`
   - Field conditional: `last_read_message_id` atau `last_delivered_message_id`

3. **Message ID comparison**:
   - Gunakan lexicographic comparison untuk ULID
   - Message dengan ID <= watermark dianggap sudah read/delivered

4. **Watermark-based**:
   - Receipt menggunakan watermark (last_read_message_id)
   - Semua message dengan ID <= watermark dianggap sudah read

---

Selesai! Implementasi ini sudah lengkap dan siap digunakan. 🚀
