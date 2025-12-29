# Token Expiration Guide

## 📋 Overview

Dokumen ini menjelaskan mekanisme refresh token dan durasi validitas token di sistem Chatrix.

## ⏱️ Token Expiration Times

### Access Token
- **Default Expiration:** `7d` (7 hari) ⭐ **Optimized for chat app**
- **Config:** `JWT_ACCESS_EXPIRES_IN` environment variable
- **Format:** Supports `s` (seconds), `m` (minutes), `h` (hours), `d` (days)
- **Example:** `7d`, `15m`, `1h`, `30m`, `900s`
- **Note:** User can open app anytime within 7 days without needing to refresh token

### Refresh Token
- **Default Expiration:** `90d` (90 hari / 3 bulan) ⭐ **Optimized for chat app**
- **Config:** `JWT_REFRESH_EXPIRES_IN` environment variable
- **Format:** Supports `s` (seconds), `m` (minutes), `h` (hours), `d` (days)
- **Example:** `90d`, `30d`, `7d`, `14d`, `1h`
- **Note:** Long expiration for better UX in chat app that's not always opened

### Session (Database)
- **Expiration:** Sama dengan refresh token expiration (calculated from `JWT_REFRESH_EXPIRES_IN`)
- **Storage:** Stored in `sessions` collection with `expires_at` field
- **Sliding Expiration:** ⭐ Session expiration is extended every time refresh token is used
- **Auto-cleanup:** Session akan expired setelah `expires_at` tercapai

## 🔄 Refresh Token Mechanism

### Flow

```
1. User Login/Register
   ↓
2. Generate Access Token (7d) + Refresh Token (90d)
   ↓
3. Store Refresh Token Hash in Database (Session, expires in 90d)
   ↓
4. Access Token Expires (7d) → 401 Unauthorized (if not refreshed)
   ↓
5. Frontend calls POST /auth/refresh with Refresh Token
   ↓
6. Backend verifies:
   - JWT signature valid
   - JWT not expired
   - Device ID matches
   - Session exists in database
   - Refresh token hash matches stored hash
   - Session not expired
   ↓
7. Generate new Access Token (7d) + Refresh Token (90d)
   ↓
8. Update session in database (extends expiration to 90d from now) ⭐ Sliding Session
   ↓
9. Return new tokens to frontend
```

### Security Checks

1. **JWT Signature Verification**
   - Verifies token is signed with correct secret
   - Detects tampered tokens

2. **JWT Expiration Check**
   - JWT library automatically checks expiration
   - Throws `TokenExpiredError` if expired

3. **Device ID Verification**
   - Ensures refresh token is used from same device
   - Prevents token theft from other devices

4. **Session Existence Check**
   - Verifies session exists in database
   - Prevents use of revoked tokens

5. **Refresh Token Hash Verification** ⭐ **IMPORTANT**
   - Compares provided refresh token with stored hash
   - Prevents use of old/revoked tokens
   - Ensures token matches the one stored in database

6. **Session Expiration Check**
   - Checks if session `expires_at` has passed
   - Additional layer of expiration control

## 📊 Token Lifecycle

### Scenario 1: Normal Usage (Token Refreshed Before Expiry) - Sliding Session

```
Day 0 - Login → Access Token (expires Day 7) + Refresh Token (expires Day 90)
Day 1 - Access Token still valid ✅
Day 5 - Access Token still valid ✅
Day 7 - Access Token expires → 401 Unauthorized
Day 7 - Frontend calls /auth/refresh → New tokens generated ✅
         Session expiration extended to Day 97 (90 days from now) ⭐
Day 14 - Access Token expires → 401 Unauthorized
Day 14 - Frontend calls /auth/refresh → New tokens generated ✅
         Session expiration extended to Day 104 (90 days from now) ⭐
... (continues - session expiration keeps sliding forward)
```

### Scenario 2: App Not Opened for Long Time

