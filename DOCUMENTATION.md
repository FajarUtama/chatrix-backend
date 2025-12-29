# Chatrix API Documentation

## Table of Contents
- [Authentication](#authentication)
- [Users](#users)
- [Posts](#posts)
- [Chat](#chat)
- [Contacts](#contacts)
- [Follows](#follows)
- [Block](#block)
- [Reports](#reports)
- [Stories](#stories)
- [Notifications](#notifications)
- [Media](#media)
- [Storage](#storage)
- [Calls](#calls)
- [Admin](#admin)

## Authentication

### 1. Register a new user

**Endpoint:** `POST /auth/register`

**Description:** Register a new user account.

**Headers:**
- `x-device-id`: (Optional) Device ID for session management. If not provided, a new UUID will be generated.
- `Content-Type`: multipart/form-data (when uploading avatar)

**Request Body (form-data):**
- `phone`: (Required) Phone number in international format (e.g., +1234567890)
- `username`: (Required) Username, minimum 3 characters
- `password`: (Required) Password, minimum 6 characters
- `full_name`: (Optional) Full name
- `avatar`: (Optional) Profile picture file (image only)

**Response (Success - 201 Created):**
```json
{
  "user": {
    "id": "60d5ec9f5824f70015a1c001",
    "phone": "+1234567890",
    "username": "johndoe",
    "full_name": "John Doe",
    "avatar_url": "https://example.com/avatars/60d5ec9f5824f70015a1c001/1234567890-avatar.jpg"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- 400 Bad Request: Invalid input data or invalid file type
- 409 Conflict: Phone number or username already exists

---

### 2. User Login

**Endpoint:** `POST /auth/login`

**Description:** Authenticate a user and retrieve access and refresh tokens.

**Headers:**
- `x-device-id`: (Optional) Device ID for session management. If not provided, a new UUID will be generated.

**Request Body:**
```json
{
  "phoneOrUsername": "johndoe",  // Can be either phone or username
  "password": "secure123"
}
```

**Response (Success - 200 OK):**
```json
{
  "user": {
    "id": "60d5ec9f5824f70015a1c001",
    "phone": "+1234567890",
    "username": "johndoe",
    "full_name": "John Doe",
    "avatar_url": "https://example.com/avatar.jpg"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- 400 Bad Request: Invalid input data
- 401 Unauthorized: Invalid credentials

---

### 3. Refresh Access Token

**Endpoint:** `POST /auth/refresh`

**Description:** Get a new access token using a refresh token.

**Headers:**
- `x-device-id`: (Required) Device ID that was used during login/registration.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Success - 200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- 400 Bad Request: Invalid input data
- 401 Unauthorized: Invalid or expired refresh token
- 401 Unauthorized: Device ID required

---

## Users

Let me check the user module to document the user-related endpoints.

### 1. Get Current User Profile

**Endpoint:** `GET /users/me`

**Description:** Get the profile of the currently authenticated user.

**Headers:**
- `Authorization`: Bearer token from login/register

**Response (Success - 200 OK):**
```json
{
  "id": "60d5ec9f5824f70015a1c001",
  "phone": "+1234567890",
  "username": "johndoe",
  "full_name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg",
  "bio": "Hello, I'm John!",
  "website": "https://johndoe.com",
  "is_private": false,
  "follower_count": 150,
  "following_count": 200,
  "post_count": 42,
  "created_at": "2023-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- 401 Unauthorized: Invalid or missing authentication token

---

### 2. Update User Profile

**Endpoint:** `PATCH /users/me`

**Description:** Update the current user's profile information. Can include avatar upload.

**Headers:**
- `Authorization`: Bearer token
- `Content-Type`: multipart/form-data (when uploading avatar)

**Request Body (form-data):**
- `full_name`: (Optional) New full name
- `bio`: (Optional) Short biography
- `avatar`: (Optional) Profile picture file (image only)

**Response (Success - 200 OK):**
```json
{
  "id": "60d5ec9f5824f70015a1c001",
  "phone": "+1234567890",
  "username": "johndoe",
  "full_name": "John Updated",
  "bio": "New bio here",
  "avatar_url": "https://example.com/avatars/60d5ec9f5824f70015a1c001/1234567890-avatar.jpg"
}
```

**Error Responses:**
- 400 Bad Request: Invalid input data or invalid file type
- 401 Unauthorized: Invalid or missing authentication token

---

### 3. Get User by ID or Username

**Endpoint:** `GET /users/:identifier`

**Description:** Get public profile information for a specific user by ID or username.

**Headers:**
- `Authorization`: Bearer token (optional, required for private accounts)

**Path Parameters:**
- `identifier`: User's ID or username

**Response (Success - 200 OK):**
```json
{
  "id": "60d5ec9f5824f70015a1c002",
  "username": "janedoe",
  "full_name": "Jane Doe",
  "avatar_url": "https://example.com/jane-avatar.jpg",
  "bio": "Photography enthusiast",
  "website": "https://janedoe.photography",
  "is_private": false,
  "follower_count": 500,
  "following_count": 320,
  "post_count": 128,
  "is_following": true,
  "created_at": "2022-06-15T10:30:00.000Z"
}
```

**Error Responses:**
- 404 Not Found: User not found
- 403 Forbidden: Cannot view private profile (when not following)

---



## Posts

### 1. Create a New Post

**Endpoint:** `POST /posts`

**Description:** Create a new post with optional media.

**Headers:**
- `Authorization`: Bearer token
- `Content-Type`: multipart/form-data

**Request Body (form-data):**
- `caption`: (Optional) Post caption/text
- `media`: (Required) One or more media files (images/videos)
- `location`: (Optional) Location data as JSON string
- `is_private`: (Optional) Boolean, default false

**Response (Success - 201 Created):**
```json
{
  "id": "70d5ec9f5824f70015a1c003",
  "user_id": "60d5ec9f5824f70015a1c001",
  "caption": "Beautiful day at the beach! 🏖️",
  "media": [
    {
      "url": "https://example.com/media/beach1.jpg",
      "type": "image",
      "width": 1080,
      "height": 1350
    }
  ],
  "like_count": 0,
  "comment_count": 0,
  "is_liked": false,
  "is_saved": false,
  "created_at": "2023-04-10T15:30:00.000Z"
}
```

**Error Responses:**
- 400 Bad Request: Invalid input data
- 401 Unauthorized: Not authenticated
- 413 Payload Too Large: Media files too large

---

### 2. Get Post by ID

**Endpoint:** `GET /posts/:postId`

**Description:** Get details of a specific post.

**Headers:**
- `Authorization`: Bearer token (required for private posts)

**Path Parameters:**
- `postId`: ID of the post to retrieve

**Response (Success - 200 OK):**
```json
{
  "id": "70d5ec9f5824f70015a1c003",
  "user": {
    "id": "60d5ec9f5824f70015a1c001",
    "username": "johndoe",
    "full_name": "John Doe",
    "avatar_url": "https://example.com/avatar.jpg",
    "is_verified": false
  },
  "caption": "Beautiful day at the beach! 🏖️",
  "media": [
    {
      "url": "https://example.com/media/beach1.jpg",
      "type": "image",
      "width": 1080,
      "height": 1350
    }
  ],
  "like_count": 42,
  "comment_count": 5,
  "is_liked": true,
  "is_saved": false,
  "location": {
    "name": "Bondi Beach",
    "lat": -33.8908,
    "lng": 151.2743
  },
  "created_at": "2023-04-10T15:30:00.000Z",
  "updated_at": "2023-04-10T15:30:00.000Z"
}
```

**Error Responses:**
- 404 Not Found: Post not found
- 403 Forbidden: Not authorized to view this post

---

### 3. Get Feed

**Endpoint:** `GET /posts/feed`

**Description:** Get the authenticated user's feed (posts from followed users).

**Headers:**
- `Authorization`: Bearer token

**Query Parameters:**
- `limit`: (Optional) Number of posts to return (default: 10, max: 50)
- `before`: (Optional) Cursor for pagination (ISO date string)

**Response (Success - 200 OK):**
```json
{
  "posts": [
    {
      "id": "70d5ec9f5824f70015a1c003",
      "user": {
        "id": "60d5ec9f5824f70015a1c002",
        "username": "janedoe",
        "full_name": "Jane Doe",
        "avatar_url": "https://example.com/jane-avatar.jpg"
      },
      "caption": "Sunset vibes 🌅",
      "media": [
        {
          "url": "https://example.com/media/sunset.jpg",
          "type": "image",
          "width": 1080,
          "height": 1350
        }
      ],
      "like_count": 124,
      "comment_count": 8,
      "is_liked": true,
      "is_saved": false,
      "created_at": "2023-04-10T17:45:00.000Z"
    }
  ],
  "next_cursor": "2023-04-09T12:30:00.000Z",
  "has_more": true
}
```

**Error Responses:**
- 401 Unauthorized: Not authenticated

---

## Chat

### 1. Ensure Conversation

**Endpoint:** `POST /chat/conversations/ensure`

**Description:** Ensure a direct conversation exists with a user. If it exists, returns it. If not, creates a new one. **Note:** Messages are automatically marked as read when this endpoint is called (when opening an existing conversation).

**Headers:**
- `Authorization`: Bearer token

**Request Body:**
```json
{
  "recipientId": "60d5ec9f5824f70015a1c002"
}
```

**Response (Success - 200 OK):**
```json
{
  "id": "80d5ec9f5824f70015a1c004",
  "isGroup": false,
  "participants": [
    {
      "id": "60d5ec9f5824f70015a1c001",
      "username": "johndoe",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    {
      "id": "60d5ec9f5824f70015a1c002",
      "username": "janedoe",
      "avatarUrl": "https://example.com/jane-avatar.jpg"
    }
  ],
  "lastMessage": {
    "id": "90d5ec9f5824f70015a1c005",
    "content": "Hey, how are you?",
    "createdAt": "2023-04-10T18:30:00.000Z",
    "senderId": "60d5ec9f5824f70015a1c002"
  }
}
```

**Error Responses:**
- 400 Bad Request: Cannot chat with self
- 401 Unauthorized: Not authenticated

---

### 2. Get Conversations

**Endpoint:** `GET /chat/conversations`

**Description:** Get list of conversations for the current user.

**Headers:**
- `Authorization`: Bearer token

**Query Parameters:**
- `limit`: (Optional) Number of conversations to return (default: 20, max: 50)
- `before`: (Optional) Cursor for pagination (ISO date string)

**Response (Success - 200 OK):**
```json
{
  "conversations": [
    {
      "id": "80d5ec9f5824f70015a1c004",
      "participants": [
        {
          "id": "60d5ec9f5824f70015a1c001",
          "username": "johndoe",
          "full_name": "John Doe",
          "avatar_url": "https://example.com/avatar.jpg"
        },
        {
          "id": "60d5ec9f5824f70015a1c002",
          "username": "janedoe",
          "full_name": "Jane Doe",
          "avatar_url": "https://example.com/jane-avatar.jpg"
        }
      ],
      "last_message": {
        "id": "90d5ec9f5824f70015a1c005",
        "sender_id": "60d5ec9f5824f70015a1c002",
        "content": "Hey, how are you?",
        "type": "text",
        "created_at": "2023-04-10T18:30:00.000Z"
      },
      "unread_count": 2,
      "updated_at": "2023-04-10T18:30:00.000Z"
    }
  ],
  "next_cursor": "2023-04-09T10:15:00.000Z",
  "has_more": false
}
```

**Error Responses:**
- 401 Unauthorized: Not authenticated

---

### 3. Get Messages in a Conversation

**Endpoint:** `GET /chat/conversations/:id/messages`

**Description:** Get messages in a specific conversation. **Note:** Messages are automatically marked as read when this endpoint is called (only on the first page, not when paginating with `before` parameter).

**Headers:**
- `Authorization`: Bearer token

**Path Parameters:**
- `id`: ID of the conversation

**Query Parameters:**
- `limit`: (Optional) Number of messages to return (default: 20, max: 50)
- `before`: (Optional) Cursor for pagination (message ID)

**Response (Success - 200 OK):**
```json
{
  "messages": [
    {
      "id": "90d5ec9f5824f70015a1c005",
      "conversation_id": "80d5ec9f5824f70015a1c004",
      "sender": {
        "id": "60d5ec9f5824f70015a1c002",
        "username": "janedoe",
        "full_name": "Jane Doe",
        "avatar_url": "https://example.com/jane-avatar.jpg"
      },
      "content": "Hey, how are you?",
      "type": "text",
      "created_at": "2023-04-10T18:30:00.000Z",
      "is_me": false,
      "status": "delivered"
    }
  ],
  "next_cursor": "90d5ec9f5824f70015a1c004",
  "has_more": true
}
```

**Error Responses:**
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Not a participant in this conversation
- 404 Not Found: Conversation not found

---

### 4. Send a Message

**Endpoint:** `POST /chat/messages`

**Description:** Send a new message to a conversation. **Note:** The message is immediately published via MQTT to the recipient for real-time delivery. The recipient will receive the message in real-time through MQTT topic `chat/{recipientId}/messages` without needing to refresh or reload.

**Headers:**
- `Authorization`: Bearer token
- `Content-Type`: application/json

**Request Body:**
```json
{
  "conversationId": "80d5ec9f5824f70015a1c004",
  "content": "This is a new message",
  "type": "text",
  "attachments": [] // Optional array of media attachments
}
```

**Response (Success - 201 Created):**
```json
{
  "id": "90d5ec9f5824f70015a1c007",
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "sender_id": "60d5ec9f5824f70015a1c001",
  "content": "This is a new message",
  "type": "text",
  "media": [],
  "created_at": "2023-04-10T19:00:00.000Z",
  "status": "sent"
}
```

**Real-Time Delivery:**
- Message is immediately published to MQTT topic `chat/{recipientId}/messages`
- Conversation update is published to `chat/{recipientId}/conversations` for real-time list update
- Recipient receives message in real-time without delay

**Error Responses:**
- 400 Bad Request: Invalid message content
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Not a participant in this conversation or blocked
- 404 Not Found: Conversation not found

---

### 5. Mark Conversation as Read

**Endpoint:** `POST /chat/conversations/:id/read`

**Description:** Manually mark all messages in a conversation as read. This endpoint can be called anytime to mark messages as read in real-time. **Note:** Messages are also automatically marked as read when opening a chat via `GET /chat/conversations/:id/messages` (without "before" parameter) or `POST /chat/conversations/ensure`. This endpoint is still available for special use cases.

**Headers:**
- `Authorization`: Bearer token

**Path Parameters:**
- `id`: ID of the conversation

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "message": "Messages marked as read"
}
```

**Real-Time Updates:**
When messages are marked as read, the following MQTT topics are published:
- `chat/{senderId}/read-receipts` - Read receipt for sender (status update in detail chat)
- `chat/{userId}/messages-status` - Status update for reader (status update in detail chat)
- `chat/{participantId}/conversations` - Conversation update for all participants (unread count update in list)

**Error Responses:**
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Not a participant in this conversation
- 404 Not Found: Conversation not found

---

### 6. View Conversation (Real-Time Mark as Read)

**Endpoint:** `POST /chat/conversations/:id/view`

**Description:** Mark all messages in a conversation as read when user views the chat. This endpoint is designed to be called in real-time when user is viewing the chat detail, ensuring messages are marked as read immediately without needing to reload or exit the chat. This is especially useful for real-time mark as read functionality. **Recommended:** Call this endpoint periodically (e.g., every 3-5 seconds) while user is viewing the chat detail.

**Headers:**
- `Authorization`: Bearer token

**Path Parameters:**
- `id`: ID of the conversation

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "message": "Messages marked as read"
}
```

**Real-Time Updates:**
Same as endpoint 5 (Mark Conversation as Read) - publishes to 3 MQTT topics for real-time updates.

**Use Case:**
- Call this endpoint when user opens chat detail screen
- Poll this endpoint every 3-5 seconds while user is viewing the chat
- Ensures messages are marked as read in real-time without user needing to reload

**Error Responses:**
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Not a participant in this conversation
- 404 Not Found: Conversation not found

---

### 7. Real-Time Updates via MQTT

The chat system uses MQTT for real-time message and status updates. Frontend applications should subscribe to the following MQTT topics:

#### 7.1 New Message
**Topic:** `chat/{userId}/messages`

**Payload:**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "message": {
    "id": "90d5ec9f5824f70015a1c007",
    "sender_id": "60d5ec9f5824f70015a1c001",
    "type": "text",
    "text": "Hello!",
    "media": null,
    "status": "sent",
    "created_at": "2023-04-10T19:00:00.000Z"
  }
}
```

**When:** Sent immediately after a new message is created

**Use Case:** Display new message in real-time in chat detail

---

#### 7.2 Read Receipt (for Sender)
**Topic:** `chat/{userId}/read-receipts`

**Payload:**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "read_by": "60d5ec9f5824f70015a1c002",
  "read_at": "2023-04-10T19:00:00.000Z",
  "count": 5
}
```

**When:** Sent immediately after messages are marked as read

**Use Case:** Update message status from "sent"/"delivered" to "read" in sender's chat detail

---

#### 7.3 Message Status Update (for Reader)
**Topic:** `chat/{userId}/messages-status`

**Payload:**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "action": "marked_as_read",
  "read_by": "60d5ec9f5824f70015a1c002",
  "read_at": "2023-04-10T19:00:00.000Z",
  "count": 5
}
```

**When:** Sent immediately after messages are marked as read

**Use Case:** Update message status in reader's chat detail (optional)

---

#### 7.4 Conversation Update (for List Chat)
**Topic:** `chat/{userId}/conversations`

**Payload (New Message):**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "last_message_at": "2023-04-10T19:00:00.000Z",
  "last_message_preview": "Hello!",
  "action": "updated"
}
```

**Payload (Mark as Read):**
```json
{
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "action": "messages_read",
  "read_by": "60d5ec9f5824f70015a1c002",
  "read_at": "2023-04-10T19:00:00.000Z",
  "unread_count": 0
}
```

**When:** 
- Sent after new message is created (action: "updated")
- Sent after messages are marked as read (action: "messages_read")

**Use Case:** Update conversation list (last message, unread count, badge) in real-time

---

**MQTT Configuration:**
- **QoS:** 1 (At least once delivery - guaranteed delivery)
- **Retain:** false (Immediate delivery only, no persistence)
- **Connection:** Auto-reconnect enabled with 5 second interval

---

## Contacts

### 1. Get Contacts

**Endpoint:** `GET /contacts`

**Description:** Get the authenticated user's contacts.

**Headers:**
- `Authorization`: Bearer token

**Query Parameters:**
- `query`: (Optional) Search query
- `limit`: (Optional) Number of contacts to return (default: 20, max: 100)

**Response (Success - 200 OK):**
```json
{
  "contacts": [
    {
      "id": "60d5ec9f5824f70015a1c002",
      "username": "janedoe",
      "full_name": "Jane Doe",
      "avatar_url": "https://example.com/jane-avatar.jpg",
      "phone": "+1234567891",
      "is_registered": true,
      "is_contact": true,
      "last_seen": "2023-04-10T18:45:00.000Z"
    },
    {
      "phone": "+1234567892",
      "is_registered": false,
      "is_contact": true
    }
  ]
}
```

**Error Responses:**
- 401 Unauthorized: Not authenticated

---

## Follows

### 1. Follow a User

**Endpoint:** `POST /follows/:userId`

**Description:** Follow another user.

**Headers:**
- `Authorization`: Bearer token

**Path Parameters:**
- `userId`: ID of the user to follow

**Response (Success - 201 Created):**
```json
{
  "follower_id": "60d5ec9f5824f70015a1c001",
  "following_id": "60d5ec9f5824f70015a1c002",
  "status": "pending", // or 'accepted' if account is public
  "created_at": "2023-04-10T20:00:00.000Z"
}
```

**Error Responses:**
- 400 Bad Request: Already following this user
- 401 Unauthorized: Not authenticated
- 404 Not Found: User not found

---

### 2. Unfollow a User

**Endpoint:** `DELETE /follows/:userId`

**Description:** Unfollow a user.

**Headers:**
- `Authorization`: Bearer token

**Path Parameters:**
- `userId`: ID of the user to unfollow

**Response (Success - 204 No Content):**
```
(No content)
```

**Error Responses:**
- 401 Unauthorized: Not authenticated
- 404 Not Found: Follow relationship not found

---

## Block

### 1. Block a User

**Endpoint:** `POST /block/:userId`

**Description:** Block another user. Blocked users cannot send messages or view your content.

**Headers:**
- `Authorization`: Bearer token

**Path Parameters:**
- `userId`: ID of the user to block

**Response (Success - 200 OK):**
```json
{
  "success": true
}
```

**Error Responses:**
- 401 Unauthorized: Not authenticated
- 404 Not Found: User not found

---

### 2. Unblock a User

**Endpoint:** `DELETE /block/:userId`

**Description:** Unblock a previously blocked user.

**Headers:**
- `Authorization`: Bearer token

**Path Parameters:**
- `userId`: ID of the user to unblock

**Response (Success - 200 OK):**
```json
{
  "success": true
}
```

**Error Responses:**
- 401 Unauthorized: Not authenticated
- 404 Not Found: Block relationship not found

---

## Reports

### 1. Report a User

**Endpoint:** `POST /reports`

**Description:** Report a user for inappropriate behavior or content.

**Headers:**
- `Authorization`: Bearer token
- `Content-Type`: application/json

**Request Body:**
```json
{
  "reported_user_id": "60d5ec9f5824f70015a1c002",
  "conversation_id": "80d5ec9f5824f70015a1c004",
  "message_ids": ["90d5ec9f5824f70015a1c005"],
  "reason": "Spam or harassment"
}
```

**Fields:**
- `reported_user_id`: (Required) ID of the user being reported
- `conversation_id`: (Optional) ID of the conversation where the issue occurred
- `message_ids`: (Optional) Array of message IDs related to the report
- `reason`: (Required) Reason for the report

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "id": "c0d5ec9f5824f70015a1c010",
  "created_at": "2023-04-10T20:30:00.000Z"
}
```

**Error Responses:**
- 400 Bad Request: Invalid input data
- 401 Unauthorized: Not authenticated
- 404 Not Found: User not found

---

## Stories

### 1. Create a Story

**Endpoint:** `POST /stories`

**Description:** Create a new story.

**Headers:**
- `Authorization`: Bearer token
- `Content-Type`: multipart/form-data

**Request Body (form-data):**
- `media`: (Required) Media file (image or video)
- `caption`: (Optional) Story caption
- `mentions`: (Optional) Array of user IDs to mention
- `location`: (Optional) Location data as JSON string
- `expires_in`: (Optional) Expiration in hours (default: 24)

**Response (Success - 201 Created):**
```json
{
  "id": "a0d5ec9f5824f70015a1c008",
  "user_id": "60d5ec9f5824f70015a1c001",
  "media": {
    "url": "https://example.com/stories/story123.jpg",
    "type": "image",
    "width": 1080,
    "height": 1920
  },
  "caption": "My story!",
  "view_count": 0,
  "expires_at": "2023-04-11T20:00:00.000Z",
  "created_at": "2023-04-10T20:00:00.000Z"
}
```

**Error Responses:**
- 400 Bad Request: Invalid input data
- 401 Unauthorized: Not authenticated
- 413 Payload Too Large: Media file too large

---

### 2. Get Stories from Following

**Endpoint:** `GET /stories/feed`

**Description:** Get stories from users that the current user follows.

**Headers:**
- `Authorization`: Bearer token

**Response (Success - 200 OK):**
```json
{
  "stories": [
    {
      "user": {
        "id": "60d5ec9f5824f70015a1c002",
        "username": "janedoe",
        "full_name": "Jane Doe",
        "avatar_url": "https://example.com/jane-avatar.jpg"
      },
      "items": [
        {
          "id": "a0d5ec9f5824f70015a1c008",
          "media": {
            "url": "https://example.com/stories/story123.jpg",
            "type": "image",
            "width": 1080,
            "height": 1920
          },
          "view_count": 42,
          "expires_at": "2023-04-11T20:00:00.000Z",
          "created_at": "2023-04-10T20:00:00.000Z",
          "is_viewed": false
        }
      ]
    }
  ]
}
```

**Error Responses:**
- 401 Unauthorized: Not authenticated

---

## Notifications

### 1. Get Notifications

**Endpoint:** `GET /notifications`

**Description:** Get the authenticated user's notifications.

**Headers:**
- `Authorization`: Bearer token

**Query Parameters:**
- `limit`: (Optional) Number of notifications to return (default: 20, max: 50)
- `before`: (Optional) Cursor for pagination (notification ID)

**Response (Success - 200 OK):**
```json
{
  "notifications": [
    {
      "id": "b0d5ec9f5824f70015a1c009",
      "type": "like",
      "user": {
        "id": "60d5ec9f5824f70015a1c002",
        "username": "janedoe",
        "full_name": "Jane Doe",
        "avatar_url": "https://example.com/jane-avatar.jpg"
      },
      "post": {
        "id": "70d5ec9f5824f70015a1c003",
        "media": [
          {
            "url": "https://example.com/media/beach1.jpg",
            "type": "image"
          }
        ]
      },
      "is_read": false,
      "created_at": "2023-04-10T18:30:00.000Z"
    },
    {
      "id": "b0d5ec9f5824f70015a1c010",
      "type": "follow",
      "user": {
        "id": "60d5ec9f5824f70015a1c003",
        "username": "alice",
        "full_name": "Alice Smith",
        "avatar_url": "https://example.com/alice-avatar.jpg"
      },
      "is_read": true,
      "created_at": "2023-04-10T17:15:00.000Z"
    }
  ],
  "next_cursor": "b0d5ec9f5824f70015a1c011",
  "has_more": true,
  "unread_count": 5
}
```

**Error Responses:**
- 401 Unauthorized: Not authenticated

---

## Media

### 1. Upload Media

**Endpoint:** `POST /media/upload`

**Description:** Upload a media file (image or video).

**Headers:**
- `Authorization`: Bearer token
- `Content-Type`: multipart/form-data

**Request Body (form-data):**
- `file`: (Required) Media file to upload
- `type`: (Optional) Media type ('image' or 'video'), auto-detected if not provided

**Response (Success - 201 Created):**
```json
{
  "id": "c0d5ec9f5824f70015a1c012",
  "url": "https://example.com/media/uploaded123.jpg",
  "type": "image",
  "width": 1080,
  "height": 1350,
  "size": 1234567,
  "mime_type": "image/jpeg",
  "created_at": "2023-04-10T21:00:00.000Z"
}
```

**Error Responses:**
- 400 Bad Request: Invalid file or file type not supported
- 401 Unauthorized: Not authenticated
- 413 Payload Too Large: File too large

---

## Calls

### 1. Initiate a Call

**Endpoint:** `POST /calls`

**Description:** Initiate a new call to another user.

**Headers:**
- `Authorization`: Bearer token
- `Content-Type`: application/json

**Request Body:**
```json
{
  "recipient_id": "60d5ec9f5824f70015a1c002",
  "type": "video", // or 'audio'
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
  }
}
```

**Response (Success - 201 Created):**
```json
{
  "id": "d0d5ec9f5824f70015a1c013",
  "caller_id": "60d5ec9f5824f70015a1c001",
  "recipient_id": "60d5ec9f5824f70015a1c002",
  "type": "video",
  "status": "ringing",
  "started_at": "2023-04-10T22:00:00.000Z",
  "ended_at": null,
  "duration": 0
}
```

**Error Responses:**
- 400 Bad Request: Invalid call data
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Cannot call this user
- 404 Not Found: Recipient not found

---

### 2. Answer a Call

**Endpoint:** `POST /calls/:callId/answer`

**Description:** Answer an incoming call.

**Headers:**
- `Authorization`: Bearer token
- `Content-Type`: application/json

**Path Parameters:**
- `callId`: ID of the call to answer

**Request Body:**
```json
{
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n..."
  }
}
```

**Response (Success - 200 OK):**
```json
{
  "id": "d0d5ec9f5824f70015a1c013",
  "caller_id": "60d5ec9f5824f70015a1c001",
  "recipient_id": "60d5ec9f5824f70015a1c002",
  "type": "video",
  "status": "in_progress",
  "started_at": "2023-04-10T22:00:00.000Z",
  "answered_at": "2023-04-10T22:00:05.000Z",
  "ended_at": null,
  "duration": 5
}
```

**Error Responses:**
- 400 Bad Request: Invalid answer data
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Not the call recipient
- 404 Not Found: Call not found
- 409 Conflict: Call already answered or ended

---

### 3. End a Call

**Endpoint:** `POST /calls/:callId/end`

**Description:** End an ongoing call.

**Headers:**
- `Authorization`: Bearer token

**Path Parameters:**
- `callId`: ID of the call to end

**Response (Success - 200 OK):**
```json
{
  "id": "d0d5ec9f5824f70015a1c013",
  "caller_id": "60d5ec9f5824f70015a1c001",
  "recipient_id": "60d5ec9f5824f70015a1c002",
  "type": "video",
  "status": "ended",
  "started_at": "2023-04-10T22:00:00.000Z",
  "answered_at": "2023-04-10T22:00:05.000Z",
  "ended_at": "2023-04-10T22:05:30.000Z",
  "duration": 330
}
```

**Error Responses:**
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Not a participant in this call
- 404 Not Found: Call not found
- 409 Conflict: Call already ended

---

## Error Responses

All error responses follow the same format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request",
  "timestamp": "2023-04-10T12:00:00.000Z",
  "path": "/api/endpoint"
}
```

### Common Error Status Codes:
- 400 Bad Request: Invalid request data
- 401 Unauthorized: Authentication required or invalid
- 403 Forbidden: Not authorized to access the resource
- 404 Not Found: Resource not found
- 409 Conflict: Resource conflict (e.g., duplicate entry)
- 413 Payload Too Large: Request entity too large
- 429 Too Many Requests: Rate limit exceeded
- 500 Internal Server Error: Server error

---

## Rate Limiting

- Authentication endpoints: 10 requests per minute
- Other endpoints: 100 requests per 15 minutes
- Media uploads: 20 per hour

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Total number of requests allowed
- `X-RateLimit-Remaining`: Remaining number of requests
- `X-RateLimit-Reset`: Timestamp when the limit resets

---

## Authentication

All endpoints except `/auth/*` require authentication via Bearer token:

```
Authorization: Bearer your.jwt.token.here
```

## WebSocket

### Connection URL

```
wss://api.chatrix.com/ws?token=your.jwt.token.here
```

### Events

#### Incoming Events
- `message`: New message received
- `message_update`: Message was updated
- `message_delete`: Message was deleted
- `typing`: User is typing
- `call`: Incoming call
- `call_accept`: Call was accepted
- `call_reject`: Call was rejected
- `call_end`: Call ended
- `notification`: New notification
- `presence`: User online/offline status

#### Outgoing Events
- `subscribe`: Subscribe to events
- `unsubscribe`: Unsubscribe from events
- `typing`: Send typing indicator
- `call`: Initiate call
- `call_accept`: Accept call
- `call_reject`: Reject call
- `call_end`: End call
- `message`: Send message
- `message_update`: Update message
- `message_delete`: Delete message

## Webhooks

### Available Webhooks
- `message.created`: Triggered when a new message is sent
- `message.updated`: Triggered when a message is updated
- `message.deleted`: Triggered when a message is deleted
- `user.registered`: Triggered when a new user registers
- `user.updated`: Triggered when a user updates their profile
- `user.deleted`: Triggered when a user deletes their account
- `post.created`: Triggered when a new post is created
- `post.updated`: Triggered when a post is updated
- `post.deleted`: Triggered when a post is deleted
- `comment.created`: Triggered when a new comment is added
- `comment.updated`: Triggered when a comment is updated
- `comment.deleted`: Triggered when a comment is deleted
- `like.created`: Triggered when a like is added
- `like.deleted`: Triggered when a like is removed
- `follow.created`: Triggered when a user follows another user
- `follow.deleted`: Triggered when a user unfollows another user
- `follow.accepted`: Triggered when a follow request is accepted
- `story.created`: Triggered when a new story is created
- `story.viewed`: Triggered when a story is viewed
- `story.deleted`: Triggered when a story is deleted
- `call.started`: Triggered when a call is started
- `call.answered`: Triggered when a call is answered
- `call.ended`: Triggered when a call ends

### Webhook Payload Example

```json
{
  "event": "message.created",
  "data": {
    "id": "90d5ec9f5824f70015a1c007",
    "conversation_id": "80d5ec9f5824f70015a1c004",
    "sender_id": "60d5ec9f5824f70015a1c001",
    "content": "Hello, world!",
    "type": "text",
    "created_at": "2023-04-10T19:00:00.000Z"
  },
  "timestamp": "2023-04-10T19:00:00.000Z"
}
```

### Webhook Security

All webhook requests include the following headers for verification:
- `X-Chatrix-Signature`: HMAC-SHA256 signature of the request body using your webhook secret
- `X-Chatrix-Event`: The event type (e.g., "message.created")
- `X-Chatrix-Delivery`: A unique ID for the webhook delivery

## Pagination

Endpoints that return lists of items support cursor-based pagination using the following query parameters:

- `limit`: Number of items to return (default varies by endpoint)
- `before`: Cursor for pagination (typically an ID or timestamp)

Pagination metadata is included in the response:

```json
{
  "data": [...],
  "next_cursor": "next-page-cursor",
  "has_more": true
}
```

## Filtering and Sorting

Many list endpoints support filtering and sorting using query parameters:

```
GET /items?status=active&sort=-created_at&limit=10
```

### Common Filter Parameters:
- `status`: Filter by status (e.g., active, pending, completed)
- `type`: Filter by type
- `user_id`: Filter by user ID
- `before`: Filter items created before a timestamp
- `after`: Filter items created after a timestamp

### Sorting:
- Prefix field name with `-` for descending order (e.g., `-created_at`)
- Default is usually ascending order

## File Uploads

### Supported File Types
- Images: JPEG, PNG, GIF, WebP
- Videos: MP4, WebM, MOV
- Documents: PDF, DOC, DOCX, TXT

### File Size Limits
- Images: 10MB
- Videos: 100MB
- Documents: 25MB

## Localization

All endpoints support the `Accept-Language` header for localization:

```
Accept-Language: en-US
```

Supported languages:
- `en`: English (default)
- `id`: Bahasa Indonesia
- Other languages as needed

## Timezones

All timestamps are returned in ISO 8601 format with UTC timezone (e.g., `2023-04-10T12:00:00.000Z`).

Clients should handle timezone conversion based on the user's local settings.

## Changelog

### v1.0.0 (2023-04-10)
- Initial API release
- Authentication and user management
- Posts and media handling
- Messaging and chat
- Stories
- Notifications
- Video/audio calls

## Support

---

## Storage

### 1. Upload File

**Endpoint:** `POST /storage/upload`

**Description:** Upload a single file to storage.

**Headers:**
- `Authorization`: Bearer token
- `Content-Type`: multipart/form-data

**Query Parameters:**
- `type`: (Optional) File type (image, video, document, audio)

**Request Body (form-data):**
- `file`: (Required) File to upload (max 20MB)

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "data": {
    "key": "uploads/1234567890-filename.jpg",
    "url": "http://localhost:9000/chatrix/uploads/1234567890-filename.jpg"
  }
}
```

**Error Responses:**
- 400 Bad Request: No file uploaded or file too large
- 401 Unauthorized: Not authenticated

---

### 2. Upload Multiple Files

**Endpoint:** `POST /storage/upload/multiple`

**Description:** Upload multiple files to storage.

**Headers:**
- `Authorization`: Bearer token
- `Content-Type`: multipart/form-data

**Query Parameters:**
- `type`: (Optional) File type (image, video, document, audio)

**Request Body (form-data):**
- `files`: (Required) Multiple files to upload (max 20MB each)

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "key": "uploads/1234567890-file1.jpg",
      "url": "http://localhost:9000/chatrix/uploads/1234567890-file1.jpg"
    },
    {
      "key": "uploads/1234567891-file2.jpg",
      "url": "http://localhost:9000/chatrix/uploads/1234567891-file2.jpg"
    }
  ]
}
```

**Error Responses:**
- 400 Bad Request: No files uploaded or file too large
- 401 Unauthorized: Not authenticated

---

### 3. Get File

**Endpoint:** `GET /storage/file/:key`

**Description:** Download a file from storage.

**Headers:**
- `Authorization`: Bearer token

**Path Parameters:**
- `key`: File key/path in storage

**Response (Success - 200 OK):**
- File download with appropriate headers

**Error Responses:**
- 400 Bad Request: File not found
- 401 Unauthorized: Not authenticated

---

### 4. Preview File

**Endpoint:** `GET /storage/preview/:key`

**Description:** Preview a file from storage (displays in browser).

**Headers:**
- `Authorization`: Bearer token

**Path Parameters:**
- `key`: File key/path in storage

**Response (Success - 200 OK):**
- File content with appropriate MIME type

**Error Responses:**
- 400 Bad Request: File not found
- 401 Unauthorized: Not authenticated

---

## Admin

### 1. Inspect Conversations

**Endpoint:** `GET /admin/conversations/inspect`

**Description:** Inspect all conversations for data integrity issues.

**Response (Success - 200 OK):**
```json
{
  "total": 150,
  "valid": 140,
  "corrupted": [
    {
      "id": "80d5ec9f5824f70015a1c004",
      "participant_ids": "invalid_format",
      "issue": "not_an_array"
    }
  ],
  "selfConversations": [
    {
      "id": "80d5ec9f5824f70015a1c005",
      "participant_ids": ["user1", "user1"]
    }
  ],
  "unsorted": [
    {
      "id": "80d5ec9f5824f70015a1c006",
      "current": ["user2", "user1"],
      "sorted": ["user1", "user2"]
    }
  ]
}
```

---

### 2. Cleanup Conversations

**Endpoint:** `DELETE /admin/conversations/cleanup`

**Description:** Clean up corrupted conversations and fix unsorted participant IDs.

**Response (Success - 200 OK):**
```json
{
  "deleted": 5,
  "fixed": 3
}
```

---

### 3. Delete Conversation

**Endpoint:** `DELETE /admin/conversations/:id`

**Description:** Delete a specific conversation by ID.

**Path Parameters:**
- `id`: Conversation ID to delete

**Response (Success - 200 OK):**
```json
{
  "deleted": true,
  "id": "80d5ec9f5824f70015a1c004"
}
```

---

## Notes

- All authenticated endpoints require a valid JWT token in the `Authorization` header
- File uploads have a maximum size of 20MB
- Avatar images are automatically stored in MinIO with the pattern: `avatars/{userId}/{timestamp}-{filename}`
- Admin endpoints are not protected by authentication guards (should be secured in production)

---

For support, please contact:
- Email: support@chatrix.com
- Twitter: @chatrixsupport
- Documentation: https://docs.chatrix.com/api

## License

This API is proprietary and confidential. Unauthorized use is prohibited.
