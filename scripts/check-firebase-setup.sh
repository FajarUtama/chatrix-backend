#!/bin/bash
# Script untuk check Firebase setup di VM

echo "🔍 Checking Firebase Setup..."
echo ""

# Check if running in container or host
if [ -f /.dockerenv ]; then
    echo "📍 Running inside Docker container"
    CONTAINER_MODE=true
else
    echo "📍 Running on host VM"
    CONTAINER_MODE=false
fi

echo ""
echo "1️⃣ Checking environment variables..."
if [ -n "$FCM_SERVICE_ACCOUNT_JSON" ]; then
    echo "   ✅ FCM_SERVICE_ACCOUNT_JSON is set"
    echo "   Length: ${#FCM_SERVICE_ACCOUNT_JSON} characters"
    
    # Try to parse JSON
    if echo "$FCM_SERVICE_ACCOUNT_JSON" | jq -e . > /dev/null 2>&1; then
        echo "   ✅ JSON is valid"
        PROJECT_ID=$(echo "$FCM_SERVICE_ACCOUNT_JSON" | jq -r '.project_id // "N/A"')
        echo "   Project ID: $PROJECT_ID"
    else
        echo "   ❌ JSON is invalid!"
    fi
else
    echo "   ❌ FCM_SERVICE_ACCOUNT_JSON is NOT set"
fi

if [ -n "$FCM_SERVICE_ACCOUNT_PATH" ]; then
    echo "   ✅ FCM_SERVICE_ACCOUNT_PATH is set: $FCM_SERVICE_ACCOUNT_PATH"
else
    echo "   ⚠️  FCM_SERVICE_ACCOUNT_PATH is NOT set (will use default)"
fi

echo ""
echo "2️⃣ Checking file existence..."
DEFAULT_PATH="./firebase-service-account.json"
CUSTOM_PATH="${FCM_SERVICE_ACCOUNT_PATH:-$DEFAULT_PATH}"

if [ -f "$CUSTOM_PATH" ]; then
    echo "   ✅ File found at: $CUSTOM_PATH"
    echo "   Size: $(stat -f%z "$CUSTOM_PATH" 2>/dev/null || stat -c%s "$CUSTOM_PATH" 2>/dev/null) bytes"
    echo "   Permissions: $(stat -f%Sp "$CUSTOM_PATH" 2>/dev/null || stat -c%A "$CUSTOM_PATH" 2>/dev/null)"
    
    # Validate JSON
    if jq -e . "$CUSTOM_PATH" > /dev/null 2>&1; then
        echo "   ✅ File contains valid JSON"
        PROJECT_ID=$(jq -r '.project_id // "N/A"' "$CUSTOM_PATH")
        echo "   Project ID: $PROJECT_ID"
    else
        echo "   ❌ File does not contain valid JSON!"
    fi
else
    echo "   ❌ File NOT found at: $CUSTOM_PATH"
    echo "   Current directory: $(pwd)"
    echo "   Looking for: $(realpath "$CUSTOM_PATH" 2>/dev/null || echo "$CUSTOM_PATH")"
fi

echo ""
echo "3️⃣ Checking .env file..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"
    if grep -q "FCM_SERVICE_ACCOUNT" .env; then
        echo "   ✅ FCM_SERVICE_ACCOUNT found in .env"
        echo "   Content (first 100 chars):"
        grep "FCM_SERVICE_ACCOUNT" .env | head -c 100
        echo "..."
    else
        echo "   ❌ FCM_SERVICE_ACCOUNT not found in .env"
    fi
else
    echo "   ⚠️  .env file not found"
fi

echo ""
echo "4️⃣ Docker container check (if applicable)..."
if command -v docker &> /dev/null; then
    if docker compose ps chatrix-be 2>/dev/null | grep -q chatrix-be; then
        echo "   ✅ Container chatrix-be is running"
        echo ""
        echo "   Checking inside container..."
        docker compose exec chatrix-be sh -c '
            echo "   Environment variables:"
            if [ -n "$FCM_SERVICE_ACCOUNT_JSON" ]; then
                echo "     ✅ FCM_SERVICE_ACCOUNT_JSON is set (length: ${#FCM_SERVICE_ACCOUNT_JSON})"
            else
                echo "     ❌ FCM_SERVICE_ACCOUNT_JSON is NOT set"
            fi
            if [ -n "$FCM_SERVICE_ACCOUNT_PATH" ]; then
                echo "     ✅ FCM_SERVICE_ACCOUNT_PATH: $FCM_SERVICE_ACCOUNT_PATH"
            else
                echo "     ⚠️  FCM_SERVICE_ACCOUNT_PATH not set"
            fi
            echo ""
            echo "   File check:"
            if [ -f "/app/firebase-service-account.json" ]; then
                echo "     ✅ File exists at /app/firebase-service-account.json"
                ls -lh /app/firebase-service-account.json
            else
                echo "     ❌ File NOT found at /app/firebase-service-account.json"
            fi
        '
    else
        echo "   ⚠️  Container chatrix-be is not running"
    fi
else
    echo "   ⚠️  Docker not available"
fi

echo ""
echo "✅ Check complete!"