```
Day 0 - Login → Access Token (expires Day 7) + Refresh Token (expires Day 90)
Day 1-30 - App not opened
Day 30 - User opens app → Access Token expired → 401 Unauthorized
Day 30 - Frontend calls /auth/refresh → New tokens generated ✅
         Session expiration extended to Day 120 (90 days from now) ⭐
Day 30-120 - App not opened
Day 120 - User opens app → Refresh Token expired → Must login again
```

### Scenario 3: Frequent App Usage (Sliding Session Benefit)

```
Day 0 - Login → Access Token (expires Day 7) + Refresh Token (expires Day 90)
Day 5 - User opens app → Refresh token → Session extended to Day 95 ⭐
Day 10 - User opens app → Refresh token → Session extended to Day 100 ⭐
Day 20 - User opens app → Refresh token → Session extended to Day 110 ⭐
... (As long as user uses app within 90 days, session keeps extending)
```

### Scenario 3: Session Revoked

```
Time 0:00 - Login → Access Token + Refresh Token + Session created
Time 0:15 - Access Token expires → 401 Unauthorized
Time 0:20 - User changes password → All sessions deleted
Time 0:25 - Frontend calls /auth/refresh → 401 Unauthorized (Session not found)
Time 0:25 - User must login again
```

## 🔐 When Token Becomes Invalid (401)

### Access Token Invalid (401 Unauthorized)

1. **Token Expired**
   - Access token JWT expiration time has passed
   - Default: 15 minutes after issuance
   - Error: `Token has expired`

2. **Invalid Token**
   - Token signature is invalid
   - Token is malformed
   - Error: `Invalid token: <error message>`

3. **Missing Token**
   - No `Authorization` header
   - No token in header
   - Error: `Missing authorization header` or `No token provided`

### Refresh Token Invalid (401 Unauthorized)

1. **Token Expired**
   - Refresh token JWT expiration time has passed
   - Default: 30 days after issuance
   - Error: `Refresh token expired`

2. **Invalid Token**
   - Token signature is invalid
   - Token is malformed
   - Error: `Invalid refresh token`

3. **Invalid Device**
   - Device ID in token doesn't match provided device ID
   - Error: `Invalid device`

4. **Session Not Found**
   - Session doesn't exist in database
   - Session was deleted (e.g., password reset)
   - Error: `Session not found`

5. **Session Expired**
   - Session `expires_at` has passed
   - Error: `Session expired`

6. **Token Hash Mismatch**
   - Refresh token doesn't match stored hash
   - Token was revoked or replaced
   - Error: `Invalid refresh token`

## ⚙️ Configuration

### Environment Variables

```bash
# Access Token Configuration
JWT_ACCESS_SECRET=your-access-secret-key
JWT_ACCESS_EXPIRES_IN=15m  # Default: 15m (15 minutes)

# Refresh Token Configuration
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=30d  # Default: 30d (30 days)
```

### Supported Time Formats

- `s` - Seconds (e.g., `60s`, `900s`)
- `m` - Minutes (e.g., `15m`, `30m`)
- `h` - Hours (e.g., `1h`, `24h`)
- `d` - Days (e.g., `7d`, `30d`)

### Recommended Settings

**Development:**
```bash
JWT_ACCESS_EXPIRES_IN=1h      # 1 hour for easier testing
JWT_REFRESH_EXPIRES_IN=7d     # 7 days
```

**Production (Chat App - Not Always Opened):**
```bash
JWT_ACCESS_EXPIRES_IN=7d      # 7 days (user can open app anytime within 7 days)
JWT_REFRESH_EXPIRES_IN=90d    # 90 days (3 months - long for better UX)
```

**Production (High Security):**
```bash
JWT_ACCESS_EXPIRES_IN=15m     # 15 minutes (short for security)
JWT_REFRESH_EXPIRES_IN=30d    # 30 days
```

**Note:** Current default is optimized for chat app (7d access, 90d refresh) ⭐

## 🔍 Verification Process

### Access Token Verification (JwtAuthGuard)

```typescript
1. Check Authorization header exists
2. Extract token from "Bearer <token>"
3. Verify JWT signature with JWT_ACCESS_SECRET
4. Check token expiration
5. Extract userId and deviceId from payload
6. Attach to request.user
```

