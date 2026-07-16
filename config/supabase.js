const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ CRITICAL ARCHITECT ERROR: Supabase credentials are missing in your .env file!');
    process.exit(1);
}

// Initialize the single, shared connection client instance
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('📡 DATABASE LOG: Supabase client connection established successfully.');

module.exports = supabase;