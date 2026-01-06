#!/bin/bash

# Script untuk test MQTT publish dari backend
# Usage: ./scripts/test-mqtt-publish.sh

echo "═══════════════════════════════════════════════════════════"
echo "🧪 MQTT PUBLISH TEST SCRIPT"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Konfigurasi
MQTT_BROKER="${MQTT_BROKER:-localhost}"
MQTT_PORT="${MQTT_PORT:-1883}"
TEST_TOPIC="chat/v1/users/testuser123/messages"

# Test payload
TEST_PAYLOAD='{
  "type": "message",
  "message_id": "test_'$(date +%s)'",
  "conversation_id": "test_conv_123",
  "sender_id": "test_sender_456",
  "server_ts": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
  "payload": {
    "text": "Test message from script"
  }
}'

echo "📋 Configuration:"
echo "   Broker: $MQTT_BROKER:$MQTT_PORT"
echo "   Topic: $TEST_TOPIC"
echo ""

# Test publish
echo "📤 Publishing test message..."
mosquitto_pub -h "$MQTT_BROKER" -p "$MQTT_PORT" \
  -t "$TEST_TOPIC" \
  -m "$TEST_PAYLOAD" \
  -q 1

if [ $? -eq 0 ]; then
  echo "✅ Publish successful!"
  echo ""
  echo "💡 Now check if subscriber receives the message:"
  echo "   mosquitto_sub -h $MQTT_BROKER -p $MQTT_PORT -t '$TEST_TOPIC' -v"
else
  echo "❌ Publish failed!"
  echo "   Check broker connection and permissions"
fi



