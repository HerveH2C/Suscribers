const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis (voir .env.example).'
  );
}

// Client "admin" : la clé service_role bypass RLS. Ce client ne doit
// JAMAIS être exposé côté navigateur — il ne vit que dans ce backend.
const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

module.exports = { supabase };
