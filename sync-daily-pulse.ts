import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from current directory
dotenv.config({ path: path.join(__dirname, '.env') });

// --- Configuration ---
const SPREADSHEET_ID = "1uav1Wpbq9EoL-bada_0sSe31vxHNlkQd3bsTggdzM6I";
const TARGET_GID = 463603897;

// --- Supabase Client ---
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncDailyPulse() {
  console.log(`🛡️  Forensic Sync Initiated: "Status Key" Sheet (GID: ${TARGET_GID})`);
  
  try {
    // Use the local gcloud credentials
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Find the Sheet Name using the GID
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetInfo = meta.data.sheets?.find(s => s.properties?.sheetId === TARGET_GID);
    
    if (!sheetInfo || !sheetInfo.properties?.title) {
      throw new Error(`Could not find sheet with GID: ${TARGET_GID}`);
    }

    const sheetName = sheetInfo.properties.title;
    console.log(`✅ Connected to Sheet: "${sheetName}"`);

    // 2. Fetch Data (Scanning wide to catch all status columns)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z1000`, 
    });

    const rows = response.data.values;
    if (!rows || rows.length < 3) {
      console.log('⚠️ Sheet is empty or missing headers.');
      return;
    }

    // 3. Smart Header Mapping (Row 3 based on your file structure)
    const headers = rows[2].map(h => h.toString().toLowerCase().trim());
    
    const clientIdx = headers.findIndex(h => h.includes('milan m') || h.includes('client'));
    const repIdx = headers.findIndex(h => h.includes('sales rep'));
    const coachIdx = headers.findIndex(h => h.includes('sales manager') || h.includes('assigned') || h.includes('coach'));
    const statusIdx = headers.findIndex(h => h.includes('status'));

    console.log(`📍 Column Map: Client[${clientIdx}] Rep[${repIdx}] Coach[${coachIdx}] Status[${statusIdx}]`);

    let processedCount = 0;
    let discrepancyCount = 0;

    // 4. Iterate and Audit
    // We iterate from Row 4 (index 3)
    for (let i = 3; i < rows.length; i++) {
      const row = rows[i];
      const clientName = row[clientIdx];
      const status = row[statusIdx];
      
      if (!clientName) continue;

      // Note: "Status Key" sheets often don't have a specific "Date" column for every row.
      // We assume the presence of a row implies "Current Status".
      // If a date column exists, we can add the filter back here.
      
      processedCount++;

      // Check against Supabase Truth (Forensic Audit)
      const { data: systemRecord } = await supabase
        .from('customer_profiles')
        .select('stripe_status, hubspot_status')
        .ilike('full_name', clientName)
        .maybeSingle();

      const systemStatus = systemRecord?.stripe_status || systemRecord?.hubspot_status || 'NOT_FOUND';
      const isDiscrepancy = status && systemStatus !== 'NOT_FOUND' && 
                            status.toLowerCase().trim() !== systemStatus.toLowerCase().trim();

      // Log to Audit Table
      await supabase.from('management_activity_audit').insert({
        client_name: clientName,
        recorded_status: status || 'N/A',
        system_status: systemStatus,
        assigned_coach: row[coachIdx] || null,
        sales_rep: row[repIdx] || null,
        discrepancy_detected: isDiscrepancy,
        last_sync: new Date().toISOString()
      });

      if (isDiscrepancy) {
        discrepancyCount++;
        // console.warn(`🚨 MISMATCH: ${clientName} (Sheet: ${status} vs System: ${systemStatus})`);
      }
    }

    console.log(`✅ Sync Complete.`);
    console.log(`   - Rows Processed: ${processedCount}`);
    console.log(`   - Discrepancies Flagged: ${discrepancyCount}`);
    console.log(`   - Data synced to 'management_activity_audit' table.`);

  } catch (error) {
    console.error('🔥 Sync Failed:', error);
  }
}

syncDailyPulse();
