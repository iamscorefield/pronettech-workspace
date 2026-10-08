const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// Use the Service Role Key for server-side backend routes to grant full database access
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ CRITICAL ARCHITECT ERROR: Supabase credentials are missing in your .env file!');
    process.exit(1);
}

// Initialize with service role key for backend operations
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
});

console.log('📡 DATABASE LOG: Supabase client connection established successfully (Admin Mode).');

module.exports = supabase;