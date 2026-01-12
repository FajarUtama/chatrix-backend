# Analisis: Integrasi Firebase Cloud Messaging (FCM) untuk Notifikasi

## 📋 Status Saat Ini

### ✅ Yang Sudah Ada

1. **FCM Service** (`src/infrastructure/fcm/fcm.service.ts`)
   - ✅ Firebase Admin SDK sudah diinisialisasi
   - ✅ Method `sendNotification()` sudah ada
   - ✅ Support multicast (multiple tokens)
   - ✅ Error handling sudah ada

2. **Notification Service** (`src/modules/notification/notification.service.ts`)
   - ✅ Method `sendChatMessageNotification()` sudah ada
   - ✅ Query device tokens dari database
   - ✅ Kirim notifikasi ke semua device user

3. **Device Token Schema** (`src/modules/auth/schemas/device-token.schema.ts`)
   - ✅ Schema sudah lengkap (user_id, device_id, fcm_token, platform)
   - ✅ Index sudah ada untuk performa query

4. **Module Registration**
   - ✅ FcmModule sudah terdaftar di AppModule
   - ✅ NotificationModule sudah terdaftar di AppModule

### ❌ Yang Belum Ada / Perlu Ditambahkan

1. **Endpoint untuk Register Device Token**
   - ❌ Belum ada endpoint untuk register/update FCM token
   - ❌ Belum ada endpoint untuk unregister device token

2. **Integrasi dengan ChatService**
   - ❌ ChatService belum memanggil NotificationService saat createMessage
   - ❌ Belum ada logic untuk kirim notifikasi saat pesan baru

3. **ChatModule Import**
   - ❌ ChatModule belum import NotificationModule

4. **Background Message Handler untuk Flutter**
   - ❌ Belum ada dokumentasi untuk handle background messages
   - ❌ Belum ada contoh implementasi Flutter

---

## 🔧 Implementasi yang Diperlukan

### 1. Endpoint Register Device Token

**File:** `src/modules/auth/auth.controller.ts` (tambah endpoint baru)

```typescript
@Post('device-token')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: 'Register or update FCM device token' })
async registerDeviceToken(
  @Request() req: any,
  @Body() dto: { fcm_token: string; device_id: string; platform: 'android' | 'ios' },
) {
  const userId = req.user.userId;
  return this.authService.registerDeviceToken(
    userId,
    dto.device_id,
    dto.fcm_token,
    dto.platform,
  );
}
```

**File:** `src/modules/auth/auth.service.ts` (tambah method)

```typescript
async registerDeviceToken(
  userId: string,
  deviceId: string,
  fcmToken: string,
  platform: 'android' | 'ios',
): Promise<{ success: boolean; message: string }> {
  await this.deviceTokenModel.findOneAndUpdate(
    { user_id: userId, device_id: deviceId },
    {
      user_id: userId,
      device_id: deviceId,
      fcm_token: fcmToken,
      platform,
      last_used_at: new Date(),
    },
    { upsert: true, new: true },
  ).exec();

  return {
    success: true,
    message: 'Device token registered successfully',
  };
}
```

### 2. Integrasi NotificationService ke ChatService

**File:** `src/modules/chat/chat.module.ts` (update imports)

```typescript
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    // ... existing imports ...
    NotificationModule, // Tambahkan ini
  ],
  // ...
})
```

**File:** `src/modules/chat/chat.service.ts` (update constructor dan createMessage)

```typescript
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';

constructor(
  // ... existing dependencies ...
  private notificationService: NotificationService,
  private userService: UserService,
) {}

async createMessage(...) {
  // ... existing code ...
  
  // Setelah message berhasil dibuat dan dipublish ke MQTT
  // Kirim FCM notification ke recipient (jika aplikasi ditutup)
  try {
    const recipientId = conversation.participant_ids.find(id => id !== senderId);
    if (recipientId) {
      const sender = await this.userService.findById(senderId);
      const senderName = sender?.full_name || sender?.username || 'Someone';
      
      await this.notificationService.sendChatMessageNotification(
        recipientId,
        {
          title: senderName,
          body: messageText || '[Media]',
          data: {
            type: 'chat_message',
            conversation_id: conversationId,
            message_id: messageId,
            sender_id: senderId,
          },
        },
      );
    }
  } catch (error) {
    // Log error tapi jangan fail request
    this.logger.error('Failed to send FCM notification:', error);
  }
  
  return message;
}
```

### 3. Update AuthModule untuk DeviceToken Model

**File:** `src/modules/auth/auth.module.ts` (pastikan DeviceToken sudah di-import)

