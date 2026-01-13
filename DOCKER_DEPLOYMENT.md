# 🐳 Panduan Deployment Docker untuk VM

## Masalah yang Sering Terjadi

Jika Firebase service account tidak bisa connect saat deploy ke Docker di VM, biasanya karena:
1. ✅ File tidak ter-mount dengan benar ke container
2. ✅ Environment variable tidak ter-pass dengan benar
3. ✅ Path file tidak sesuai di dalam container
4. ✅ Permission file tidak sesuai

---

## ⚠️ **Catatan: Docker Compose Command**

Di beberapa VM, Docker Compose menggunakan command berbeda:
- **Docker Compose V1**: `docker-compose` (dengan dash)
- **Docker Compose V2**: `docker compose` (tanpa dash, sebagai plugin)

**Cek versi yang terinstall:**
```bash
# Cek apakah docker compose tersedia
docker compose version

# Atau cek docker-compose
docker-compose --version
```

**Jika `docker-compose` tidak ditemukan, gunakan:**
```bash
# Ganti semua command docker-compose dengan docker compose
docker compose logs -f chatrix-be | grep FcmService
docker compose up -d
docker compose down
docker compose build --no-cache
```

---

## ✅ **Solusi 1: Pakai Environment Variable (PALING DIREKOMENDASIKAN)**

### Kelebihan:
- ✅ Lebih aman (tidak ada file di filesystem)
- ✅ Mudah untuk manage
- ✅ Tidak perlu worry tentang file permissions

### Langkah-langkah:

#### 1. Convert file JSON ke single-line string

Di **local machine** Anda:
```bash
# Convert file ke single-line JSON (hapus semua newline dan space)
cat firebase-service-account.json | jq -c

# Atau jika tidak ada jq, pakai sed (Linux/Mac)
cat firebase-service-account.json | tr -d '\n' | tr -d ' '

# Atau pakai PowerShell (Windows)
Get-Content firebase-service-account.json | ConvertFrom-Json | ConvertTo-Json -Compress
```

#### 2. Copy hasil JSON string tersebut

Hasilnya akan seperti ini (satu baris panjang):
```json
{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

#### 3. Tambahkan ke file `.env` di VM

SSH ke VM Anda:
```bash
ssh user@your-vm-ip
cd /path/to/chatrix/backend
nano .env
```

Tambahkan baris ini di `.env`:
```bash
FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"your-project",...}'
```

**PENTING:** 
- Gunakan single quotes `'...'` untuk wrap JSON string
- Atau escape double quotes dengan backslash: `\"`
- Pastikan tidak ada line break di tengah JSON

#### 4. Update docker-compose.yml

Edit `docker-compose.yml` dan uncomment bagian environment variable:

```yaml
services:
  chatrix-be:
    build:
      context: .
      dockerfile: Dockerfile
    env_file:
      - .env
    # Uncomment baris di bawah untuk pakai environment variable
    environment:
      - FCM_SERVICE_ACCOUNT_JSON=${FCM_SERVICE_ACCOUNT_JSON}
    # Comment atau hapus bagian volumes untuk firebase file
    # volumes:
    #   - ./firebase-service-account.json:/app/firebase-service-account.json:ro
```

#### 5. Rebuild dan restart container

```bash
# Gunakan docker compose (tanpa dash) jika docker-compose tidak ditemukan
docker compose down
docker compose build --no-cache
docker compose up -d

# Atau jika docker-compose tersedia:
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

#### 6. Cek log untuk verifikasi

```bash
# Gunakan docker compose (tanpa dash)
docker compose logs -f chatrix-be | grep FcmService

# Atau jika docker-compose tersedia:
docker-compose logs -f chatrix-be | grep FcmService
```

Cari log ini:
```
[FcmService] ✅ Firebase Admin initialized from FCM_SERVICE_ACCOUNT_JSON environment variable
```

---

## ✅ **Solusi 2: Mount File ke Container**

Jika tetap ingin pakai file (tidak direkomendasikan untuk production):

### Langkah-langkah:

#### 1. Upload file ke VM

Dari **local machine**:
```bash
scp firebase-service-account.json user@your-vm-ip:/path/to/chatrix/backend/
```

#### 2. Set permissions file di VM

SSH ke VM:
```bash
ssh user@your-vm-ip
cd /path/to/chatrix/backend
chmod 600 firebase-service-account.json
```

#### 3. Pastikan docker-compose.yml sudah benar

File `docker-compose.yml` sudah dikonfigurasi untuk mount file:
```yaml
services:
  chatrix-be:
    volumes:
      - ./firebase-service-account.json:/app/firebase-service-account.json:ro
    environment:
      - FCM_SERVICE_ACCOUNT_PATH=/app/firebase-service-account.json
