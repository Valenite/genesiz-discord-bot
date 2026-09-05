import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function insertTest() {
  const testRecord = {
    id: 'GSZ-2026-TEST',
    leader_name: 'Test Captain',
    leader_email: 'test@genesiz.com',
    team_password: 'pass',
    team_name: 'CYBER TITANS',
    institution: 'GENESIZ HQ',
    discord_tag: 'test#0000',
    selected_events: ['valo'],
    selected_event_names: ['VALORANT (5+1)'],
    members: [],
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('registrations').upsert(testRecord);
  console.log('Inserted test record. Error:', error);
}

insertTest();