```typescript
import { MongooseModule } from '@nestjs/mongoose';
import { DeviceToken, DeviceTokenSchema } from './schemas/device-token.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      // ... existing schemas ...
      { name: DeviceToken.name, schema: DeviceTokenSchema },
    ]),
  ],
  // ...
})
```

---

## 📱 Implementasi Flutter (Background Message Handler)

### 1. Setup Firebase di Flutter

**File:** `pubspec.yaml`

```yaml
dependencies:
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.9
  flutter_local_notifications: ^16.3.0
```

### 2. Initialize Firebase

**File:** `lib/main.dart`

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

// Background message handler (harus top-level function)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('Handling background message: ${message.messageId}');
  
  // Handle notification di background
  if (message.data['type'] == 'chat_message') {
    // Update local database atau trigger refresh
    // Jangan tampilkan UI di background handler
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Firebase.initializeApp();
  
  // Register background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  
  runApp(MyApp());
}
```

### 3. FCM Service untuk Flutter

**File:** `lib/core/services/fcm_service.dart`

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:io';

class FcmService {
  final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = 
      FlutterLocalNotificationsPlugin();
  
  String? _fcmToken;
  String? _deviceId;
  
  Future<void> initialize() async {
    // Request permission
    NotificationSettings settings = await _firebaseMessaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    
    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('User granted permission');
    } else {
      print('User declined permission');
      return;
    }
    
    // Get FCM token
    _fcmToken = await _firebaseMessaging.getToken();
    print('FCM Token: $_fcmToken');
    
    // Get or create device ID
    final prefs = await SharedPreferences.getInstance();
    _deviceId = prefs.getString('device_id');
    if (_deviceId == null) {
      _deviceId = _generateDeviceId();
      await prefs.setString('device_id', _deviceId!);
    }
    
    // Initialize local notifications
    await _initializeLocalNotifications();
    
    // Setup message handlers
    _setupMessageHandlers();
    
    // Register token ke backend
    await _registerTokenToBackend();
    
    // Listen untuk token refresh
    _firebaseMessaging.onTokenRefresh.listen((newToken) {
      _fcmToken = newToken;
      _registerTokenToBackend();
    });
  }
  
  Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    
    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );
  }
  
  void _onNotificationTapped(NotificationResponse response) {
    // Handle ketika user tap notification
    final payload = response.payload;
    if (payload != null) {
      // Navigate ke chat detail
      // Contoh: navigator.pushNamed('/chat', arguments: payload);
    }
  }
  
  void _setupMessageHandlers() {
    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Received foreground message: ${message.messageId}');
      _showLocalNotification(message);
    });
    
    // Handle notification tap (app opened from notification)
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('Notification opened app: ${message.messageId}');
      _handleNotificationTap(message);
    });
    
    // Check if app was opened from notification (cold start)
    _firebaseMessaging.getInitialMessage().then((message) {
      if (message != null) {
        _handleNotificationTap(message);
      }
    });
  }
  
  Future<void> _showLocalNotification(RemoteMessage message) async {
    const androidDetails = AndroidNotificationDetails(
      'chat_channel',
      'Chat Messages',
      channelDescription: 'Notifications for new chat messages',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
    );
    
    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );
    
    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );
    
    await _localNotifications.show(
      message.hashCode,
      message.notification?.title ?? 'New Message',
      message.notification?.body ?? '',
      details,
      payload: jsonEncode(message.data),
    );
  }
  
  void _handleNotificationTap(RemoteMessage message) {
    final data = message.data;
    if (data['type'] == 'chat_message') {
      final conversationId = data['conversation_id'];
      // Navigate ke chat detail
      // navigator.pushNamed('/chat', arguments: {'conversationId': conversationId});
    }
  }
  
  String _generateDeviceId() {
    // Generate unique device ID (bisa pakai device_info_plus atau uuid)
    return DateTime.now().millisecondsSinceEpoch.toString();
  }
  
  Future<void> _registerTokenToBackend() async {
    if (_fcmToken == null || _deviceId == null) return;
    
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/device-token'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken', // dari auth service
        },
        body: jsonEncode({
          'fcm_token': _fcmToken,
          'device_id': _deviceId,
          'platform': Platform.isAndroid ? 'android' : 'ios',
        }),
      );
      
      if (response.statusCode == 200) {
        print('FCM token registered successfully');
      } else {
        print('Failed to register FCM token: ${response.statusCode}');
      }
    } catch (e) {
      print('Error registering FCM token: $e');
    }
  }
  
  String? get fcmToken => _fcmToken;
  String? get deviceId => _deviceId;
}
```

### 4. Integrasi ke App

**File:** `lib/main.dart` (update)

