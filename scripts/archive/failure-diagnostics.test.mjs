import {test} from 'node:test';
import assert from 'node:assert/strict';
import {archiveError,failureDiagnostic} from './failure-diagnostics.mjs';

test('only allowlisted stages and codes are reported, never sensitive error fields',()=>{
  const secret='private-student-and-password';
  const error=Object.assign(new Error(secret),{archiveCode:secret,detail:secret,cause:new Error(secret)});
  assert.equal(failureDiagnostic(secret,error),'LTG archive FAILED at unknown (UNCLASSIFIED). No success is certified. Record contents and credentials are omitted.');
  assert.match(failureDiagnostic('snapshot',archiveError('CONTEXT_SCHEMA_MISMATCH')),/snapshot \(CONTEXT_SCHEMA_MISMATCH\)/);
  assert.throws(()=>archiveError(secret));
});
