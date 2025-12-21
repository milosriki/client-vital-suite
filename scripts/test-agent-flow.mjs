import fs from 'fs';
import path from 'path';
import https from 'https';

// Load env vars manually
const loadEnv = (filename) => {
  const envPath = path.resolve(process.cwd(), filename);
  if (fs.existsSync(envPath)) {
    console.log(`Loading ${filename}...`);
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '');
        process.env[key] = value;
      }
    });
  }
};

loadEnv('.env');
loadEnv('.env.local');
loadEnv('.env.production.local');
loadEnv('.env.vercel.local');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Error: Supabase environment variables not found.");
  process.exit(1);
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ptd-agent-gemini`;

console.log(`🤖 Testing Agent Flow...`);
console.log(`Target: ${FUNCTION_URL}`);

const payload = JSON.stringify({
  message: "What is the health score of client milos@example.com? If not found, just tell me the general health of the system.",
  thread_id: `test_${Date.now()}`
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Length': payload.length
  }
};

const req = https.request(FUNCTION_URL, options, (res) => {
  let data = '';

  console.log(`Status Code: ${res.statusCode}`);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log("✅ Agent Response:");
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log("Response (Text):", data);
    }
  });
});

req.on('error', (error) => {
  console.error("❌ Request Error:", error);
});

req.write(payload);
req.end();
