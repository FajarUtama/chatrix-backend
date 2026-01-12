# Debug Firebase di VM

Berdasarkan error yang muncul: `"Firebase Admin not initialized"`

---

## 🔍 Langkah Debug

### Step 1: Cek Log Saat Backend Start

SSH ke VM dan cek log saat backend start:

```bash
# Jika pakai systemd
sudo journalctl -u chatrix-backend -f

# Atau jika pakai PM2
pm2 logs chatrix-backend

# Atau jika run manual
npm run start:dev
```

**Cari log terkait Firebase:**
- `[FcmService] Looking for Firebase service account at: ...`
- `[FcmService] ✅ Firebase Admin initialized successfully` (jika berhasil)
- `[FcmService] ⚠️ FCM service account file not found` (jika file tidak ada)
- `[FcmService] ❌ Failed to load service account file` (jika error load file)

---

### Step 2: Cek File Exists di VM

```bash
# SSH ke VM
ssh fajarutama1606@34.169.119.250

# Cek apakah file ada
ls -la ~/apps/chatrix-be/firebase-service-account.json

# Atau cek di root project
cd ~/apps/chatrix-be
ls -la firebase-service-account.json
```

**Jika file tidak ada:**
- File belum di-upload ke VM
- Atau path salah

---

### Step 3: Cek Working Directory

Backend mungkin running dari directory yang berbeda:

```bash
# Cek working directory saat backend running
# Di VM, cek process
ps aux | grep node

# Atau cek systemd service file
sudo cat /etc/systemd/system/chatrix-backend.service | grep WorkingDirectory
```

**Jika working directory berbeda:**
- File perlu di-upload ke directory yang benar
- Atau set absolute path di environment variable

---

### Step 4: Cek Environment Variable

```bash
# Cek apakah environment variable sudah set
echo $FCM_SERVICE_ACCOUNT_JSON

# Atau cek di systemd service
sudo cat /etc/systemd/system/chatrix-backend.service | grep FCM
```

**Jika tidak ada:**
- Perlu set environment variable
- Atau upload file ke VM

---

## 🔧 Solusi

### Opsi 1: Upload File ke VM (Quick Fix)

```bash
# Dari local machine
scp firebase-service-account.json fajarutama1606@34.169.119.250:~/apps/chatrix-be/

# Set permissions
ssh fajarutama1606@34.169.119.250
chmod 600 ~/apps/chatrix-be/firebase-service-account.json

# Restart backend
sudo systemctl restart chatrix-backend
# atau
pm2 restart chatrix-backend
```

---

### Opsi 2: Set Environment Variable (Recommended)

```bash
# SSH ke VM
ssh fajarutama1606@34.169.119.250

# Convert file ke string (jika file sudah ada di VM)
cat ~/apps/chatrix-be/firebase-service-account.json | jq -c

# Copy output JSON string, lalu set environment variable
# Edit systemd service file
sudo nano /etc/systemd/system/chatrix-backend.service

# Tambahkan di [Service] section:
Environment="FCM_SERVICE_ACCOUNT_JSON='PASTE_JSON_STRING_HERE'"

# Reload dan restart
sudo systemctl daemon-reload
sudo systemctl restart chatrix-backend
```

---

### Opsi 3: Set Custom Path

Jika file ada di lokasi lain:

```bash
# Edit systemd service file
sudo nano /etc/systemd/system/chatrix-backend.service

# Tambahkan:
Environment="FCM_SERVICE_ACCOUNT_PATH=/path/to/firebase-service-account.json"

# Reload dan restart
sudo systemctl daemon-reload
sudo systemctl restart chatrix-backend
```

---

## 🧪 Verifikasi Setelah Fix

```bash
# Cek health endpoint
curl http://34.169.119.250:3000/health | jq '.services.firebase'

# Expected:
# {
#   "status": "up",
#   "initialized": true,
#   "project_id": "your-project-id",
#   "messaging_available": true
# }
```

---

## 📋 Checklist

- [ ] File `firebase-service-account.json` ada di VM?
- [ ] File di lokasi yang benar (sama dengan working directory backend)?
- [ ] File permissions OK (readable)?
- [ ] File format JSON valid?
- [ ] Environment variable set (jika pakai env var)?
- [ ] Backend sudah restart setelah setup?
- [ ] Log menunjukkan "Firebase Admin initialized successfully"?

---

## 🔍 Quick Debug Command

```bash
# Di VM, jalankan ini untuk cek semua:
cd ~/apps/chatrix-be

# 1. Cek file exists
ls -la firebase-service-account.json

# 2. Cek JSON valid
cat firebase-service-account.json | jq .

# 3. Cek working directory
pwd

# 4. Cek environment variable
env | grep FCM

# 5. Cek log backend
sudo journalctl -u chatrix-backend -n 50 | grep FcmService
```

---

Selesai! Gunakan langkah-langkah di atas untuk debug dan fix masalah Firebase di VM. 🔍
