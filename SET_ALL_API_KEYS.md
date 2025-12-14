# 🔐 Setting All API Keys in Supabase

## 📋 **API KEYS FOUND IN DOCUMENTATION**

From `ALL_SET_COMPLETE.md` and other docs, I found these keys:

### **AI Keys:**
- `GOOGLE_API_KEY` = `AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s`
- `GOOGLE_GEMINI_API_KEY` = (same as above or different)
- `GEMINI_API_KEY` = (may be same as GOOGLE_API_KEY)
- `ANTHROPIC_API_KEY` = (needs to be set - not found in docs)
- `OPENAI_API_KEY` = (needs to be set - not found in docs)

### **Meta/Facebook Keys:**
- `FB_PIXEL_ID` = `349832333681399`
- `FB_ACCESS_TOKEN` = `EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1`
- `META_APP_ID` = `223192964069489`
- `META_APP_SECRET` = `667a10ddcc6dffec6cc8a22a29b80684`
- `META_CLIENT_TOKEN` = `7626cb19dee913d36f37e24961cca09d`
- `META_PAGE_ID` = `100334836038237`
- `META_AD_ACCOUNT_ID` = `349832333681399`

### **Integration Keys (Need Values):**
- `HUBSPOT_API_KEY` = (needs actual key)
- `STRIPE_SECRET_KEY` = (needs actual key)
- `STAPE_CAPIG_API_KEY` = (needs actual key)
- `LOVABLE_API_KEY` = (needs actual key)
- `GITHUB_TOKEN` = (optional)
- `GITHUB_REPO` = (optional)

---

## 🚀 **SETTING ALL KEYS IN SUPABASE**

I'll set all the keys I found. For missing keys, you'll need to provide them.

### **Step 1: Set Google/Gemini Keys**
```bash
supabase secrets set GOOGLE_API_KEY=AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s
supabase secrets set GEMINI_API_KEY=AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s
supabase secrets set GOOGLE_GEMINI_API_KEY=AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s
```

### **Step 2: Set Meta/Facebook Keys**
```bash
supabase secrets set FB_PIXEL_ID=349832333681399
supabase secrets set FB_ACCESS_TOKEN=EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1
supabase secrets set META_APP_ID=223192964069489
supabase secrets set META_APP_SECRET=667a10ddcc6dffec6cc8a22a29b80684
supabase secrets set META_CLIENT_TOKEN=7626cb19dee913d36f37e24961cca09d
supabase secrets set META_PAGE_ID=100334836038237
supabase secrets set META_AD_ACCOUNT_ID=349832333681399
```

### **Step 3: Set Missing Keys (Need Values)**
```bash
# These need actual values:
# supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# supabase secrets set OPENAI_API_KEY=sk-...
# supabase secrets set HUBSPOT_API_KEY=pat_...
# supabase secrets set STRIPE_SECRET_KEY=sk_live_...
# supabase secrets set STAPE_CAPIG_API_KEY=...
# supabase secrets set LOVABLE_API_KEY=...
```

---

## ⚠️ **NOTE**

The user said I have access to all API keys and a full env file. Let me try to read the actual .env file to get all keys.

**Status:** Waiting to read full .env file with all keys...
