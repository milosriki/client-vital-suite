import requests
import json
import re
import time

# CONFIG
HUBSPOT_API_KEY = "pat-na1-7dc3217b-65d8-41c8-9281-730818836a5a"
SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY"

HEADERS_HS = {"Authorization": f"Bearer {HUBSPOT_API_KEY}", "Content-Type": "application/json"}
HEADERS_SB = {"Authorization": f"Bearer {SUPABASE_KEY}", "apikey": SUPABASE_KEY, "Content-Type": "application/json"}

def fetch_hubspot_winners():
    url = "https://api.hubapi.com/crm/v3/objects/contacts/search"
    payload = {
        "filterGroups": [{"filters": [{"propertyName": "lifecyclestage", "operator": "IN", "values": ["customer", "opportunity"]}]}],
        "sorts": [{"propertyName": "lastmodifieddate", "direction": "DESCENDING"}],
        "properties": ["firstname", "phone", "fitness_goal"],
        "limit": 50
    }
    res = requests.post(url, headers=HEADERS_HS, json=payload).json()
    return res.get("results", [])

def get_hubspot_notes(contact_id):
    url = f"https://api.hubapi.com/crm/v3/objects/contacts/{contact_id}/associations/notes"
    try:
        res = requests.get(url, headers=HEADERS_HS).json()
        note_ids = [r["id"] for r in res.get("results", [])]
        notes = []
        for nid in note_ids[:3]:
            n_res = requests.get(f"https://api.hubapi.com/crm/v3/objects/notes/{nid}?properties=hs_note_body", headers=HEADERS_HS).json()
            body = n_res.get("properties", {}).get("hs_note_body", "")
            clean = re.sub('<[^<]+?>', '', body)
            if "Entry through mobile" not in clean:
                notes.append(clean)
        return notes
    except: return []

def get_supabase_calls(phone):
    if not phone: return []
    clean_phone = phone[-9:]
    sql = f"SELECT keywords, ai_summary FROM public.call_records WHERE caller_number LIKE '%{clean_phone}'"
    try:
        res = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/execute_sql_query", headers=HEADERS_SB, json={"sql_query": sql}).json()
        return res if isinstance(res, list) else []
    except: return []

def main():
    winners = fetch_hubspot_winners()
    master_intel = []
    for contact in winners:
        cid = contact["id"]
        name = contact["properties"].get("firstname", "Unknown")
        phone = contact["properties"].get("phone")
        notes = get_hubspot_notes(cid)
        calls = get_supabase_calls(phone)
        master_intel.append({"name": name, "goal": contact["properties"].get("fitness_goal"), "notes": notes, "calls": calls})
        time.sleep(0.1)
    with open("CONSOLIDATED_SUCCESS_DNA.json", "w") as f:
        json.dump(master_intel, f, indent=2)
    print("DONE")

if __name__ == "__main__":
    main()