# Troubleshooting: Notifikasi Tidak Keluar

Dokumen ini membantu mendiagnosis mengapa notifikasi tidak keluar.

---

## 🔍 Checklist Diagnosa

### 1. ✅ Cek Firebase Initialization

**Cek log saat backend start:**
```bash
npm run start:dev
```

**Log yang diharapkan:**
```
[FcmService] ✅ Firebase Admin initialized successfully
[FcmService]    Project ID: your-project-id
```

**Jika tidak ada log ini:**
- File `firebase-service-account.json` tidak ditemukan
- Atau environment variable `FCM_SERVICE_ACCOUNT_JSON` tidak set
- **Solusi**: Lihat `FIREBASE_SETUP.md`

**Cek via Health Endpoint:**
```bash
curl http://localhost:3000/health | jq '.services.firebase'
```

**Expected:**
```json
{
  "status": "up",
  "initialized": true,
  "project_id": "your-project-id",
  "messaging_available": true
}
```

---

### 2. ✅ Cek Device Token Terdaftar

**Masalah paling umum**: User belum register device token!

**Cek di database:**
```javascript
// Di MongoDB
db.devicetokens.find({ user_id: "USER_ID_HERE" })
```

**Jika kosong:**
- User belum register device token
- Frontend belum panggil `POST /auth/device-token`
- **Solusi**: Pastikan frontend register token setelah login

**Cek log saat kirim pesan:**
```
[NotificationService] ⚠️ No FCM tokens found for user USER_ID. Notification will not be sent.
[NotificationService]    User needs to register device token via POST /auth/device-token
```

**Jika muncul log ini:**
- User belum register device token
- **Solusi**: Register token via endpoint atau frontend

---

### 3. ✅ Cek Log Saat Kirim Pesan

**Saat kirim pesan, cek log backend:**

**Log yang diharapkan (SUCCESS):**
```
[ChatService] Attempting to send FCM notification to recipient USER_ID for message MSG_ID
[NotificationService] 📤 Sending notification to 1 device(s) for user USER_ID
[NotificationService]    Title: Sender Name
[NotificationService]    Body: Message text
[FcmService] Sent 1 notifications, 0 failed
[NotificationService] ✅ Notification sent successfully to user USER_ID
```

**Log jika tidak ada token:**
```
[NotificationService] Found 0 device token(s) for user USER_ID
[NotificationService] ⚠️ No FCM tokens found for user USER_ID. Notification will not be sent.
```

**Log jika Firebase tidak initialized:**
```
[FcmService] FCM not initialized, skipping notification
```

**Log jika error:**
```
[FcmService] Error sending FCM notification: ...
[NotificationService] ❌ Failed to send chat notification to user USER_ID: ...
```

---

### 4. ✅ Cek FCM Token Valid

**Masalah**: Token sudah terdaftar tapi invalid/expired

**Cek log FCM response:**
```
[FcmService] Sent 0 notifications, 1 failed
[FcmService] Failed to send to token TOKEN: FirebaseError: ...
```

**Common errors:**
- `messaging/registration-token-not-registered` - Token tidak valid atau sudah expired
- `messaging/invalid-registration-token` - Format token salah
- `messaging/message-rate-exceeded` - Terlalu banyak request

**Solusi:**
- Frontend perlu refresh token dan register ulang
- Handle token refresh di frontend

---

### 5. ✅ Cek App State (Foreground vs Background)

**Firebase Cloud Messaging behavior:**
- **Foreground**: Notifikasi tidak otomatis muncul (perlu local notification)
- **Background**: Notifikasi otomatis muncul
- **Terminated**: Notifikasi otomatis muncul

**Jika app di foreground:**
- Backend sudah kirim notifikasi ✅
- Tapi tidak muncul karena app terbuka
- **Solusi**: Frontend perlu handle foreground messages dengan local notification

---

## 🧪 Test Step-by-Step

### Step 1: Test Firebase Initialization
```bash
# Start backend
npm run start:dev

# Cek health
curl http://localhost:3000/health | jq '.services.firebase'
```

**Expected:** `"status": "up"`

---

### Step 2: Register Device Token
```bash
curl -X POST http://localhost:3000/auth/device-token \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fcm_token": "VALID_FCM_TOKEN_FROM_FIREBASE",
    "device_id": "device-123",
    "platform": "android"
  }'
```

**Expected:** `{"success": true, "message": "Device token registered successfully"}`

---

### Step 3: Verify Token Terdaftar
```bash
# Cek di MongoDB atau cek log saat kirim pesan
# Harus muncul: "Found 1 device token(s) for user USER_ID"
```

