# Contoh Response Reply Chat

Dokumen ini berisi contoh-contoh response untuk mekanisme reply chat.

## 1. Mengirim Message dengan Reply (Text Message)

### Request
```http
POST /chat/messages
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "conversationId": "80d5ec9f5824f70015a1c004",
  "content": "Terima kasih atas informasinya!",
  "type": "text",
  "reply_to_message_id": "01HZABCD1234EFGH5678IJKL"
}
```

### Response (Success - 201 Created)
```json
{
  "message_id": "01HZMNOP9876QRST5432UVWX",
  "id": "675a1b2c3d4e5f6789012345",
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "sender_id": "60d5ec9f5824f70015a1c001",
  "text": "Terima kasih atas informasinya!",
  "type": "text",
  "media": null,
  "reply_to_message_id": "01HZABCD1234EFGH5678IJKL",
  "reply_to_message": {
    "message_id": "01HZABCD1234EFGH5678IJKL",
    "sender_id": "60d5ec9f5824f70015a1c002",
    "sender": {
      "id": "60d5ec9f5824f70015a1c002",
      "username": "janedoe",
      "full_name": "Jane Doe",
      "avatar_url": "https://example.com/avatars/janedoe.jpg"
    },
    "text": "Besok kita meeting jam 10 pagi",
    "type": "text",
    "media": null,
    "created_at": "2023-04-10T18:30:00.000Z"
  },
  "status": "sent",
  "server_ts": "2023-04-10T19:00:00.000Z",
  "created_at": "2023-04-10T19:00:00.000Z"
}
```

---

## 2. Mengirim Message dengan Reply (Image Message)

### Request
```http
POST /chat/messages
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data

conversationId: 80d5ec9f5824f70015a1c004
type: image
reply_to_message_id: 01HZABCD1234EFGH5678IJKL
file: [binary image data]
```

### Response (Success - 201 Created)
```json
{
  "message_id": "01HZMNOP9876QRST5432UVWX",
  "id": "675a1b2c3d4e5f6789012345",
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "sender_id": "60d5ec9f5824f70015a1c001",
  "text": null,
  "type": "image",
  "media": {
    "url": "https://example.com/storage/uploads/image123.jpg",
    "type": "image/jpeg",
    "file_name": "photo.jpg",
    "size": 245678,
    "thumb_url": "https://example.com/storage/uploads/image123_thumb.jpg"
  },
  "reply_to_message_id": "01HZABCD1234EFGH5678IJKL",
  "reply_to_message": {
    "message_id": "01HZABCD1234EFGH5678IJKL",
    "sender_id": "60d5ec9f5824f70015a1c002",
    "sender": {
      "id": "60d5ec9f5824f70015a1c002",
      "username": "janedoe",
      "full_name": "Jane Doe",
      "avatar_url": "https://example.com/avatars/janedoe.jpg"
    },
    "text": "Lihat foto ini",
    "type": "text",
    "media": null,
    "created_at": "2023-04-10T18:30:00.000Z"
  },
  "status": "sent",
  "server_ts": "2023-04-10T19:00:00.000Z",
  "created_at": "2023-04-10T19:00:00.000Z"
}
```

---

## 3. Mengirim Message Tanpa Reply (Normal Message)

### Request
```http
POST /chat/messages
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "conversationId": "80d5ec9f5824f70015a1c004",
  "content": "Halo, apa kabar?",
  "type": "text"
}
```

### Response (Success - 201 Created)
```json
{
  "message_id": "01HZMNOP9876QRST5432UVWX",
  "id": "675a1b2c3d4e5f6789012345",
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "sender_id": "60d5ec9f5824f70015a1c001",
  "text": "Halo, apa kabar?",
  "type": "text",
  "media": null,
  "reply_to_message_id": null,
  "reply_to_message": null,
  "status": "sent",
  "server_ts": "2023-04-10T19:00:00.000Z",
  "created_at": "2023-04-10T19:00:00.000Z"
}
```

---

## 4. Mendapatkan Messages dengan Reply

