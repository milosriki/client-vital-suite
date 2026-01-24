import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { error } = await supabase.from('sync_errors').select('count', { count: 'exact', head: true });
    if (error) console.log('❌ sync_errors table missing');
    else console.log('✅ sync_errors table exists');
}
check();
