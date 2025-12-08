# PTD Fitness Meta Conversions API Proxy

Node.js server that proxies Meta Conversions API with PII hashing, rate limiting, and comprehensive logging.

## Features

- ✅ SHA-256 hashing of PII (email, phone, name, etc.)
- ✅ Never hash fbp/fbc cookies
- ✅ AED currency default
- ✅ Unix timestamp (seconds) for event_time
- ✅ Rate limiting (100 req/min)
- ✅ Pino structured logging
- ✅ Docker & PM2 support
- ✅ Simple HTML dashboard
- ✅ Timezone: Asia/Dubai

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Meta Pixel ID and Access Token
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Run Production

```bash
# Using Node.js
npm start

# Using PM2
npm run pm2:start

# Using Docker
docker-compose up -d
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Single Event
```bash
POST /api/events/:name

# Example
POST /api/events/Purchase
Content-Type: application/json

{
  "user_data": {
    "email": "client@example.com",
    "phone": "+971501234567",
    "first_name": "John",
    "last_name": "Doe",
    "external_id": "client_123",
    "fbp": "fb.1.123456789.987654321",
    "fbc": "fb.1.123456789.AbCdEf"
  },
  "custom_data": {
    "currency": "AED",
    "value": 500.00,
    "content_name": "Personal Training"
  }
}
```

### Batch Events
```bash
POST /api/events/batch
Content-Type: application/json

{
  "events": [
    {
      "event_name": "Purchase",
      "user_data": {...},
      "custom_data": {...}
    },
    {
      "event_name": "ViewContent",
      "user_data": {...}
    }
  ]
}
```

## Dashboard

Open `http://localhost:3000/` in your browser to access the HTML dashboard with buttons for:
- Health Check
- Send Test Purchase

## Testing

```bash
npm test
```

## Docker Deployment

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## PM2 Deployment

```bash
# Start
npm run pm2:start

# Stop
npm run pm2:stop

# Restart
npm run pm2:restart

# View logs
npm run pm2:logs
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FB_PIXEL_ID` | Meta Pixel ID | ✅ |
| `FB_ACCESS_TOKEN` | Meta Access Token | ✅ |
| `FB_TEST_EVENT_CODE` | Test event code | Optional |
| `PORT` | Server port | Default: 3000 |
| `LOG_LEVEL` | Logging level | Default: info |
| `EVENT_SOURCE_URL` | Event source URL | Default: https://ptdfitness.com |
| `TZ` | Timezone | Default: Asia/Dubai |

## Security Notes

- All PII fields are automatically hashed with SHA-256
- `fbp` and `fbc` cookies are NEVER hashed
- Rate limiting prevents abuse (100 req/min per IP)
- Structured logging for audit trails
- Never log sensitive data

## License

MIT