```

#### 4. Rebuild dan restart

```bash
# Gunakan docker compose (tanpa dash)
docker compose down
docker compose build --no-cache
docker compose up -d
```

#### 5. Cek log

```bash
docker compose logs -f chatrix-be | grep FcmService
```

Cari log ini:
```
[FcmService] ✅ Firebase Admin initialized successfully
[FcmService]    Service Account: /app/firebase-service-account.json
[FcmService]    Project ID: your-project-id
```

---

## 🔍 **Troubleshooting**

### Error: "docker-compose: command not found"

**Solusi:**
```bash
# Cek apakah docker compose (V2) tersedia
docker compose version

# Jika tersedia, gunakan docker compose (tanpa dash) untuk semua command
# Contoh:
docker compose logs -f chatrix-be
docker compose up -d
docker compose exec chatrix-be ls -la /app
```

**Atau install docker-compose V1:**
```bash
# Download docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Set permissions
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

### Error: "FCM service account file not found"

**Kemungkinan penyebab:**
1. File tidak ter-mount dengan benar
2. Path di environment variable salah
3. File tidak ada di host

**Solusi:**
```bash
# Cek apakah file ada di host
ls -la firebase-service-account.json

# Cek apakah file ter-mount di container
docker compose exec chatrix-be ls -la /app/firebase-service-account.json

# Cek environment variable di container
docker compose exec chatrix-be env | grep FCM
```

### Error: "Failed to parse FCM_SERVICE_ACCOUNT_JSON"

**Kemungkinan penyebab:**
1. JSON string tidak valid (ada line break atau quote tidak escape)
2. Environment variable tidak ter-pass dengan benar

**Solusi:**
```bash
# Test parse JSON di container
docker compose exec chatrix-be node -e "console.log(JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON))"

# Jika error, berarti JSON string tidak valid
# Pastikan di .env menggunakan single quotes dan tidak ada line break
```

### Error: "Service account file missing project_id field"

**Kemungkinan penyebab:**
1. File JSON corrupt atau tidak lengkap
2. File bukan service account key yang benar

**Solusi:**
```bash
# Validasi file JSON
cat firebase-service-account.json | jq '.project_id'

# Pastikan file memiliki field: project_id, private_key, client_email
```

---

## 📋 **Checklist Deployment**

Sebelum deploy, pastikan:

- [ ] File `firebase-service-account.json` sudah di-upload ke VM (jika pakai Solusi 2)
- [ ] File `.env` sudah dikonfigurasi dengan benar
- [ ] `FCM_SERVICE_ACCOUNT_JSON` sudah di-set di `.env` (jika pakai Solusi 1)
- [ ] `docker-compose.yml` sudah dikonfigurasi dengan benar
- [ ] File permissions sudah benar (`chmod 600` jika pakai file)
- [ ] Container sudah di-rebuild setelah perubahan
- [ ] Log menunjukkan Firebase initialized successfully
- [ ] Menggunakan command yang benar (`docker compose` atau `docker-compose`)

---

## 🚀 **Quick Start (Recommended)**

```bash
# 1. Convert JSON ke string (di local)
cat firebase-service-account.json | jq -c > fcm-json-string.txt

# 2. Copy isi fcm-json-string.txt ke .env di VM
# Tambahkan: FCM_SERVICE_ACCOUNT_JSON='<paste-isi-file>'

# 3. Update docker-compose.yml (uncomment environment variable)

# 4. Deploy (gunakan docker compose atau docker-compose sesuai yang tersedia)
docker compose down
docker compose build --no-cache
docker compose up -d

# 5. Cek log
docker compose logs -f chatrix-be | grep FcmService
```

---

## ✅ **Kesimpulan**

**Untuk Production VM dengan Docker:**
1. **PALING DIREKOMENDASIKAN**: Pakai **Environment Variable** (`FCM_SERVICE_ACCOUNT_JSON`)
2. **Alternatif**: Mount file dengan volume (pastikan permissions benar)

**Jangan:**
- ❌ Copy file langsung ke Docker image (tidak aman)
- ❌ Hardcode credentials di code
- ❌ Commit file ke Git

**Catatan Command:**
- Gunakan `docker compose` (tanpa dash) jika `docker-compose` tidak ditemukan
- Atau install docker-compose V1 jika lebih familiar

---

Selesai! Pilih solusi yang sesuai dan ikuti langkah-langkahnya. 🎉
