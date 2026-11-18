import test from 'node:test';
import assert from 'node:assert/strict';
import { axNodeToAnnouncement, parseKaneNdjson, summarizeKane } from './parsers.js';

test('parses Kane records and retains malformed lines separately', () => {
  const parsed = parseKaneNdjson('{"type":"step","step":1}\nnot-json\n{"type":"run_end","result_code":740}');
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.malformed[0].line, 2);
  const summary = summarizeKane(parsed.records, 1);
  assert.equal(summary.status, 'failed');
  assert.equal(summary.resultCode, 740);
  assert.equal(summary.steps, 1);
});

test('formats an accessible button name, states, and role', () => {
  const result = axNodeToAnnouncement({
    role: { value: 'button' }, name: { value: 'Seat F14' },
    properties: [{ name: 'disabled', value: { value: false } }, { name: 'selected', value: { value: true } }],
  });
  assert.deepEqual(result, { text: 'Seat F14, selected, button', role: 'button', name: 'Seat F14', states: ['selected'] });
});

test('uses a useful fallback for generic focus targets', () => {
  assert.equal(axNodeToAnnouncement({ role: { value: 'generic' }, name: { value: '' } }, { fallbackName: 'Seat 14C' }).text, 'Seat 14C, clickable');
});
