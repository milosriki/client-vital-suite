import sys
import argparse
import time
import json
import os
import requests

def main():
    parser = argparse.ArgumentParser(description="Gemini Deep Research")
    parser.add_argument("--query", required=True, help="Research query")
    parser.add_argument("--format", help="Output format structure")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable not set")
        sys.exit(1)

    # Use gemini-2.0-flash which is generally available and fast
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + api_key
    
    headers = {
        "Content-Type": "application/json"
    }

    prompt = "Perform deep research on the following topic. Provide a comprehensive report with citations.\n\nQuery: " + args.query
    if args.format:
        prompt += "\n\nPlease follow this format structure:\n" + args.format

    data = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        
        if "candidates" in result and result["candidates"]:
            print(result["candidates"][0]["content"]["parts"][0]["text"])
        else:
            print("No response generated.")
            
    except Exception as e:
        print(f"Error executing research: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
