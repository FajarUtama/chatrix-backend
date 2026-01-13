# PowerShell script untuk convert firebase-service-account.json ke format environment variable

$FirebaseFile = "firebase-service-account.json"
$OutputFile = ".env.firebase"

if (-not (Test-Path $FirebaseFile)) {
    Write-Host "❌ Error: File $FirebaseFile tidak ditemukan!" -ForegroundColor Red
    Write-Host "   Pastikan file ada di direktori yang sama dengan script ini."
    exit 1
}

Write-Host "🔄 Converting $FirebaseFile to environment variable format..." -ForegroundColor Yellow

try {
    # Read and compress JSON
    $jsonContent = Get-Content $FirebaseFile -Raw | ConvertFrom-Json | ConvertTo-Json -Compress
    
    # Create output file
    @"
# Firebase Service Account JSON
# Copy baris di bawah ini ke file .env Anda

FCM_SERVICE_ACCOUNT_JSON='$jsonContent'
"@ | Out-File -FilePath $OutputFile -Encoding utf8
    
    Write-Host "✅ Berhasil!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📄 File output: $OutputFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 Langkah selanjutnya:" -ForegroundColor Yellow
    Write-Host "   1. Buka file $OutputFile"
    Write-Host "   2. Copy baris FCM_SERVICE_ACCOUNT_JSON ke file .env di VM Anda"
    Write-Host "   3. Atau langsung copy baris ini:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "FCM_SERVICE_ACCOUNT_JSON='$jsonContent'" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "❌ Error: Gagal memproses file JSON" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}
