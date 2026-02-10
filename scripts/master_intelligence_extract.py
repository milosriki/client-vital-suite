
import requests
import json
import re
import time

import os
HUBSPOT_API_KEY = os.environ.get("HUBSPOT_API_KEY", "")
HEADERS = {
    "Authorization": f"Bearer {HUBSPOT_API_KEY}",
    "Content-Type": "application/json"
}

def get_recent_customers():
    print("📥 Fetching 100 recent customers...")
    url = "https://api.hubapi.com/crm/v3/objects/contacts/search"
    payload = {
        "filterGroups": [{"filters": [{"propertyName": "lifecyclestage", "operator": "EQ", "value": "customer"}]}],
        "sorts": [{"propertyName": "lastmodifieddate", "direction": "DESCENDING"}],
        "properties": ["firstname", "lastname", "phone", "fitness_goal", "whatsapp_summary"],
        "limit": 100
    }
    response = requests.post(url, headers=HEADERS, json=payload)
    return response.json().get("results", [])

def get_notes_for_contact(contact_id):
    # Step 1: Get Association IDs
    assoc_url = f"https://api.hubapi.com/crm/v3/objects/contacts/{contact_id}/associations/notes"
    assoc_res = requests.get(assoc_url, headers=HEADERS)
    note_ids = [res["id"] for res in assoc_res.json().get("results", [])]
    
    if not note_ids:
        return []

    # Step 2: Fetch Note Content (Batching the note reads)
    notes = []
    for nid in note_ids[:5]: # Limit to last 5 notes per customer for speed
        note_url = f"https://api.hubapi.com/crm/v3/objects/notes/{nid}?properties=hs_note_body,hs_timestamp"
        note_res = requests.get(note_url, headers=HEADERS)
        body = note_res.json().get("properties", {}).get("hs_note_body", "")
        # Clean HTML tags
        clean_body = re.sub('<[^<]+?>', '', body)
        notes.append(clean_body)
    return notes

def main():
    start_time = time.time()
    customers = get_recent_customers()
    print(f"✅ Found {len(customers)} customers.")
    
    intel_report = []
    
    for i, contact in enumerate(customers):
        cid = contact["id"]
        name = f"{contact['properties'].get('firstname', '')} {contact['properties'].get('lastname', '')}"
        print(f"[{i+1}/100] Extracting intelligence for {name}...")
        
        notes = get_notes_for_contact(cid)
        
        intel_report.append({
            "id": cid,
            "name": name,
            "goal": contact["properties"].get("fitness_goal"),
            "notes": notes
        })
        
        # Rate limit protection
        if (i + 1) % 10 == 0:
            time.sleep(1)

    with open("MASTER_LEAD_INTELLIGENCE.json", "w") as f:
        json.dump(intel_report, f, indent=2)
    
    print(f"
🚀 MASTER EXTRACTION COMPLETE in {int(time.time() - start_time)} seconds!")
    print("File saved: MASTER_LEAD_INTELLIGENCE.json")

if __name__ == "__main__":
    main()
