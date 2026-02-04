
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import pandas as pd
import uvicorn
import os

app = FastAPI(title="Vital Suite Scoring Engine", version="1.0.0")

class HubSpotContact(BaseModel):
    id: str
    properties: Dict[str, Any]

class ScoringRequest(BaseModel):
    contacts: List[HubSpotContact]
    dry_run: bool = False

class ScoringResult(BaseModel):
    contactId: str
    email: str
    healthScore: int
    healthZone: str
    factors: Dict[str, float]
    nextBestAction: str

# -----------------------------------------------------------------------------
# LOGIC PORT: The "Heavy" Math from TypeScript -> Python (Pandas)
# -----------------------------------------------------------------------------

def calculate_days_since(date_val: Optional[str]) -> int:
    if not date_val:
        return 7 # Default safely
    
    try:
        dt = pd.to_datetime(date_val, utc=True)
        now = pd.Timestamp.now(tz='UTC')
        return (now - dt).days
    except:
        return 7

def get_health_zone(score: int) -> str:
    if score >= 85: return 'PURPLE'
    if score >= 70: return 'GREEN'
    if score >= 50: return 'YELLOW'
    return 'RED'

def recommend_action(zone: str, factors: Dict[str, float]) -> str:
    if zone == 'RED':
        if factors['inactivityPenalty'] > 20: return "URGENT_REACTIVATION_CALL"
        return "SCHEDULE_INTERVENTION"
    if zone == 'YELLOW':
        return "SEND_VALUE_CONTENT"
    if zone == 'GREEN':
        return "ASK_FOR_REFERRAL"
    if zone == 'PURPLE':
        return "UPSELL_ADVANCED_PACKAGE"
    return "CHECK_IN"

@app.post("/score", response_model=List[ScoringResult])
async def score_contacts(request: ScoringRequest):
    results = []
    
    # In a real heavy-compute scenario, we would load this into a DataFrame
    # df = pd.DataFrame([c.properties for c in request.contacts])
    # But for now, we iterate to match the exact business logic ported from TS.
    
    for contact in request.contacts:
        props = contact.properties
        score = 100.0
        factors = {
            "inactivityPenalty": 0.0,
            "frequencyDropPenalty": 0.0,
            "utilizationPenalty": 0.0,
            "commitmentBonus": 0.0
        }

        # 1. Inactivity
        last_paid = props.get('last_paid_session_date')
        days_since = calculate_days_since(last_paid)
        
        if days_since > 60: factors["inactivityPenalty"] = 40.0
        elif days_since > 30: factors["inactivityPenalty"] = 30.0
        elif days_since > 14: factors["inactivityPenalty"] = 20.0
        elif days_since > 7: factors["inactivityPenalty"] = 10.0
        
        score -= factors["inactivityPenalty"]

        # 2. Frequency Drop
        try:
            s7 = float(props.get('of_sessions_conducted__last_7_days_', 0) or 0)
            s30 = float(props.get('of_conducted_sessions__last_30_days_', 0) or 0)
            expected_weekly = s30 / 4.0
            
            if expected_weekly > 0:
                drop_pct = ((expected_weekly - s7) / expected_weekly) * 100
                if drop_pct >= 50: factors["frequencyDropPenalty"] = 25.0
                elif drop_pct >= 25: factors["frequencyDropPenalty"] = 15.0
        except:
            pass
        
        score -= factors["frequencyDropPenalty"]

        # 3. Utilization
        try:
            purchased = float(props.get('sessions_purchased', 0) or 0)
            remaining = float(props.get('outstanding_sessions', 0) or 0)
            used = purchased - remaining
            
            if purchased > 0:
                utilization = (used / purchased) * 100
                if utilization < 20: factors["utilizationPenalty"] = 15.0
                elif utilization < 50: factors["utilizationPenalty"] = 5.0
        except:
            pass
            
        score -= factors["utilizationPenalty"]

        # 4. Commitment
        next_booked = str(props.get('next_session_is_booked', '')).lower()
        is_booked = next_booked in ['y', 'yes', 'true', '1']
        
        if is_booked:
            try:
                future = float(props.get('of_future_booked_sessions', 0) or 0)
                factors["commitmentBonus"] = 10.0 if future > 1 else 5.0
            except:
                factors["commitmentBonus"] = 5.0
        
        score += factors["commitmentBonus"]

        # Finalize
        final_score = int(max(0, min(100, round(score))))
        zone = get_health_zone(final_score)
        action = recommend_action(zone, factors)

        results.append(ScoringResult(
            contactId=contact.id,
            email=str(props.get('email', 'unknown')),
            healthScore=final_score,
            healthZone=zone,
            factors=factors,
            nextBestAction=action
        ))

    return results

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "scoring-engine"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
