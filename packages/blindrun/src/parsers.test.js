import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { axNodeToAnnouncement, parseKaneNdjson, summarizeKane } from './parsers.js';

test('parses Kane records and retains malformed lines separately', () => {
  const parsed = parseKaneNdjson('{"step":1,"status":"running"}\n{"step":1,"status":"done"}\nnot-json\n{"type":"run_end","status":"failed","result_code":740}');
  assert.equal(parsed.records.length, 3);
  assert.equal(parsed.malformed[0].line, 3);
  const summary = summarizeKane(parsed.records, 1);
  assert.equal(summary.status, 'failed');
  assert.equal(summary.resultCode, 740);
  assert.equal(summary.steps, 1);
});

test('summarizes a real Kane 740 verdict', () => {
  let text;
  try { text = readFileSync(new URL('../../../apps/theater/fixtures/sample-run/blind-0/kane.ndjson', import.meta.url), 'utf8'); } catch { return; }
  const summary = summarizeKane(parseKaneNdjson(text).records, 1);
  assert.equal(summary.resultCode, 740);
  assert.equal(summary.reasonCode, 'assertion_error.confirmed_product_bug');
  assert.ok(summary.verdict.bug_title);
});

test('speaks a named toggle button like NVDA', () => {
  const result = axNodeToAnnouncement({
    role: { value: 'button' }, name: { value: 'Seat F14' },
    properties: [{ name: 'disabled', value: { value: false } }, { name: 'pressed', value: { value: 'false' } }],
  });
  assert.equal(result.text, 'Seat F14, button, not pressed');
});

test('an icon-only button is just "button"; an unlabeled field is "edit, blank"', () => {
  assert.equal(axNodeToAnnouncement({ role: { value: 'button' }, name: { value: '' } }).text, 'button');
  assert.equal(axNodeToAnnouncement({ role: { value: 'textbox' }, name: { value: '' } }).text, 'edit, blank');
  assert.equal(axNodeToAnnouncement({ role: { value: 'generic' }, name: { value: 'Friday' } }).text, 'Friday, clickable');
});
