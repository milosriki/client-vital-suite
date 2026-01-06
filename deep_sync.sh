#!/bin/bash

# Configuration
URL="https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/sync-hubspot-to-supabase"
TOKEN="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY"
CURSOR=""
PAGE=1

echo "Starting Deep Historical Sync..."

while : ; do
  echo "Processing Page $PAGE..."
  
  if [ -z "$CURSOR" ]; then
    PAYLOAD='{"incremental": false, "sync_type": "contacts"}'
  else
    PAYLOAD="{\"incremental\": false, \"sync_type\": \"contacts\", \"cursor\": \"$CURSOR\"}"
  fi

  RESPONSE=$(curl -s -X POST -H "Authorization: $TOKEN" -H "Content-Type: application/json" -d "$PAYLOAD" "$URL")
  
  SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true')
  HAS_MORE=$(echo "$RESPONSE" | grep -o '"has_more":true')
  # Fixed the cursor extraction logic
  NEW_CURSOR=$(echo "$RESPONSE" | grep -o '"next_cursor":"[^"].*[^\"]*"' | cut -d'"' -f4)
  
  if [ -z "$SUCCESS" ]; then
    echo "Error in sync: $RESPONSE"
    break
  fi

  SYNCED=$(echo "$RESPONSE" | grep -o '"contacts_synced":[0-9]*' | cut -d':' -f2)
  echo "Successfully synced batch $PAGE ($SYNCED contacts)"
  
  if [ -z "$HAS_MORE" ]; then
    echo "Deep Sync Complete. No more records."
    break
  fi

  CURSOR="$NEW_CURSOR"
  PAGE=$((PAGE+1))
  
  if [ $PAGE -gt 50 ]; then
    echo "Reached safety limit of 50 pages. Stopping."
    break
  fi
done