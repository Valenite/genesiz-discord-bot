import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lzhcrjlqncrvnoxiszyt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6aGNyamxxbmNydm5veGlzenl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MjI2MzcsImV4cCI6MjEwNDA5ODYzN30.arJWv-rbbu-Rbo3rsWMzEDbhc4Q_rYF5SdVhiKwDrtY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAnon() {
  const testRecord = {
    id: 'GSZ-2026-ANON-TEST',
    leader_name: 'Anon Test',
    leader_email: 'anon@test.com',
    team_password: 'pass',
    team_name: 'ANON TITANS',
    institution: 'GENESIZ HQ',
    discord_tag: 'test#0000',
    selected_events: ['valo'],
    selected_event_names: ['VALORANT (5+1)'],
    members: [],
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('registrations').upsert(testRecord);
  console.log('--- TEST ANON INSERT RESULT ---');
  console.log('Error:', error);
  console.log('Data:', data);
}

testAnon();
