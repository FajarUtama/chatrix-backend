# Chatrix Backend

Backend untuk aplikasi gabungan WhatsApp + Instagram menggunakan NestJS + TypeScript.

## Teknologi

- **Framework**: NestJS
- **Database**: MongoDB (Mongoose)
- **Real-time**: MQTT
- **File Storage**: MinIO
- **Cache/Presence**: Redis
- **Push Notification**: Firebase Cloud Messaging (FCM)
- **OTP**: SMS/Email (interface + dummy sender)

## Instalasi

1. Install dependencies:
```bash
npm install
```

**Catatan**: Jika Anda melihat deprecation warnings (inflight, npmlog, rimraf, glob, dll) saat `npm install`, ini adalah **normal** dan tidak mempengaruhi functionality. Warning-warning ini berasal dari transitive dependencies (dependencies dari dependencies) dan akan diatasi ketika package maintainers mengupdate dependencies mereka.

2. Copy `.env.example` ke `.env` dan isi nilai yang sesuai:
```bash
cp .env.example .env
```

3. Setup dan pastikan semua service berjalan:

   **MongoDB** (pilih salah satu):
   
   **Opsi A - MongoDB Lokal:**
   - Install MongoDB Community Edition dari https://www.mongodb.com/try/download/community
   - Jalankan MongoDB service:
     ```bash
     # Windows (PowerShell as Administrator)
     net start MongoDB
     
     # Atau jika menggunakan MongoDB sebagai service manual
     mongod --dbpath C:\data\db
     ```
   - Default URI: `mongodb://localhost:27017/chatrix`
   
   **Opsi B - MongoDB Atlas (Cloud, Recommended):**
   - Buat akun gratis di https://www.mongodb.com/cloud/atlas
   - Buat cluster gratis (M0)
   - Dapatkan connection string dari "Connect" → "Connect your application"
   - Update `.env` dengan URI dari Atlas:
     ```
     MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/chatrix?retryWrites=true&w=majority
     ```

   **Redis:**
   - Install Redis untuk Windows dari https://github.com/microsoftarchive/redis/releases
   - Atau gunakan Docker: `docker run -d -p 6379:6379 redis`
   - Atau gunakan Redis Cloud (gratis): https://redis.com/try-free/

   **MQTT Broker:**
   - Install Mosquitto dari https://mosquitto.org/download/
   - Atau gunakan Docker: `docker run -d -p 1883:1883 eclipse-mosquitto`
   - Atau gunakan MQTT broker cloud gratis seperti HiveMQ: https://www.hivemq.com/public-mqtt-broker/

   **MinIO:**
   - Install MinIO dari https://min.io/download
   - Atau gunakan Docker:
     ```bash
     docker run -d -p 9000:9000 -p 9001:9001 --name minio -e "MINIO_ROOT_USER=minioadmin" -e "MINIO_ROOT_PASSWORD=minioadmin" minio/minio server /data --console-address ":9001"
     ```
   - Access MinIO Console: http://localhost:9001 (username: minioadmin, password: minioadmin)

   **Firebase Cloud Messaging (FCM):**
   - Buat project di Firebase Console: https://console.firebase.google.com/
   - Download Service Account JSON dari Project Settings → Service Accounts
   - Simpan file JSON di root project sebagai `firebase-service-account.json`
   - Update `.env`: `FCM_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`
   - **Note**: FCM opsional untuk development, aplikasi tetap bisa berjalan tanpa FCM

4. Jalankan aplikasi:
```bash
npm run start:dev
```

## Struktur Project

```
src/
  config/          # Configuration service
  common/          # Shared utilities, guards, decorators
  infrastructure/  # Infrastructure modules (MQTT, Redis, MinIO, FCM, OTP)
  modules/         # Domain modules (Auth, User, Post, Chat, dll)
```

## API Endpoints

### Auth
- `POST /auth/register` - Register user baru
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh access token

### User
- `GET /me` - Get current user profile
- `PATCH /me` - Update profile

### Contacts
- `POST /contacts/sync` - Sync contacts dari phone numbers
- `GET /contacts` - Get user contacts

### Follow
- `POST /follow/:username` - Follow user
- `DELETE /follow/:username` - Unfollow user
- `GET /follow/followers` - Get followers
- `GET /follow/following` - Get following

### Posts
- `POST /posts` - Create post
- `GET /posts/feed` - Get feed
- `GET /posts/:id` - Get post detail
- `POST /posts/:id/like` - Like post
- `POST /posts/:id/comment` - Comment on post

### Stories
- `POST /stories` - Create story
- `GET /stories` - Get stories

### Chat
- `POST /chats/:userId/messages` - Send message
- `GET /chats/conversations` - Get conversations
- `GET /chats/conversations/:id/messages` - Get messages

### Media
- `POST /media/upload` - Upload file (multipart/form-data)

### Calls
- `POST /calls/log` - Log call
- `GET /calls/history` - Get call history

## MQTT Topics

- `chat/{userId}/messages` - Real-time chat messages
- `call/{userId}/signal` - WebRTC signaling (client-side)

## Troubleshooting

### MongoDB Connection Error
Jika mendapat error `connect ECONNREFUSED`:
1. Pastikan MongoDB service berjalan
2. Cek URI di `.env` sudah benar
3. Untuk MongoDB lokal, pastikan default port 27017 tidak digunakan aplikasi lain
4. Untuk MongoDB Atlas, pastikan IP whitelist sudah diatur (bisa gunakan `0.0.0.0/0` untuk development)

### Service Tidak Wajib Semua
Untuk development awal, Anda bisa menjalankan aplikasi dengan hanya:
- ✅ MongoDB (wajib)
- ❌ Redis (opsional - beberapa fitur cache tidak akan berfungsi)
- ❌ MQTT (opsional - chat real-time tidak akan berfungsi)
- ❌ MinIO (opsional - upload file tidak akan berfungsi)
- ❌ FCM (opsional - push notification tidak akan berfungsi)

Aplikasi tetap bisa berjalan untuk test endpoint auth, user, post, dll.

## License

MIT