```dart
import 'core/services/fcm_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Firebase.initializeApp();
  
  // Initialize FCM
  final fcmService = FcmService();
  await fcmService.initialize();
  
  // Register background handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  
  runApp(MyApp());
}
```

### 5. Background Message Handler

**File:** `lib/core/handlers/background_message_handler.dart`

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Initialize Firebase jika belum
  // await Firebase.initializeApp();
  
  print('Handling background message: ${message.messageId}');
  
  // Show local notification
  final FlutterLocalNotificationsPlugin localNotifications = 
      FlutterLocalNotificationsPlugin();
  
  const androidDetails = AndroidNotificationDetails(
    'chat_channel',
    'Chat Messages',
    channelDescription: 'Notifications for new chat messages',
    importance: Importance.high,
    priority: Priority.high,
  );
  
  const iosDetails = DarwinNotificationDetails(
    presentAlert: true,
    presentBadge: true,
    presentSound: true,
  );
  
  const details = NotificationDetails(
    android: androidDetails,
    iOS: iosDetails,
  );
  
  await localNotifications.show(
    message.hashCode,
    message.notification?.title ?? 'New Message',
    message.notification?.body ?? '',
    details,
    payload: jsonEncode(message.data),
  );
  
  // Update local database jika perlu
  // await updateLocalDatabase(message.data);
}
```

---

## ✅ Checklist Implementasi

### Backend

- [ ] Tambahkan endpoint `POST /auth/device-token` untuk register FCM token
- [ ] Tambahkan method `registerDeviceToken()` di AuthService
- [ ] Import NotificationModule ke ChatModule
- [ ] Inject NotificationService ke ChatService
- [ ] Panggil `sendChatMessageNotification()` di `createMessage()`
- [ ] Pastikan DeviceToken model sudah di-import di AuthModule
- [ ] Test endpoint register device token
- [ ] Test kirim notifikasi saat create message

### Flutter

- [ ] Install dependencies (firebase_core, firebase_messaging, flutter_local_notifications)
- [ ] Setup Firebase project di Firebase Console
- [ ] Download `google-services.json` (Android) dan `GoogleService-Info.plist` (iOS)
- [ ] Initialize Firebase di main.dart
- [ ] Buat FcmService untuk handle FCM
- [ ] Register background message handler
- [ ] Setup local notifications
- [ ] Register FCM token ke backend setelah login
- [ ] Handle notification tap untuk navigate ke chat
- [ ] Test foreground notification
- [ ] Test background notification (app ditutup)
- [ ] Test notification tap (cold start)

---

## 🔍 Testing

### Test Backend

1. **Register Device Token**
```bash
POST /auth/device-token
Headers: Authorization: Bearer {token}
Body: {
  "fcm_token": "test-token-123",
  "device_id": "device-123",
  "platform": "android"
}
```

2. **Send Message** (should trigger notification)
```bash
POST /chat/conversations/{id}/messages
Headers: Authorization: Bearer {token}
Body: {
  "text": "Test message",
  "type": "text"
}
```

### Test Flutter

1. **Foreground Notification**
   - Buka aplikasi
   - Kirim pesan dari device lain
   - Notifikasi harus muncul di app

2. **Background Notification**
   - Tutup aplikasi (swipe away)
   - Kirim pesan dari device lain
   - Notifikasi harus muncul di notification tray

3. **Notification Tap**
   - Tap notification
   - App harus terbuka dan navigate ke chat detail

---

## 📝 Catatan Penting

1. **Background Handler**
   - Harus top-level function (bukan method class)
   - Harus async
   - Tidak bisa akses UI context
   - Harus register sebelum runApp()

2. **Local Notifications**
   - Wajib untuk Android (foreground messages tidak otomatis muncul)
   - iOS bisa langsung muncul tanpa local notifications

3. **Token Refresh**
   - FCM token bisa berubah (refresh)
   - Harus listen `onTokenRefresh` dan update ke backend

4. **Device ID**
   - Gunakan device ID yang sama dengan yang dipakai untuk session
   - Bisa dari `x-device-id` header saat login

5. **Notification Data vs Notification Payload**
   - `notification` payload: otomatis ditampilkan oleh OS
   - `data` payload: harus di-handle manual (untuk custom logic)

---

## 🚀 Next Steps

1. Implement semua checklist di atas
2. Test di device fisik (emulator kadang tidak support FCM dengan baik)
3. Setup Firebase project di production
4. Monitor error logs untuk FCM failures
5. Handle edge cases (token expired, invalid token, dll)

---

Selesai! Implementasi ini akan membuat pesan tetap bisa masuk saat aplikasi ditutup melalui FCM push notifications. 🎉
