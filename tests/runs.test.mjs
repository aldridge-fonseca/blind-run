// Evidence integrity: every committed run must be backed by Kane's own NDJSON, byte for byte.
// lane.json is a summary; these tests fail if it ever disagrees with Kane's run_end record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../runs');
const runs = fs.readdirSync(root).filter((id) => fs.existsSync(path.join(root, id, 'run.json')));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const runEnd = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)).findLast((r) => r.type === 'run_end');

test('there is at least one committed real run', () => assert.ok(runs.length > 0));

for (const id of runs) {
  const dir = path.join(root, id);
  const run = readJson(path.join(dir, 'run.json'));

  test(`${id}: every lane summary matches Kane's run_end`, () => {
    for (const step of run.sequence) {
      const lane = readJson(path.join(dir, step.dir, 'lane.json'));
      const end = runEnd(path.join(dir, step.dir, 'kane.ndjson'));
      assert.ok(end, `${step.dir}/kane.ndjson has a run_end`);
      assert.equal(lane.resultCode, end.result_code, `${step.dir} result code`);
      assert.equal(lane.status, end.status, `${step.dir} status`);
      assert.deepEqual(lane.verdict ?? null, end.verdict ?? null, `${step.dir} verdict is quoted verbatim`);
    }
  });

  test(`${id}: blind lane fails before the fix and passes after`, () => {
    const blind = run.sequence.filter((s) => s.lane === 'blind' || s.kind === 'fix');
    const first = runEnd(path.join(dir, blind[0].dir, 'kane.ndjson'));
    const last = runEnd(path.join(dir, blind.at(-1).dir, 'kane.ndjson'));
    assert.equal(first.result_code, 740);
    assert.equal(first.reason_code, 'assertion_error.confirmed_product_bug');
    assert.equal(first.verdict.family, 'application_issue');
    assert.equal(last.status, 'passed');
    assert.equal(last.result_code, 100);
    assert.equal(run.outcome.blindBefore, 'failed');
    assert.equal(run.outcome.blindAfter, 'passed');
  });

  test(`${id}: every fix attempt has a brief and a real diff limited to the app source`, () => {
    for (const step of run.sequence.filter((s) => s.kind === 'fix')) {
      const fixDir = path.join(dir, step.dir);
      assert.ok(fs.statSync(path.join(fixDir, 'brief.md')).size > 0);
      const files = [...fs.readFileSync(path.join(fixDir, 'diff.patch'), 'utf8').matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1]);
      assert.ok(files.length > 0, `${step.dir} diff is not empty`);
      for (const file of files) assert.match(file, /^apps\/encore\/src\//, `${step.dir} only edits app source`);
    }
  });

  test(`${id}: barriers are labelled as planted`, () => {
    for (const b of run.outcome.barriers ?? []) assert.equal(b.planted, true, `${b.id} is labelled planted`);
  });
}
