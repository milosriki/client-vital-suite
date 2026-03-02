// STEP 2: Exchange auth_code for Access Token + Advertiser ID
// Paste the auth_code from your browser redirect URL below

const AUTH_CODE = 'PASTE_AUTH_CODE_HERE'; // <-- paste here

const APP_ID = '7610715896306204673';
const SECRET = 'c88d575d53a0e757ee96c8b2c3e3b634986257cd';

async function exchangeToken() {
  console.log('🔄 Exchanging auth_code for Access Token...\n');
  
  const body = {
    app_id: APP_ID,
    secret: SECRET,
    auth_code: AUTH_CODE,
  };

  const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.code !== 0) {
    console.error('❌ Failed to get access token:', data.message);
    console.log('Full response:', JSON.stringify(data, null, 2));
    return;
  }

  const token = data.data.access_token;
  const advertiserIds = data.data.advertiser_ids;

  console.log('✅ Access Token obtained!');
  console.log('ACCESS_TOKEN:', token);
  console.log('ADVERTISER_IDs:', advertiserIds);
  console.log('\n📋 Add these to your .env file:');
  console.log(`TIKTOK_ACCESS_TOKEN=${token}`);
  console.log(`TIKTOK_ADVERTISER_ID=${advertiserIds[0]}`);
  console.log('\n▶️  Now run: node tiktok-integration/step3_fetch_leads.js\n');
}

exchangeToken();
