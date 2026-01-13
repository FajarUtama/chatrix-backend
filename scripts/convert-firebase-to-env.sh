#!/bin/bash
# Script untuk convert firebase-service-account.json ke format environment variable

FIREBASE_FILE="firebase-service-account.json"
OUTPUT_FILE=".env.firebase"

if [ ! -f "$FIREBASE_FILE" ]; then
    echo "❌ Error: File $FIREBASE_FILE tidak ditemukan!"
    echo "   Pastikan file ada di direktori yang sama dengan script ini."
    exit 1
fi

echo "🔄 Converting $FIREBASE_FILE to environment variable format..."

# Check if jq is available
if command -v jq &> /dev/null; then
    # Use jq to compress JSON
    JSON_STRING=$(cat "$FIREBASE_FILE" | jq -c)
else
    # Fallback: use sed to remove newlines and spaces
    echo "⚠️  jq tidak ditemukan, menggunakan sed sebagai fallback..."
    JSON_STRING=$(cat "$FIREBASE_FILE" | tr -d '\n' | sed 's/  */ /g')
fi

# Create .env.firebase file
echo "# Firebase Service Account JSON" > "$OUTPUT_FILE"
echo "# Copy baris di bawah ini ke file .env Anda" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "FCM_SERVICE_ACCOUNT_JSON='$JSON_STRING'" >> "$OUTPUT_FILE"

echo "✅ Berhasil!"
echo ""
echo "📄 File output: $OUTPUT_FILE"
echo ""
echo "📋 Langkah selanjutnya:"
echo "   1. Buka file $OUTPUT_FILE"
echo "   2. Copy baris FCM_SERVICE_ACCOUNT_JSON ke file .env di VM Anda"
echo "   3. Atau langsung copy baris ini:"
echo ""
echo "FCM_SERVICE_ACCOUNT_JSON='$JSON_STRING'"
echo ""
