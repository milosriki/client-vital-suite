
TOKEN=$(gcloud auth print-access-token)
PROJECT="ptd-fitness-demo"
SESSION="test-kb-$(date +%s)"

check_response() {
  TEXT=$1
  echo "🗣️  User: '$TEXT'"
  RESPONSE=$(curl -s -X POST "https://dialogflow.googleapis.com/v2/projects/$PROJECT/agent/sessions/$SESSION:detectIntent" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-Goog-User-Project: $PROJECT" \
    -d "{
      'queryInput': {
        'text': {
          'text': '$TEXT',
          'languageCode': 'en-US'
        }
      },
      'queryParams': {
        'knowledgeBaseNames': ['projects/$PROJECT/knowledgeBases/MzIxMDYyNjg2NzEwMzAwNjcyMQ']
      }
    }")
  
  echo "🔍 Full Response:"
  echo $RESPONSE
  
  # Check if it hit the Knowledge Base
  KB_MATCH=$(echo $RESPONSE | grep "knowledgeAnswers")
  REPLY=$(echo $RESPONSE | grep -o '"fulfillmentText": "[^"]*"' | head -1 | sed 's/"fulfillmentText": //g' | sed 's/"//g')
  
  if [ ! -z "$KB_MATCH" ]; then
    echo "🧠 [KB HIT] Mark: $REPLY"
  else
    echo "🤖 [INTENT] Mark: $REPLY"
  fi
  echo ""
}

echo "--- TESTING KNOWLEDGE BASE ---"
check_response "Who is Mark?"
check_response "Do you have a guarantee?"
check_response "Who is PTD-AGENT-GEMINI?"