### Refresh Token Verification (AuthService.refreshToken)

```typescript
1. Verify JWT signature with JWT_REFRESH_SECRET
2. Check JWT expiration
3. Verify deviceId matches
4. Find session in database
5. Verify refresh token hash matches stored hash ⭐
6. Check session expiration
7. Generate new tokens
8. Update session with new refresh token hash
```

## 📝 Implementation Details

### Token Generation

```typescript
// Access Token
jwt.sign(
  { userId, deviceId },
  JWT_ACCESS_SECRET,
  { expiresIn: '15m' }
)

// Refresh Token
jwt.sign(
  { userId, deviceId },
  JWT_REFRESH_SECRET,
  { expiresIn: '30d' }
)
```

### Session Storage

```typescript
{
  user_id: string,
  device_id: string,
  refresh_token_hash: string,  // Hashed with bcrypt
  expires_at: Date,             // Calculated from JWT_REFRESH_EXPIRES_IN
  created_at: Date,
  updated_at: Date
}
```

## 🚨 Common Issues & Solutions

### Issue 1: Access Token Expires Too Fast
**Problem:** User gets 401 after 15 minutes
**Solution:** 
- Increase `JWT_ACCESS_EXPIRES_IN` (e.g., `30m`, `1h`)
- Implement automatic token refresh in frontend

### Issue 2: Refresh Token Not Working
**Problem:** Refresh endpoint returns 401
**Check:**
- Verify refresh token is not expired
- Verify device ID matches
- Check session exists in database
- Verify refresh token hash matches

### Issue 3: Session Expired But Token Valid
**Problem:** Refresh token JWT valid but session expired
**Solution:** 
- This is by design - session expiration is additional security layer
- User must login again

### Issue 4: Token Invalid After Password Reset
**Problem:** All tokens become invalid after password reset
**Solution:** 
- This is by design - all sessions are deleted for security
- User must login again

## ✅ Best Practices

1. **Short Access Token Lifetime**
   - Use 15 minutes or less for access tokens
   - Reduces risk if token is stolen

2. **Long Refresh Token Lifetime**
   - Use 30 days for better UX
   - User doesn't need to login frequently

3. **Automatic Token Refresh**
   - Frontend should refresh token before it expires
   - Refresh when access token is about to expire (e.g., 1 minute before)

4. **Handle 401 Gracefully**
   - Try to refresh token automatically
   - Only redirect to login if refresh fails

5. **Store Tokens Securely**
   - Use secure storage (e.g., httpOnly cookies, secure storage)
   - Never store in localStorage for sensitive apps

## 📊 Summary

| Token Type | Default Expiration | Config Variable | Becomes Invalid (401) When |
|------------|-------------------|-----------------|---------------------------|
| **Access Token** | **7 days** ⭐ | `JWT_ACCESS_EXPIRES_IN` | JWT expiration time passed |
| **Refresh Token** | **90 days (3 months)** ⭐ | `JWT_REFRESH_EXPIRES_IN` | JWT expiration time passed OR session expired OR token hash mismatch |
| **Session** | **90 days (sliding)** ⭐ | `JWT_REFRESH_EXPIRES_IN` | `expires_at` date passed OR session deleted. **Note:** Expiration extends on each refresh (sliding session) |

## 🔄 Refresh Token Flow Diagram

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       │ Access Token Expired (401)
       │
       ▼
┌─────────────────────┐
│ POST /auth/refresh  │
│ - refresh_token     │
│ - x-device-id       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Backend Verify:    │
│  1. JWT signature   │
│  2. JWT expiration  │
│  3. Device ID       │
│  4. Session exists  │
│  5. Token hash      │
│  6. Session expiry  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Generate New Tokens │
│ - Access (15m)      │
│ - Refresh (30d)     │
│ Update Session      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Return New Tokens   │
└─────────────────────┘
```

---

**Note:** Semua token expiration times dapat dikonfigurasi melalui environment variables. Default values adalah 15 menit untuk access token dan 30 hari untuk refresh token.

