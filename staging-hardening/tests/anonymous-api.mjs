import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const allowed = 'https://ezlvivmeneefiiwqwgqd.supabase.co';
const target = process.env.LTG_STAGING_URL || allowed;
assert.equal(target, allowed, 'Refusing any target other than Gltg staging');
const config = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
const key = config.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*=\s*"([^"]+)"/)?.[1];
assert.ok(key?.startsWith('sb_publishable_'), 'Expected the checked-in staging publishable key');
const classArgs = { p_join_code: 'INVALID', p_student_name: 'Synthetic Student', p_student_id: 'SYNTH-NULL', p_team_members: null, p_answers: {} };
const jobArgs = { p_join_code: 'INVALID', p_student_name: 'Synthetic Student', p_student_id: 'SYNTH-NULL', p_start_check: {}, p_quality_check: {}, p_requirement_results: [] };
const tests = [];
for (const [rpc, message] of [
  ['get_classroom_assessment', 'A valid class code is required'],
  ['get_job_card_by_code', 'A valid Live Job Card code is required'],
]) {
  for (const code of [null, '', 'abc', 'x'.repeat(33), ' '.repeat(129)]) tests.push({ rpc, body: { p_join_code: code }, message });
}
tests.push({ rpc: 'submit_classroom_assessment_v2', body: { ...classArgs, p_answers: null }, message: 'Every question must be answered' });
tests.push({ rpc: 'submit_classroom_assessment_v2', body: { ...classArgs, p_answers: [] }, message: 'Every question must be answered' });
for (const [field, message] of [
  ['p_start_check', 'Invalid Start Check payload'],
  ['p_quality_check', 'Invalid Quick Quality Check payload'],
  ['p_requirement_results', 'Invalid Job Card requirement results'],
]) tests.push({ rpc: 'submit_job_card', body: { ...jobArgs, [field]: null }, message });
tests.push({ rpc: 'submit_job_card', body: { ...jobArgs, p_evidence_type: null }, message: 'Invalid evidence type' });
const results = [];
for (const test of tests) {
  const response = await fetch(target + '/rest/v1/rpc/' + test.rpc, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(test.body),
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  assert.equal(response.status, 400, test.rpc + ': expected bounded input rejection');
  assert.equal(body.message, test.message, test.rpc + ': unexpected rejection');
  results.push({ rpc: test.rpc, status: response.status, passed: true });
}
process.stdout.write(JSON.stringify({ project: 'ezlvivmeneefiiwqwgqd', passed: results.length, total: tests.length, results }, null, 2) + '\n');