---

### Step 4: Kirim Pesan dan Cek Log
```bash
curl -X POST http://localhost:3000/chat/conversations/{id}/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test notification",
    "type": "text"
  }'
```

**Cek log backend:**
- Harus ada log `[NotificationService] 📤 Sending notification`
- Harus ada log `[FcmService] Sent X notifications, 0 failed`

---

### Step 5: Cek Device Menerima Notifikasi
- **Jika app di background**: Notifikasi harus muncul
- **Jika app di foreground**: Perlu local notification handler

---

## 🔧 Common Issues & Solutions

### Issue 1: "No FCM tokens found"
**Penyebab**: User belum register device token

**Solusi**:
1. Pastikan frontend register token setelah login
2. Cek endpoint `POST /auth/device-token` berhasil
3. Cek database ada record di `devicetokens` collection

---

### Issue 2: "FCM not initialized"
**Penyebab**: Firebase service account tidak terbaca

**Solusi**:
1. Pastikan file `firebase-service-account.json` ada di root
2. Atau set `FCM_SERVICE_ACCOUNT_JSON` environment variable
3. Restart backend
4. Cek log saat start untuk error

---

### Issue 3: "Sent 0 notifications, 1 failed"
**Penyebab**: FCM token invalid atau expired

**Solusi**:
1. Frontend perlu refresh FCM token
2. Register token baru ke backend
3. Hapus token lama dari database jika perlu

---

### Issue 4: Notifikasi tidak muncul di device
**Penyebab**: App di foreground (tidak handle foreground messages)

**Solusi**:
1. Frontend perlu implement foreground message handler
2. Gunakan `flutter_local_notifications` untuk show notification
3. Lihat `FIREBASE_NOTIFICATION_ANALYSIS.md` untuk implementasi

---

### Issue 5: Notifikasi muncul tapi tidak saat app ditutup
**Penyebab**: Background message handler tidak terdaftar

**Solusi**:
1. Pastikan background handler terdaftar sebelum `runApp()`
2. Handler harus top-level function
3. Lihat `FIREBASE_NOTIFICATION_ANALYSIS.md` untuk implementasi

---

## 📋 Debug Checklist

Saat notifikasi tidak keluar, cek secara berurutan:

- [ ] ✅ Firebase initialized? (cek health endpoint)
- [ ] ✅ Device token terdaftar? (cek database atau log)
- [ ] ✅ Token valid? (cek log FCM response)
- [ ] ✅ Backend kirim notifikasi? (cek log `Sent X notifications`)
- [ ] ✅ App state? (foreground/background/terminated)
- [ ] ✅ Frontend handle notification? (foreground handler, background handler)

---

## 🧪 Test Script

Buat endpoint test untuk debug (optional):

```typescript
// Di health controller atau buat test controller
@Post('test-notification')
async testNotification(@Request() req: any) {
  const userId = req.user.userId;
  
  // Cek token
  const tokens = await this.deviceTokenModel.find({ user_id: userId }).exec();
  
  return {
    user_id: userId,
    tokens_found: tokens.length,
    tokens: tokens.map(t => ({
      device_id: t.device_id,
      platform: t.platform,
      has_token: !!t.fcm_token,
    })),
    firebase_status: await this.checkFirebaseStatus(),
  };
}
```

---

## 📝 Log Reference

### Success Flow
```
[ChatService] Attempting to send FCM notification...
[NotificationService] Found 1 device token(s)
[NotificationService] 📤 Sending notification to 1 device(s)
[FcmService] Sent 1 notifications, 0 failed
[NotificationService] ✅ Notification sent successfully
```

### Failure Flow (No Token)
```
[ChatService] Attempting to send FCM notification...
[NotificationService] Found 0 device token(s)
[NotificationService] ⚠️ No FCM tokens found
```

### Failure Flow (Firebase Not Init)
```
[ChatService] Attempting to send FCM notification...
[NotificationService] 📤 Sending notification...
[FcmService] FCM not initialized, skipping notification
```

---

## ✅ Quick Fix

**Jika notifikasi tidak keluar, cek ini dulu:**

1. **Cek health endpoint**: `curl http://localhost:3000/health | jq '.services.firebase'`
2. **Cek log saat kirim pesan**: Harus ada log `[NotificationService]`
3. **Cek device token**: Pastikan user sudah register token
4. **Cek FCM response**: Harus `Sent X notifications, 0 failed`

Jika semua OK tapi masih tidak muncul, kemungkinan masalah di **frontend** (foreground handler atau background handler).

---

Selesai! Gunakan checklist ini untuk debug masalah notifikasi. 🔍
