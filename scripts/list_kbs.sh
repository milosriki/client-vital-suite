
TOKEN=$(gcloud auth print-access-token)
PROJECT="ptd-fitness-demo"

curl -s -X GET "https://dialogflow.googleapis.com/v2/projects/$PROJECT/knowledgeBases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: $PROJECT"
