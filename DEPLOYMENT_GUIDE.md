# Panduan Deployment ke VM

## 🔐 Firebase Service Account untuk Production

Ada beberapa cara untuk handle Firebase key saat deploy ke VM:

---

## ✅ **Opsi 1: Environment Variable (RECOMMENDED)**

**Kelebihan:**
- ✅ Lebih aman (tidak ada file di filesystem)
- ✅ Mudah untuk CI/CD
- ✅ Tidak perlu manage file permissions
- ✅ Bisa di-rotate dengan mudah

**Cara Setup:**

### 1. Convert JSON ke String
```bash
# Di local machine, convert file ke single-line JSON
cat firebase-service-account.json | jq -c
```

### 2. Set di VM
```bash
# SSH ke VM
ssh user@your-vm-ip

# Edit environment file (misalnya .env atau systemd service)
sudo nano /etc/chatrix/.env

# Atau set di systemd service file
sudo nano /etc/systemd/system/chatrix-backend.service
```

### 3. Tambahkan ke Environment File
```bash
# Di file .env atau systemd service
FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"your-project",...}'
```

### 4. Restart Service
```bash
# Jika pakai systemd
sudo systemctl restart chatrix-backend

# Atau jika pakai PM2
pm2 restart chatrix-backend
```

---

## ⚠️ **Opsi 2: Upload File Langsung (Tidak Direkomendasikan)**

**Kekurangan:**
- ❌ File tersimpan di filesystem (lebih mudah diakses)
- ❌ Perlu manage file permissions
- ❌ Lebih sulit untuk rotate keys

**Jika tetap ingin pakai cara ini:**

### 1. Upload File ke VM
```bash
# Dari local machine
scp firebase-service-account.json user@your-vm-ip:/opt/chatrix/backend/
```

### 2. Set Permissions yang Ketat
```bash
# SSH ke VM
ssh user@your-vm-ip

# Set ownership dan permissions
sudo chown app-user:app-user /opt/chatrix/backend/firebase-service-account.json
sudo chmod 600 /opt/chatrix/backend/firebase-service-account.json  # Read/write untuk owner saja
```

### 3. Set Environment Variable untuk Path
```bash
# Di .env atau systemd service
FCM_SERVICE_ACCOUNT_PATH=/opt/chatrix/backend/firebase-service-account.json
```

### 4. Pastikan File Tidak Ter-commit
```bash
# Pastikan .gitignore sudah include
echo "firebase-service-account.json" >> .gitignore

# Jangan commit file ini!
```

---

## 🐳 **Opsi 3: Docker Volume Mount**

Jika deploy pakai Docker:

### docker-compose.yml
```yaml
services:
  backend:
    build: .
    environment:
      - FCM_SERVICE_ACCOUNT_PATH=/app/firebase-service-account.json
    volumes:
      # Mount file dari host ke container
      - ./firebase-service-account.json:/app/firebase-service-account.json:ro  # read-only
    # Atau lebih aman pakai Docker secrets
    secrets:
      - firebase_service_account

secrets:
  firebase_service_account:
    file: ./firebase-service-account.json
```

### Atau Pakai Docker Secrets (Lebih Aman)
```yaml
services:
  backend:
    build: .
    environment:
      - FCM_SERVICE_ACCOUNT_JSON_FILE=/run/secrets/firebase_service_account
    secrets:
      - firebase_service_account

secrets:
  firebase_service_account:
    file: ./firebase-service-account.json
```

---

## 🔒 **Opsi 4: Secrets Management (Paling Aman untuk Production)**

Gunakan secrets management tools:

### AWS Secrets Manager
```bash
# Store secret di AWS
aws secretsmanager create-secret \
  --name chatrix/firebase-service-account \
  --secret-string file://firebase-service-account.json

# Di VM, fetch dari AWS
FCM_SERVICE_ACCOUNT_JSON=$(aws secretsmanager get-secret-value \
  --secret-id chatrix/firebase-service-account \
  --query SecretString --output text)
```

