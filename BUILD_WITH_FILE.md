# 🐳 Build Docker Image dengan Firebase Service Account File

## ⚠️ **PENTING: Security Warning**

**Memasukkan credentials ke Docker image TIDAK direkomendasikan untuk production** karena:
- ❌ Credentials tersimpan permanen di image
- ❌ Siapa pun yang punya akses ke image bisa extract credentials
- ❌ Tidak bisa rotate credentials tanpa rebuild image
- ❌ Image size menjadi lebih besar

**Alternatif yang lebih aman:**
- ✅ Pakai **Environment Variable** (`FCM_SERVICE_ACCOUNT_JSON`)
- ✅ Pakai **Volume Mount** dari host
- ✅ Pakai **Docker Secrets** atau **Secrets Management**

---

## 📋 **Cara Build dengan File di Image**

Jika tetap ingin file ikut di-build ke image:

### Langkah 1: Pastikan File Ada di Root Directory

File `firebase-service-account.json` harus ada di root directory project sebelum build:

```bash
# Di VM atau local machine
cd ~/apps/chatrix-be
ls -la firebase-service-account.json
```

Jika tidak ada, upload file:
```bash
# Dari local machine
scp firebase-service-account.json user@vm-ip:~/apps/chatrix-be/
```

### Langkah 2: Pastikan File Tidak Di-ignore

File sudah dikonfigurasi di `.dockerignore` untuk **TIDAK di-ignore**, jadi akan ikut di-build.

### Langkah 3: Build Image

```bash
# Build image (file akan ikut ter-copy)
docker compose build --no-cache

# Atau jika pakai docker build langsung
docker build -t chatrix-be .
```

### Langkah 4: Update docker-compose.yml

File `docker-compose.yml` sudah dikonfigurasi untuk menggunakan file dari image (tidak perlu volume mount).

### Langkah 5: Start Container

```bash
docker compose up -d
```

### Langkah 6: Verifikasi

```bash
docker compose logs -f chatrix-be | grep FcmService
```

Harus muncul:
```
✅ Firebase Admin initialized successfully
   Service Account: /app/firebase-service-account.json
   Project ID: your-project-id
```

---

## 🔍 **Troubleshooting**

### Error: "COPY failed: file not found"

**Penyebab:** File `firebase-service-account.json` tidak ada di root directory saat build.

**Solusi:**
```bash
# Pastikan file ada sebelum build
ls -la firebase-service-account.json

# Jika tidak ada, upload dulu
scp firebase-service-account.json user@vm-ip:~/apps/chatrix-be/
```

### Error: "FCM service account file not found"

**Penyebab:** File tidak ter-copy dengan benar ke image.

**Solusi:**
```bash
# Cek apakah file ada di image
docker compose exec chatrix-be ls -la /app/firebase-service-account.json

# Jika tidak ada, rebuild image
docker compose build --no-cache
docker compose up -d
```

### File tidak ikut di-build

**Penyebab:** File mungkin di-ignore oleh `.dockerignore` atau `.gitignore`.

**Solusi:**
1. Cek `.dockerignore` - pastikan `firebase-service-account.json` **TIDAK** ada di list
2. File di `.gitignore` tidak masalah (hanya untuk Git, bukan Docker)

---

## 📝 **Perbandingan Metode**

| Metode | Keamanan | Kemudahan | Rekomendasi |
|--------|----------|-----------|-------------|
| **Environment Variable** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ **Paling Direkomendasikan** |
| **Volume Mount** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ Baik untuk Production |
| **Build ke Image** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⚠️ Hanya untuk Development |

---

## ✅ **Kesimpulan**

**Untuk Development:**
- ✅ Boleh pakai build ke image (lebih mudah)

**Untuk Production:**
- ❌ **JANGAN** pakai build ke image
- ✅ Pakai **Environment Variable** atau **Volume Mount**

---

## 🚀 **Quick Start**

```bash
# 1. Pastikan file ada
ls -la firebase-service-account.json

# 2. Build image
docker compose build --no-cache

# 3. Start container
docker compose up -d

# 4. Cek log
docker compose logs -f chatrix-be | grep FcmService
```

---

Selesai! File sekarang akan ikut di-build ke image. 🎉
