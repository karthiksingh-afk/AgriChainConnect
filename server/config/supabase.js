// server/config/supabase.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.INSFORGE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.INSFORGE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.INSFORGE_API_KEY;

let supabase = null;
let supabaseAdmin = null;

if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
}

if (supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
}

module.exports = {
    supabase,
    supabaseAdmin
};
