#!/bin/bash
# Test Zhipu AI (BigModel.cn) API Key
# Usage: ./scripts/test-zhipu-key.sh [API_KEY]

API_KEY="${1:-$ZHIPU_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: No API key provided"
  echo "Usage: ./test-zhipu-key.sh [YOUR_API_KEY]"
  echo "   or: export ZHIPU_API_KEY=xxx && ./test-zhipu-key.sh"
  exit 1
fi

echo "🔍 Testing Zhipu AI API Key..."
echo "Key prefix: ${API_KEY:0:15}..."
echo ""

RESPONSE=$(curl -s -X POST "https://open.bigmodel.cn/api/paas/v4/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-4-flash",
    "messages": [{
      "role": "user",
      "content": "你好，这是一个测试。如果可以请回复 OK。"
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
TEXT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // empty')

if [ -n "$TEXT" ]; then
  echo "✅ API Key is valid!"
  echo ""
  echo "Response from Zhipu AI:"
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
