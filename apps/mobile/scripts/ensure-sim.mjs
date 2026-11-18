#!/usr/bin/env node
// Ensure at least one usable iPhone simulator exists; create one if not.
//   node ensure-sim.mjs
// Prints the simulator name on stdout. Uses `xcrun simctl` JSON output.
import { execFileSync } from 'node:child_process';

const simctl = (args) => JSON.parse(execFileSync('xcrun', ['simctl', ...args, '-j'], { encoding: 'utf8' }));

const isUsableIphone = (name) => /iphone/i.test(name ?? '') && !/se|watch|ipad|touch/i.test(name ?? '');

const devices = simctl(['list', 'devices', 'available']);
for (const [runtime, list] of Object.entries(devices.devices ?? {})) {
  if (!/iOS/.test(runtime)) continue;
  const found = (list ?? []).find((d) => d.isAvailable && isUsableIphone(d.name));
  if (found) {
    console.log(found.name);
    process.exit(0);
  }
}

const runtimes = simctl(['list', 'runtimes']);
const iosRuntimes = (runtimes.runtimes ?? []).filter((r) => r.isAvailable && /iOS/.test(r.identifier ?? ''));
iosRuntimes.sort((a, b) => String(b.version ?? '').localeCompare(String(a.version ?? ''), undefined, { numeric: true }));
const runtime = iosRuntimes[0];
if (!runtime) {
  console.error('no iOS simulator runtime installed');
  process.exit(1);
}

const types = simctl(['list', 'devicetypes']);
const iphone = (types.devicetypes ?? []).find((d) => isUsableIphone(d.name));
if (!iphone) {
  console.error('no iPhone device type found');
  process.exit(1);
}

const name = iphone.name.replace(/\s+/g, ' ');
execFileSync('xcrun', ['simctl', 'create', name, iphone.identifier, runtime.identifier], { stdio: 'inherit' });
console.log(name);
