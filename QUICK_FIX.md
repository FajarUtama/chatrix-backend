# 🚀 Quick Fix: Firebase Connection Issue

## Masalah Saat Ini

Dari log terlihat:
```
⚠️ FCM service account file not found at /app/firebase-service-account.json
```

Ini berarti:
1. ❌ File tidak ter-mount dengan benar ke container, ATAU
2. ❌ Environment variable `FCM_SERVICE_ACCOUNT_JSON` tidak ter-set

---

## ✅ **Solusi Cepat: Pakai Environment Variable (RECOMMENDED)**

### Langkah 1: Convert JSON ke String

Di **local machine** (Windows), jalankan:

```powershell
cd d:\PROJECTS\chatrix\backend
.\scripts\convert-firebase-to-env.ps1
```

Ini akan membuat file `.env.firebase` dengan JSON string yang sudah di-compress.

### Langkah 2: Copy ke VM

1. Buka file `.env.firebase` yang baru dibuat
2. Copy baris `FCM_SERVICE_ACCOUNT_JSON='...'`
3. SSH ke VM dan edit `.env`:

```bash
ssh fajarutama1606@chatrix-instance
cd ~/apps/chatrix-be
nano .env
```

4. Paste baris tersebut ke file `.env` (pastikan tidak ada line break di tengah JSON)

### Langkah 3: Update docker-compose.yml

Edit `docker-compose.yml` di VM:

```bash
nano docker-compose.yml
```

**Ubah dari:**
```yaml
    # Opsi 1: Gunakan environment variable (RECOMMENDED)
    # Uncomment baris di bawah jika ingin pakai FCM_SERVICE_ACCOUNT_JSON dari .env
    # environment:
    #   - FCM_SERVICE_ACCOUNT_JSON=${FCM_SERVICE_ACCOUNT_JSON}
    
    # Opsi 2: Mount file firebase-service-account.json dari host
    volumes:
      - ./firebase-service-account.json:/app/firebase-service-account.json:ro
    environment:
      - FCM_SERVICE_ACCOUNT_PATH=/app/firebase-service-account.json
```

**Menjadi:**
```yaml
    # Opsi 1: Gunakan environment variable (RECOMMENDED)
    environment:
      - FCM_SERVICE_ACCOUNT_JSON=${FCM_SERVICE_ACCOUNT_JSON}
    
    # Opsi 2: Mount file firebase-service-account.json dari host (DISABLED)
    # volumes:
    #   - ./firebase-service-account.json:/app/firebase-service-account.json:ro
    # environment:
    #   - FCM_SERVICE_ACCOUNT_PATH=/app/firebase-service-account.json
```

### Langkah 4: Restart Container

```bash
docker compose down
docker compose up -d
```

### Langkah 5: Verifikasi

```bash
docker compose logs -f chatrix-be | grep FcmService
```

Harus muncul:
```
✅ Firebase Admin initialized from FCM_SERVICE_ACCOUNT_JSON environment variable
```

---

## 🔍 **Alternatif: Troubleshooting File Mount**

Jika tetap ingin pakai file, cek dulu:

### 1. Cek apakah file ada di host VM

```bash
cd ~/apps/chatrix-be
ls -la firebase-service-account.json
```

Jika tidak ada, upload file:
```bash
# Dari local machine
scp firebase-service-account.json fajarutama1606@chatrix-instance:~/apps/chatrix-be/
```

### 2. Set permissions

```bash
chmod 600 firebase-service-account.json
```

### 3. Cek apakah file ter-mount di container

```bash
docker compose exec chatrix-be ls -la /app/firebase-service-account.json
```

Jika file tidak ter-mount, pastikan `docker-compose.yml` sudah benar (lihat Solusi Cepat di atas untuk konfigurasi yang benar).

### 4. Restart container

```bash
docker compose restart chatrix-be
```

---

## 🛠️ **Script Troubleshooting**

Upload script ini ke VM untuk check setup:

```bash
# Di VM
cd ~/apps/chatrix-be
chmod +x scripts/check-firebase-setup.sh
./scripts/check-firebase-setup.sh
```

Script ini akan check:
- ✅ Environment variables
- ✅ File existence
- ✅ .env configuration
- ✅ Docker container status

---

## 📋 **Checklist**

Sebelum restart, pastikan:

- [ ] File `.env` sudah berisi `FCM_SERVICE_ACCOUNT_JSON='...'` (jika pakai Solusi 1)
- [ ] File `firebase-service-account.json` ada di host VM (jika pakai Solusi 2)
- [ ] `docker-compose.yml` sudah dikonfigurasi dengan benar
- [ ] Container sudah di-restart setelah perubahan

---

## ✅ **Kesimpulan**

**PALING MUDAH**: Pakai **Environment Variable** (Solusi Cepat di atas)
- Tidak perlu upload file
- Tidak perlu worry tentang file permissions
- Lebih aman

**Jika masih error**, jalankan script troubleshooting dan kirimkan output-nya.
