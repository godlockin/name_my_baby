#!/bin/bash
# Test Gemini API Key
# Usage: ./scripts/test-gemini-key.sh [API_KEY]

API_KEY="${1:-$GEMINI_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: No API key provided"
  echo "Usage: ./test-gemini-key.sh [YOUR_API_KEY]"
  echo "   or: export GEMINI_API_KEY=xxx && ./test-gemini-key.sh"
  exit 1
fi

echo "🔍 Testing Gemini API Key..."
echo "Key prefix: ${API_KEY:0:15}..."
echo ""

RESPONSE=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Hello, this is a test. Reply with OK if you can read this."
      }]
    }]
  }')

# Check for error
ERROR_CODE=$(echo "$RESPONSE" | jq -r '.error.code // empty')
ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error.message // empty')

if [ -n "$ERROR_CODE" ]; then
  echo "❌ API Key invalid (HTTP $ERROR_CODE)"
  echo "Error: $ERROR_MSG"
  exit 1
fi

# Check for successful response
TEXT=$(echo "$RESPONSE" | jq -r '.candidates[0].content.parts[0].text // empty')

if [ -n "$TEXT" ]; then
  echo "✅ API Key is valid!"
  echo ""
  echo "Response from Gemini:"
  echo "$TEXT"
  echo ""
  echo "Full response:"
  echo "$RESPONSE" | jq .
  exit 0
else
  echo "❌ Unexpected response format"
  echo "$RESPONSE" | jq .
  exit 1
fi
