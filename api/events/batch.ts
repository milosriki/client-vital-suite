import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import axios from 'axios';

// SHA-256 hashing helper (never hash fbp/fbc)
function hashPII(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.toString().toLowerCase().trim()).digest('hex');
}

// Normalize user_data
function normalizeUserData(userData: any = {}) {
  const normalized: any = {};
  
  // Hash PII fields
  if (userData.email) normalized.em = hashPII(userData.email);
  if (userData.phone) normalized.ph = hashPII(userData.phone);
  if (userData.first_name) normalized.fn = hashPII(userData.first_name);
  if (userData.last_name) normalized.ln = hashPII(userData.last_name);
  if (userData.city) normalized.ct = hashPII(userData.city);
  if (userData.state) normalized.st = hashPII(userData.state);
  if (userData.zip) normalized.zp = hashPII(userData.zip);
  if (userData.country) normalized.country = hashPII(userData.country);
  if (userData.external_id) normalized.external_id = hashPII(userData.external_id);
  if (userData.client_user_agent) normalized.client_user_agent = userData.client_user_agent;
  if (userData.client_ip_address) normalized.client_ip_address = userData.client_ip_address;
  
  // Never hash fbp/fbc
  if (userData.fbp) normalized.fbp = userData.fbp;
  if (userData.fbc) normalized.fbc = userData.fbc;
  
  return normalized;
}

// Prepare event for CAPI
function prepareEvent(eventData: any) {
  const event: any = {
    event_name: eventData.event_name || 'Purchase',
    event_time: eventData.event_time || Math.floor(Date.now() / 1000),
    event_source_url: eventData.event_source_url || process.env.EVENT_SOURCE_URL || 'https://www.personaltrainersdubai.com',
    action_source: eventData.action_source || 'website',
    user_data: normalizeUserData(eventData.user_data || {}),
  };

  // Add event_id if provided
  if (eventData.event_id) {
    event.event_id = eventData.event_id;
  }

  // Add custom_data with AED default
  if (eventData.custom_data) {
    event.custom_data = {
      ...eventData.custom_data,
      currency: eventData.custom_data.currency || 'AED'
    };
  }

  return event;
}

// Send to Meta CAPI
async function sendToMeta(events: any) {
  const pixelId = process.env.FB_PIXEL_ID;
  const accessToken = process.env.FB_ACCESS_TOKEN;
  
  if (!pixelId || !accessToken) {
    throw new Error('FB_PIXEL_ID or FB_ACCESS_TOKEN not configured');
  }

  const url = `https://graph.facebook.com/v21.0/${pixelId}/events`;
  const payload = {
    data: Array.isArray(events) ? events : [events],
    access_token: accessToken,
    test_event_code: process.env.FB_TEST_EVENT_CODE || undefined
  };

  const response = await axios.post(url, payload);
  return response.data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { events } = req.body;
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ success: false, error: 'events must be an array' });
    }

    const preparedEvents = events.map(prepareEvent);
    const result = await sendToMeta(preparedEvents);
    
    res.json({ success: true, result, count: events.length });
  } catch (error: any) {
    console.error('Error sending batch events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

