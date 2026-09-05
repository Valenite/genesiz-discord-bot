import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY presence:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('registrations').select('*');
  console.log('--- ALL REGISTRATIONS IN SUPABASE ---');
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}

test();