### Request
```http
GET /chat/conversations/80d5ec9f5824f70015a1c004/messages?limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response (Success - 200 OK)
```json
{
  "messages": [
    {
      "id": "675a1b2c3d4e5f6789012345",
      "message_id": "01HZMNOP9876QRST5432UVWX",
      "conversation_id": "80d5ec9f5824f70015a1c004",
      "sender_id": "60d5ec9f5824f70015a1c001",
      "text": "Terima kasih atas informasinya!",
      "type": "text",
      "media": null,
      "reply_to_message_id": "01HZABCD1234EFGH5678IJKL",
      "reply_to_message": {
        "message_id": "01HZABCD1234EFGH5678IJKL",
        "sender_id": "60d5ec9f5824f70015a1c002",
        "sender": {
          "id": "60d5ec9f5824f70015a1c002",
          "username": "janedoe",
          "full_name": "Jane Doe",
          "avatar_url": "https://example.com/avatars/janedoe.jpg"
        },
        "text": "Besok kita meeting jam 10 pagi",
        "type": "text",
        "media": null,
        "created_at": "2023-04-10T18:30:00.000Z"
      },
      "status": "delivered",
      "sent_at": "2023-04-10T19:00:00.000Z",
      "received_at": "2023-04-10T19:00:05.000Z",
      "read_at": null,
      "server_ts": "2023-04-10T19:00:00.000Z",
      "created_at": "2023-04-10T19:00:00.000Z"
    },
    {
      "id": "675a1b2c3d4e5f6789012344",
      "message_id": "01HZABCD1234EFGH5678IJKL",
      "conversation_id": "80d5ec9f5824f70015a1c004",
      "sender_id": "60d5ec9f5824f70015a1c002",
      "text": "Besok kita meeting jam 10 pagi",
      "type": "text",
      "media": null,
      "reply_to_message_id": null,
      "reply_to_message": null,
      "status": "read",
      "sent_at": "2023-04-10T18:30:00.000Z",
      "received_at": "2023-04-10T18:30:05.000Z",
      "read_at": "2023-04-10T19:00:00.000Z",
      "server_ts": "2023-04-10T18:30:00.000Z",
      "created_at": "2023-04-10T18:30:00.000Z"
    }
  ],
  "next_cursor": "01HZABCD1234EFGH5678IJKL",
  "has_more": false
}
```

---

## 5. Reply ke Message dengan Media

### Request
```http
POST /chat/messages
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "conversationId": "80d5ec9f5824f70015a1c004",
  "content": "Ini foto yang kamu minta",
  "type": "text",
  "reply_to_message_id": "01HZABCD1234EFGH5678IJKL"
}
```

### Response (Success - 201 Created)
```json
{
  "message_id": "01HZMNOP9876QRST5432UVWX",
  "id": "675a1b2c3d4e5f6789012345",
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "sender_id": "60d5ec9f5824f70015a1c001",
  "text": "Ini foto yang kamu minta",
  "type": "text",
  "media": null,
  "reply_to_message_id": "01HZABCD1234EFGH5678IJKL",
  "reply_to_message": {
    "message_id": "01HZABCD1234EFGH5678IJKL",
    "sender_id": "60d5ec9f5824f70015a1c002",
    "sender": {
      "id": "60d5ec9f5824f70015a1c002",
      "username": "janedoe",
      "full_name": "Jane Doe",
      "avatar_url": "https://example.com/avatars/janedoe.jpg"
    },
    "text": null,
    "type": "image",
    "media": {
      "url": "https://example.com/storage/uploads/original_image.jpg",
      "type": "image/jpeg",
      "file_name": "photo.jpg",
      "size": 456789,
      "thumb_url": "https://example.com/storage/uploads/original_image_thumb.jpg"
    },
    "created_at": "2023-04-10T18:30:00.000Z"
  },
  "status": "sent",
  "server_ts": "2023-04-10T19:00:00.000Z",
  "created_at": "2023-04-10T19:00:00.000Z"
}
```

---

## 6. MQTT Payload untuk Reply Message

### Topic
```
chat/v1/users/{userId}/messages
```

### Payload
```json
{
  "type": "message",
  "message_id": "01HZMNOP9876QRST5432UVWX",
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "sender_id": "60d5ec9f5824f70015a1c001",
  "server_ts": "2023-04-10T19:00:00.000Z",
  "payload": {
    "text": "Terima kasih atas informasinya!",
    "media": null,
    "reply_to_message_id": "01HZABCD1234EFGH5678IJKL",
    "reply_to_message": {
      "message_id": "01HZABCD1234EFGH5678IJKL",
      "sender_id": "60d5ec9f5824f70015a1c002",
      "sender": {
        "id": "60d5ec9f5824f70015a1c002",
        "username": "janedoe",
        "full_name": "Jane Doe",
        "avatar_url": "https://example.com/avatars/janedoe.jpg"
      },
      "text": "Besok kita meeting jam 10 pagi",
      "type": "text",
      "media": null,
      "created_at": "2023-04-10T18:30:00.000Z"
    }
  }
}
```

---

## 7. Error Response - Reply Message Tidak Ditemukan

### Request
```http
POST /chat/messages
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "conversationId": "80d5ec9f5824f70015a1c004",
  "content": "Reply ke message yang tidak ada",
  "type": "text",
  "reply_to_message_id": "01HZINVALID1234567890ABCD"
}
```

### Response (Error - 400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "Reply message not found or not in the same conversation",
  "error": "Bad Request",
  "timestamp": "2023-04-10T19:00:00.000Z",
  "path": "/chat/messages"
}
```

---

## 8. Error Response - Reply Message di Conversation Berbeda

### Request
```http
POST /chat/messages
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "conversationId": "80d5ec9f5824f70015a1c004",
  "content": "Reply ke message dari conversation lain",
  "type": "text",
  "reply_to_message_id": "01HZOTHERCONV123456789"
}
```

### Response (Error - 400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "Reply message not found or not in the same conversation",
  "error": "Bad Request",
  "timestamp": "2023-04-10T19:00:00.000Z",
  "path": "/chat/messages"
}
```

---

## Catatan Penting

1. **Field `reply_to_message`** hanya akan muncul jika:
   - `reply_to_message_id` disediakan dalam request
   - Message yang direply ada di database
   - Message yang direply berada di conversation yang sama

2. **Field `reply_to_message` berisi**:
   - `message_id`: ID message yang direply
   - `sender_id`: ID pengirim message yang direply
   - `sender`: Informasi lengkap pengirim (username, full_name, avatar_url)
   - `text`: Isi text message (null jika message berisi media)
   - `type`: Tipe message (text, image, video, file, voice)
   - `media`: Informasi media jika message berisi media (null jika text message)
   - `created_at`: Timestamp kapan message yang direply dibuat

3. **Validasi**:
   - Sistem akan memvalidasi bahwa `reply_to_message_id` ada di conversation yang sama
   - Jika validasi gagal, akan mengembalikan error 400 Bad Request

4. **MQTT Real-time**:
   - Informasi reply juga dikirim melalui MQTT untuk real-time delivery
   - Struktur payload MQTT sama dengan response API

