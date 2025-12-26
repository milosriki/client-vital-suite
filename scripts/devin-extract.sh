#!/bin/bash
# Devin API Data Extractor - Shell Version
# Usage: DEVIN_API_KEY=your_key ./scripts/devin-extract.sh

set -e

API_KEY="${DEVIN_API_KEY:-}"
BASE_URL="https://api.devin.ai/v1"
OUTPUT_DIR="./devin-export"

if [ -z "$API_KEY" ]; then
    echo "❌ Error: DEVIN_API_KEY not set"
    echo ""
    echo "Usage:"
    echo "  DEVIN_API_KEY=apk_user_xxx ./scripts/devin-extract.sh"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "🤖 DEVIN DATA EXTRACTOR"
echo "========================"
echo ""

# 1. List all sessions
echo "📋 Fetching sessions..."
curl -s "$BASE_URL/sessions?limit=100" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    > "$OUTPUT_DIR/sessions.json"

SESSION_COUNT=$(cat "$OUTPUT_DIR/sessions.json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('sessions',[])))" 2>/dev/null || echo "?")
echo "✅ Found $SESSION_COUNT sessions"

# 2. List knowledge
echo ""
echo "📚 Fetching knowledge..."
curl -s "$BASE_URL/knowledge" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    > "$OUTPUT_DIR/knowledge.json" 2>/dev/null || echo "{}" > "$OUTPUT_DIR/knowledge.json"

KNOWLEDGE_COUNT=$(cat "$OUTPUT_DIR/knowledge.json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('knowledge',[])))" 2>/dev/null || echo "0")
echo "✅ Found $KNOWLEDGE_COUNT knowledge items"

# 3. List playbooks
echo ""
echo "📖 Fetching playbooks..."
curl -s "$BASE_URL/playbooks" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    > "$OUTPUT_DIR/playbooks.json" 2>/dev/null || echo "{}" > "$OUTPUT_DIR/playbooks.json"

PLAYBOOK_COUNT=$(cat "$OUTPUT_DIR/playbooks.json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('playbooks',[])))" 2>/dev/null || echo "0")
echo "✅ Found $PLAYBOOK_COUNT playbooks"

# 4. List secrets (metadata only)
echo ""
echo "🔐 Fetching secrets metadata..."
curl -s "$BASE_URL/secrets" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    > "$OUTPUT_DIR/secrets.json" 2>/dev/null || echo "{}" > "$OUTPUT_DIR/secrets.json"

echo ""
echo "================================================"
echo "📊 EXPORT COMPLETE"
echo "================================================"
echo "Sessions:  $SESSION_COUNT"
echo "Knowledge: $KNOWLEDGE_COUNT"
echo "Playbooks: $PLAYBOOK_COUNT"
echo ""
echo "📁 Files saved to: $OUTPUT_DIR/"
ls -la "$OUTPUT_DIR/"
echo "================================================"
