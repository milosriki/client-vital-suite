const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const pino = require('pino');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
require('dotenv').config();

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('dashboard'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// SHA-256 hashing helper (never hash fbp/fbc)
function hashPII(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.toString().toLowerCase().trim()).digest('hex');
}

// Normalize user_data
function normalizeUserData(userData = {}) {
  const normalized = {};
  
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
function prepareEvent(eventData) {
  const event = {
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
async function sendToMeta(events) {
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

  logger.info({ payload }, 'Sending to Meta CAPI');
  
  const response = await axios.post(url, payload);
  return response.data;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Dubai',
    currency: 'AED'
  });
});

// Single event endpoint
app.post('/api/events/:name', async (req, res) => {
  try {
    const eventName = req.params.name;
    const eventData = {
      ...req.body,
      event_name: eventName
    };

    const event = prepareEvent(eventData);
    const result = await sendToMeta(event);
    
    logger.info({ event_name: eventName, result }, 'Event sent successfully');
    res.json({ success: true, result });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error sending event');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch events endpoint
app.post('/api/events/batch', async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ success: false, error: 'events must be an array' });
    }

    const preparedEvents = events.map(prepareEvent);
    const result = await sendToMeta(preparedEvents);
    
    logger.info({ count: events.length, result }, 'Batch events sent successfully');
    res.json({ success: true, result, count: events.length });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error sending batch events');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook endpoint for AI agent orchestration (backfill events)
app.post('/api/webhook/backfill', async (req, res) => {
  try {
    logger.info({ body: req.body }, 'Received backfill webhook');
    
    const events = req.body.events || req.body;
    const eventsArray = Array.isArray(events) ? events : [events];
    
    const preparedEvents = eventsArray.map(prepareEvent);
    const result = await sendToMeta(preparedEvents);
    
    logger.info({ count: eventsArray.length, result }, 'Backfill events processed');
    res.json({ success: true, result, count: eventsArray.length });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error processing backfill');
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Meta CAPI Proxy server running on port ${PORT}`);
  logger.info(`Timezone: Asia/Dubai, Currency: AED`);
});
