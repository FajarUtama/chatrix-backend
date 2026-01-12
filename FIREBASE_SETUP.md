# Setup Firebase Cloud Messaging (FCM) untuk Backend

## 📋 Prerequisites

1. Firebase project sudah dibuat di [Firebase Console](https://console.firebase.google.com/)
2. Firebase Admin SDK sudah diinstall (`firebase-admin` package)

## 🔧 Setup Service Account

Ada 2 cara untuk setup Firebase service account:

### Cara 1: Menggunakan File JSON (Recommended untuk Development)

1. **Download Service Account Key**
   - Buka [Firebase Console](https://console.firebase.google.com/)
   - Pilih project Anda
   - Pergi ke **Project Settings** → **Service Accounts**
   - Klik **Generate New Private Key**
   - Download file JSON

2. **Simpan File di Project**
   - Simpan file dengan nama `firebase-service-account.json`
   - Letakkan di **root directory** project (sama level dengan `package.json`)
   - **JANGAN commit file ini ke Git!** (sudah ada di `.gitignore`)

3. **File Structure**
   ```
   backend/
   ├── firebase-service-account.json  ← File ini
   ├── package.json
   ├── src/
   └── ...
   ```

4. **Environment Variable (Optional)**
   ```bash
   # Default path: ./firebase-service-account.json
   # Atau set custom path:
   FCM_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
   ```

### Cara 2: Menggunakan Environment Variable (Recommended untuk Production)

1. **Convert JSON ke String**
   - Buka file `firebase-service-account.json`
   - Convert ke single-line JSON string
   - Atau gunakan command:
   ```bash
   cat firebase-service-account.json | jq -c
   ```

2. **Set Environment Variable**
   ```bash
   # Linux/Mac
   export FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"your-project",...}'
   
   # Windows (PowerShell)
   $env:FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"your-project",...}'
   
   # Docker/Production (.env file)
   FCM_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project",...}
   ```

3. **Keuntungan Cara Ini:**
   - Lebih aman (tidak ada file di filesystem)
   - Mudah untuk deployment (Docker, Kubernetes, dll)
   - Bisa di-set via CI/CD secrets

## 🔍 Verifikasi Setup

Setelah setup, jalankan aplikasi dan cek log:

```bash
npm run start:dev
```

**Log yang diharapkan jika berhasil:**
```
[FcmService] ✅ Firebase Admin initialized successfully
[FcmService]    Service Account: /path/to/firebase-service-account.json
[FcmService]    Project ID: your-project-id
```

**Log jika gagal:**
```
[FcmService] ⚠️ FCM service account file not found at ./firebase-service-account.json
[FcmService]    FCM features will be disabled.
```

## 📝 Contoh File Service Account

File `firebase-service-account.json` biasanya berisi:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

## 🔒 Security Best Practices

1. **Jangan commit file service account ke Git**
   - Pastikan `firebase-service-account.json` ada di `.gitignore`
   - Gunakan environment variable untuk production

2. **Restrict Service Account Permissions**
   - Di Firebase Console, batasi permission service account
   - Hanya berikan permission yang diperlukan (Cloud Messaging)

3. **Rotate Keys Regularly**
   - Generate new private key setiap beberapa bulan
   - Update di semua environment (dev, staging, production)

4. **Use Environment Variables untuk Production**
   - Jangan hardcode path atau credentials
   - Gunakan secrets management (AWS Secrets Manager, HashiCorp Vault, dll)

## 🧪 Testing

Setelah setup, test dengan mengirim notifikasi:

```bash
# Register device token dulu
curl -X POST http://localhost:3000/auth/device-token \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fcm_token": "test-token-123",
    "device_id": "device-123",
    "platform": "android"
  }'

# Kirim pesan (akan trigger notification)
curl -X POST http://localhost:3000/chat/conversations/{id}/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test message",
    "type": "text"
  }'
```

## 🐳 Docker Setup

Jika menggunakan Docker, tambahkan ke `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      # Option 1: File path (mount volume)
      - FCM_SERVICE_ACCOUNT_PATH=/app/firebase-service-account.json
    volumes:
      - ./firebase-service-account.json:/app/firebase-service-account.json:ro
    
    # Option 2: Environment variable
    # - FCM_SERVICE_ACCOUNT_JSON=${FCM_SERVICE_ACCOUNT_JSON}
```

Atau gunakan Docker secrets:

```yaml
services:
  backend:
    secrets:
      - firebase_service_account
secrets:
  firebase_service_account:
    file: ./firebase-service-account.json
```

## 📚 Referensi

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Service Account Keys](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk)

---

## ✅ Checklist Setup

- [ ] Firebase project sudah dibuat
- [ ] Service account key sudah didownload
- [ ] File `firebase-service-account.json` sudah disimpan di root project
- [ ] File sudah ditambahkan ke `.gitignore`
- [ ] Aplikasi sudah di-restart
- [ ] Log menunjukkan "Firebase Admin initialized successfully"
- [ ] Test kirim notifikasi berhasil

---

Selesai! Firebase sudah siap digunakan untuk mengirim push notifications. 🚀