### HashiCorp Vault
```bash
# Store di Vault
vault kv put secret/chatrix/firebase-service-account \
  @firebase-service-account.json

# Fetch di VM
FCM_SERVICE_ACCOUNT_JSON=$(vault kv get -format=json secret/chatrix/firebase-service-account | jq -r .data.data)
```

---

## 📋 **Rekomendasi Berdasarkan Environment**

### Development (Local)
✅ **Pakai File JSON** di root project
- Mudah untuk development
- File sudah di `.gitignore`

### Staging/Testing
✅ **Pakai Environment Variable**
- Lebih aman dari file
- Mudah untuk testing

### Production
✅ **Pakai Environment Variable atau Secrets Management**
- **Environment Variable**: Simple, cukup aman jika VM secure
- **Secrets Management**: Paling aman, recommended untuk enterprise

---

## 🚀 **Contoh Setup dengan Systemd**

### 1. Buat Service File
```bash
sudo nano /etc/systemd/system/chatrix-backend.service
```

### 2. Isi Service File
```ini
[Unit]
Description=Chatrix Backend Service
After=network.target

[Service]
Type=simple
User=app-user
WorkingDirectory=/opt/chatrix/backend
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=10

# Environment Variables
Environment="NODE_ENV=production"
Environment="FCM_SERVICE_ACCOUNT_JSON={\"type\":\"service_account\",...}"

[Install]
WantedBy=multi-user.target
```

### 3. Enable dan Start
```bash
sudo systemctl daemon-reload
sudo systemctl enable chatrix-backend
sudo systemctl start chatrix-backend
sudo systemctl status chatrix-backend
```

---

## 🧪 **Verifikasi Setup**

Setelah deploy, cek log:

```bash
# Cek log service
sudo journalctl -u chatrix-backend -f

# Atau jika pakai PM2
pm2 logs chatrix-backend
```

**Log yang diharapkan:**
```
[FcmService] ✅ Firebase Admin initialized successfully
[FcmService]    Project ID: your-project-id
```

**Jika error:**
```
[FcmService] ⚠️ FCM service account file not found
```
→ Periksa environment variable atau file path

---

## 🔐 **Security Checklist**

- [ ] File tidak di-commit ke Git (sudah di `.gitignore`)
- [ ] File permissions set ke `600` (jika pakai file)
- [ ] Environment variable tidak di-log atau expose
- [ ] VM firewall sudah dikonfigurasi dengan benar
- [ ] SSH key-based authentication (bukan password)
- [ ] Regular key rotation (setiap 3-6 bulan)

---

## 📝 **Quick Reference**

### Upload File (Jika Pakai Opsi 2)
```bash
scp firebase-service-account.json user@vm-ip:/opt/chatrix/backend/
ssh user@vm-ip
sudo chmod 600 /opt/chatrix/backend/firebase-service-account.json
```

### Set Environment Variable (Recommended)
```bash
# Di VM
export FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Atau di .env file
echo 'FCM_SERVICE_ACCOUNT_JSON={"type":"service_account",...}' >> .env
```

### Test Connection
```bash
# Di VM
curl http://localhost:3000/health
# Cek log untuk Firebase initialization
```

---

## ✅ **Kesimpulan**

**Untuk Production VM:**
1. **Paling Direkomendasikan**: Pakai **Environment Variable** (`FCM_SERVICE_ACCOUNT_JSON`)
2. **Alternatif**: Upload file dengan permissions ketat (`chmod 600`)
3. **Enterprise**: Pakai **Secrets Management** (AWS Secrets Manager, Vault, dll)

**Jangan:**
- ❌ Commit file ke Git
- ❌ Set permissions terlalu open (`chmod 644` atau lebih)
- ❌ Hardcode credentials di code

---

Selesai! Pilih metode yang sesuai dengan kebutuhan dan security requirements Anda. 🚀
