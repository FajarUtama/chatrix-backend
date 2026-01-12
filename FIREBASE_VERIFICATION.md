# Verifikasi Firebase Setup

Dokumen ini untuk memastikan semua komponen Firebase sudah OK dan berfungsi dengan baik.

---

## ✅ Checklist Verifikasi

### 1. ✅ firebase-admin ter-install

**Cek package.json:**
```bash
cat package.json | grep firebase-admin
```

**Expected output:**
```json
"firebase-admin": "^12.7.0"
```

**Verifikasi install:**
```bash
npm list firebase-admin
```

**Expected output:**
```
chatrix-backend@1.0.0
└── firebase-admin@12.7.0
```

**Jika belum terinstall:**
```bash
npm install firebase-admin
```

---

### 2. ✅ Service account key terbaca (tidak error saat start BE)

**Cara Verifikasi:**

#### A. Cek File Exists
```bash
# Di root project
ls -la firebase-service-account.json
```

**Expected:**
```
-rw-r--r-- 1 user user 1234 Dec 26 10:00 firebase-service-account.json
```

#### B. Start Backend dan Cek Log
```bash
npm run start:dev
```

**Log yang diharapkan (SUCCESS):**
```
[FcmService] Looking for Firebase service account at: /path/to/firebase-service-account.json
[FcmService] ✅ Firebase Admin initialized successfully
[FcmService]    Service Account: /path/to/firebase-service-account.json
[FcmService]    Project ID: your-project-id
```

**Log jika ERROR:**
```
[FcmService] ⚠️ FCM service account file not found at ./firebase-service-account.json
[FcmService]    FCM features will be disabled.
```

**Jika error, perbaiki:**
1. Pastikan file `firebase-service-account.json` ada di root project
2. Atau set environment variable: `FCM_SERVICE_ACCOUNT_JSON='{...}'`
3. Restart backend

#### C. Cek via Health Endpoint
```bash
curl http://localhost:3000/health
```

**Expected response (Firebase UP):**
```json
{
  "status": "ok",
  "services": {
    "firebase": {
      "status": "up",
      "initialized": true,
      "project_id": "your-project-id",
      "messaging_available": true
    }
  }
}
```

**Jika Firebase DOWN:**
```json
{
  "status": "degraded",
  "services": {
    "firebase": {
      "status": "down",
      "error": "Firebase Admin not initialized",
      "initialized": false,
      "messaging_available": false
    }
  }
}
```

---

### 3. ✅ Bisa panggil admin.messaging()

**Cara Verifikasi:**

#### A. Via Health Endpoint (Automatic Check)
```bash
curl http://localhost:3000/health | jq '.services.firebase'
```

**Expected (messaging available):**
```json
{
  "status": "up",
  "initialized": true,
  "project_id": "your-project-id",
  "messaging_available": true
}
```

#### B. Test Send Notification (Manual Test)
```bash
# 1. Register device token dulu
curl -X POST http://localhost:3000/auth/device-token \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fcm_token": "test-token-123",
    "device_id": "device-123",
    "platform": "android"
  }'

# 2. Kirim pesan (akan trigger notification)
curl -X POST http://localhost:3000/chat/conversations/{id}/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test message",
    "type": "text"
  }'
```

**Cek log backend:**
```
[FcmService] Sent 1 notifications, 0 failed
```

**Jika error:**
```
[FcmService] Error sending FCM notification: ...
```
→ Periksa service account key atau FCM token

---

## 🧪 Quick Test Script

Buat file `test-firebase.js` di root project:

```javascript
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing Firebase Setup...\n');

// Test 1: Check if firebase-admin is installed
console.log('1️⃣ Checking firebase-admin installation...');
try {
  const version = require('firebase-admin/package.json').version;
  console.log(`   ✅ firebase-admin version: ${version}\n`);
} catch (error) {
  console.log(`   ❌ firebase-admin not found: ${error.message}\n`);
  process.exit(1);
}

// Test 2: Check service account file
console.log('2️⃣ Checking service account file...');
const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
if (fs.existsSync(serviceAccountPath)) {
  console.log(`   ✅ File found: ${serviceAccountPath}\n`);
} else {
  console.log(`   ⚠️ File not found: ${serviceAccountPath}`);
  console.log('   💡 Using environment variable FCM_SERVICE_ACCOUNT_JSON\n');
}

// Test 3: Initialize Firebase
console.log('3️⃣ Initializing Firebase Admin...');
try {
  let serviceAccount;
  
  // Try environment variable first
  if (process.env.FCM_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON);
    console.log('   📝 Using FCM_SERVICE_ACCOUNT_JSON environment variable');
  } else if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = require(serviceAccountPath);
    console.log('   📝 Using firebase-service-account.json file');
  } else {
    throw new Error('No service account found');
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  
  const app = admin.app();
  console.log(`   ✅ Firebase Admin initialized`);
  console.log(`   📋 Project ID: ${app.options.projectId || 'N/A'}\n`);
} catch (error) {
  console.log(`   ❌ Failed to initialize: ${error.message}\n`);
  process.exit(1);
}

// Test 4: Test admin.messaging()
console.log('4️⃣ Testing admin.messaging()...');
try {
  const messaging = admin.messaging();
  if (messaging) {
    console.log('   ✅ admin.messaging() is available\n');
  } else {
    throw new Error('messaging() returned null');
  }
} catch (error) {
  console.log(`   ❌ Failed: ${error.message}\n`);
  process.exit(1);
}

console.log('✅ All tests passed! Firebase is ready to use. 🚀');
```

**Jalankan test:**
```bash
node test-firebase.js
```

**Expected output:**
```
🧪 Testing Firebase Setup...

1️⃣ Checking firebase-admin installation...
   ✅ firebase-admin version: 12.7.0

2️⃣ Checking service account file...
   ✅ File found: /path/to/firebase-service-account.json

3️⃣ Initializing Firebase Admin...
   📝 Using firebase-service-account.json file
   ✅ Firebase Admin initialized
   📋 Project ID: your-project-id

4️⃣ Testing admin.messaging()...
   ✅ admin.messaging() is available

✅ All tests passed! Firebase is ready to use. 🚀
```

---

## 📋 Summary Checklist

- [ ] ✅ `firebase-admin` ter-install di `package.json`
- [ ] ✅ File `firebase-service-account.json` ada di root project (atau env var set)
- [ ] ✅ Backend start tanpa error Firebase
- [ ] ✅ Log menunjukkan "Firebase Admin initialized successfully"
- [ ] ✅ Health endpoint menunjukkan `firebase.status: "up"`
- [ ] ✅ Health endpoint menunjukkan `messaging_available: true`
- [ ] ✅ Bisa kirim notification (test dengan register token + send message)

---

## 🔍 Troubleshooting

### Error: "firebase-admin not found"
```bash
npm install firebase-admin
```

### Error: "FCM service account file not found"
1. Pastikan file `firebase-service-account.json` ada di root
2. Atau set `FCM_SERVICE_ACCOUNT_JSON` environment variable
3. Restart backend

### Error: "Failed to initialize Firebase Admin"
1. Cek format JSON service account (harus valid JSON)
2. Cek permissions file (harus readable)
3. Cek project_id di service account

### Error: "messaging() not available"
1. Pastikan Firebase Admin sudah initialized
2. Cek log untuk error detail
3. Restart backend

---

## ✅ Final Verification

Setelah semua checklist selesai, test dengan:

```bash
# 1. Start backend
npm run start:dev

# 2. Cek health endpoint
curl http://localhost:3000/health | jq '.services.firebase'

# Expected:
# {
#   "status": "up",
#   "initialized": true,
#   "project_id": "your-project-id",
#   "messaging_available": true
# }
```

Jika semua menunjukkan `"status": "up"` dan `"messaging_available": true`, maka **SEMUA SUDAH OK!** ✅

---

Selesai! Firebase sudah siap digunakan. 🚀
