// STEP 1: Open this URL in your browser and authorize the PTD FITNESS app
// After authorizing, you'll be redirected to personaltrainersdubai.com with ?auth_code=XXXXX
// Copy that auth_code and paste it into step2_exchange_token.js

const APP_ID = '7610715896306204673';
const REDIRECT_URI = 'https://www.personaltrainersdubai.com';
const STATE = 'ptd_lead_sync';

const authUrl =
  `https://business-api.tiktok.com/portal/auth?app_id=${APP_ID}&state=${STATE}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

console.log('\n🔗 Open this URL in your browser to authorize TikTok:\n');
console.log(authUrl);
console.log('\n⚡ After authorizing, copy the auth_code from the redirect URL');
console.log('   It will look like: https://www.personaltrainersdubai.com?auth_code=XXXXXXXXXXXX');
console.log('\n✅ Then paste the auth_code into step2_exchange_token.js\n');
