# Vital Suite Scoring Engine

**Python/FastAPI service for heavy health score computation.**

## Architecture

This service offloads CPU-intensive scoring calculations from Supabase Edge Functions to Google Cloud Run, enabling:

- **Unlimited Scale**: Auto-scaling containers
- **No Timeouts**: Edge Functions limited to 30s, Cloud Run supports minutes
- **MLOps Ready**: Python ecosystem for future ML model integration

## Local Development

```bash
cd services/scoring-engine

# Install dependencies
pip install -r requirements.txt

# Run locally
python main.py
# Server runs on http://localhost:8080
```

## Docker Build

```bash
docker build -t scoring-engine .
docker run -p 8080:8080 scoring-engine
```

## API Endpoints

### POST /score

Calculate health scores for contacts.

**Request:**

```json
{
  "contacts": [
    {
      "id": "12345",
      "properties": {
        "email": "client@example.com",
        "outstanding_sessions": "10",
        "sessions_purchased": "20",
        "last_paid_session_date": "2026-01-15",
        "of_sessions_conducted__last_7_days_": "2",
        "of_conducted_sessions__last_30_days_": "8",
        "next_session_is_booked": "Y",
        "of_future_booked_sessions": "3"
      }
    }
  ],
  "dry_run": false
}
```

**Response:**

```json
[
  {
    "contactId": "12345",
    "email": "client@example.com",
    "healthScore": 85,
    "healthZone": "PURPLE",
    "factors": {
      "inactivityPenalty": 0,
      "frequencyDropPenalty": 0,
      "utilizationPenalty": 5,
      "commitmentBonus": 10
    },
    "nextBestAction": "UPSELL_ADVANCED_PACKAGE"
  }
]
```

### GET /health

Health check endpoint.

## Deployment to Cloud Run

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/scoring-engine

# Deploy to Cloud Run
gcloud run deploy scoring-engine \
  --image gcr.io/YOUR_PROJECT_ID/scoring-engine \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1
```

## Integration

The Edge Function `calculate-health-scores` acts as a proxy:

1. Receives trigger from Supabase
2. Fetches contacts from HubSpot
3. Calls this Cloud Run service
4. Updates HubSpot with results

This architecture keeps the event-driven model while enabling unlimited compute power.
