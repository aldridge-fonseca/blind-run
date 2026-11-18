#!/usr/bin/env node
// Resolve which discovered emulator a `kane-cli run` should target.
// Reads `kane-cli devices list --target emulator --agent` JSONL, picks the
// first device, and writes device.env for later workflow steps.
//   node resolve-device.mjs <devices.jsonl> <out.env> [nameOverride] [osOverride]
import { readFileSync, writeFileSync } from 'node:fs';

const [jsonl, out, wantName, wantOs] = process.argv.slice(2);
let name = '';
let osv = '';
try {
  for (const line of readFileSync(jsonl, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    const d = JSON.parse(t);
    if ('total' in d || d.type) continue;
    name = d.name ?? d.displayName ?? d.config_name ?? '';
    osv = String(d.osVersion ?? d.os_versions?.[0] ?? '');
    if (name) break;
  }
} catch {}
if (wantName && wantName !== 'auto') name = wantName;
if (wantOs) osv = wantOs;
writeFileSync(out, `DEVICE_NAME=${name}\nOS_VERSION=${osv}\n`);
console.log(`resolved device: ${name || '(none)'} / ${osv || '(none)'}`);
