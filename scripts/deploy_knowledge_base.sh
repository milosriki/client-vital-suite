
TOKEN=$(gcloud auth print-access-token)
PROJECT="ptd-fitness-demo"

# 1. Create Knowledge Base
echo "Creating Knowledge Base 'PTD Fitness Master KB'..."
KB_RESPONSE=$(curl -s -X POST "https://dialogflow.googleapis.com/v2/projects/$PROJECT/knowledgeBases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: $PROJECT" \
  -d '{
    "displayName": "PTD Fitness Master KB"
  }')

KB_NAME=$(echo $KB_RESPONSE | grep -o '"name": "[^"]*"' | head -1 | sed 's/"name": //g' | sed 's/"//g')
echo "✅ Created KB: $KB_NAME"

# 2. Encode CSV Content
# We need to base64 the file content
RAW_CONTENT=$(openssl base64 -in knowledge_base.csv -A)

# 3. Create Document (Upload CSV)
echo "Uploading CSV Document..."
curl -X POST "https://dialogflow.googleapis.com/v2/$KB_NAME/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: $PROJECT" \
  -d "{
    \"displayName\": \"Core Protocols\",
    \"mimeType\": \"text/csv\",
    \"knowledgeTypes\": [\"FAQ\"],
    \"rawContent\": \"$RAW_CONTENT\"
  }"

echo ""
echo "✅ Document Uploaded/Queued."

# 4. Enable Sentiment Analysis (Global)
echo "Enabling Sentiment Analysis..."
curl -X PATCH "https://dialogflow.googleapis.com/v2/projects/$PROJECT/agent?updateMask=enableDataStore,matchMode" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: $PROJECT" \
  -d '{
    "enableDataStore": false, 
    "matchMode": "MATCH_MODE_HYBRID"
  }'
# Note: Sentiment is actually enabled per-request in detectIntent, OR globally via console.
# The API doesn't easily expose a global "sentiment enabled" flag on the Agent object in v2.
# Instead, we will configure the Edge Function to usually request it.
# But we CAN update the agent to ensure hybrid match mode for KB.
