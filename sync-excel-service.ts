import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SPREADSHEET_ID = '1uav1Wpbq9EoL-bada_0sSe31vxHNlkQd3bsTggdzM6I';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * SMART SCAN: Intelligently finds the index of a column based on common variations.
 */
function findColumnIndex(headers: string[], targets: string[]): number {
  return headers.findIndex(h => 
    targets.some(t => h.toLowerCase().trim().includes(t.toLowerCase().trim()))
  );
}

async function runSync() {
  console.log("🚀 Starting Smart Scan CEO Sync...");

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A1:Z100', // Scan top of sheet
    });

    const rows = response.data.values;
    if (!rows || rows.length < 3) {
      console.error("❌ Sheet data not found or headers missing on Row 3.");
      return;
    }

    const headers = rows[2]; // Row 3 is index 2
    console.log("🔍 Detected Headers:", headers);

    // Dynamic Field Mapping (Smart Scan)
    const clientIdx = findColumnIndex(headers, ['Milan M', 'Client', 'Name']);
    const repIdx = findColumnIndex(headers, ['SALES REP', 'Rep', 'Setter']);
    const coachIdx = findColumnIndex(headers, ['SALES MANAGER', 'Assigned Coach', 'Coach']);
    const statusIdx = findColumnIndex(headers, ['STATUS', 'Status', 'Current']);

    console.log(`📍 Map: Client(${clientIdx}), Rep(${repIdx}), Coach(${coachIdx}), Status(${statusIdx})`);

    const payload = [];
    for (let i = 3; i < rows.length; i++) {
      const row = rows[i];
      if (row[clientIdx]) {
        payload.push({
          client_name: row[clientIdx],
          sales_rep: row[repIdx] || null,
          assigned_coach: row[coachIdx] || null,
          status: row[statusIdx] || null,
        });
      }
    }

    console.log(`📦 Syncing ${payload.length} records to Supabase...`);

    const { error } = await supabase.from('management_activity_audit').insert(
      payload.map(p => ({
        ...p,
        last_sync: new Date().toISOString()
      }))
    );

    if (error) throw error;
    console.log("✅ CEO Sync Complete. Discrepancy View is now updated.");

  } catch (err) {
    console.error("❌ Sync Error:", err);
  }
}

runSync();
