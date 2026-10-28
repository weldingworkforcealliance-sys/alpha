import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const dir=new URL('../public/pvhs55/',import.meta.url);
const calendar=JSON.parse(readFileSync(new URL('../curriculum/pvhs55/calendar-basis.json',import.meta.url)));
for(const code of [114,115,120,150]){
 const text=readFileSync(new URL(`WLD${code}-55-Day-Instructor-Planner.html`,dir),'utf8');
 assert.equal((text.match(/class="day"/g)||[]).length,55,`WLD ${code}: 55 lesson bodies`);
 const dates=calendar.rows.filter(r=>r.pair.includes(`WLD ${code}`));
 assert.equal(dates.length,55);
 for(const row of dates)assert(text.includes(row.proposed_date),`WLD ${code}: missing ${row.proposed_date}`);
 for(const match of text.matchAll(/href="([^"]+)"/g)){
  if(match[1].startsWith('#')||match[1].startsWith('/')||/^https?:/.test(match[1]))continue;
  assert(existsSync(new URL(match[1],dir)),`Missing link ${match[1]}`);
 }
 for(const stale of ['Dates are not finalized.','LTG dates remain unset.','PROPOSED CALENDAR REVIEW COPY','production and existing student records remain unchanged'])assert(!text.includes(stale),`Stale release label: ${stale}`);
}
const migration=readFileSync(new URL('../supabase/migrations/20261028173509_pvhs55_live_signoffs.sql',import.meta.url),'utf8');
assert(!migration.includes('PVHS 55-day REVIEW 20261027'),'No staging-school guard may ship');
assert(migration.includes('alter table private.pvhs55_signoff_events enable row level security'));
assert(migration.includes("pd.scheduled_date <= private.school_local_date(s.school_id)"));
assert(migration.includes("p_expected_previous"));
console.log('PASS: 220 dated lessons, all calendar dates and links, release labels, scoped signoff safeguards');
