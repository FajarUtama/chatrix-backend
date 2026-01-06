#!/bin/bash

# Script untuk test MQTT subscribe (simulasi FE)
# Usage: ./scripts/test-mqtt-subscribe.sh <userId>

if [ -z "$1" ]; then
  echo "Usage: ./scripts/test-mqtt-subscribe.sh <userId>"
  echo "Example: ./scripts/test-mqtt-subscribe.sh user123"
  exit 1
fi

USER_ID=$1
MQTT_BROKER="${MQTT_BROKER:-localhost}"
MQTT_PORT="${MQTT_PORT:-1883}"

# Topics yang FE harus subscribe
MESSAGES_TOPIC="chat/v1/users/$USER_ID/messages"
RECEIPTS_TOPIC="chat/v1/users/$USER_ID/receipts"
CONVERSATIONS_TOPIC="chat/v1/users/$USER_ID/conversations"

echo "═══════════════════════════════════════════════════════════"
echo "🧪 MQTT SUBSCRIBE TEST (Simulating Frontend)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 Configuration:"
echo "   Broker: $MQTT_BROKER:$MQTT_PORT"
echo "   User ID: $USER_ID"
echo ""
echo "📡 Subscribing to topics:"
echo "   1. $MESSAGES_TOPIC"
echo "   2. $RECEIPTS_TOPIC"
echo "   3. $CONVERSATIONS_TOPIC"
echo ""
echo "💡 Send a message to this user from another client"
echo "   to test if messages are received here"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Subscribe to all topics
mosquitto_sub -h "$MQTT_BROKER" -p "$MQTT_PORT" \
  -t "$MESSAGES_TOPIC" \
  -t "$RECEIPTS_TOPIC" \
  -t "$CONVERSATIONS_TOPIC" \
  -v



