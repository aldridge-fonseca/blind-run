export function parseKaneNdjson(text) {
  const records = [];
  const malformed = [];
  for (const [index, line] of String(text).split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      malformed.push({ line: index + 1, text: line });
    }
  }
  return { records, malformed };
}

export function summarizeKane(records, exitCode = 0) {
  const end = [...records].reverse().find((record) => record.type === 'run_end') ?? {};
  const verdict = end.verdict ?? end.per_flow_metadata?.[0] ?? {};
  const resultCode = Number(end.result_code ?? verdict.result_code ?? (exitCode === 0 ? 100 : NaN));
  const credits = Number(end.credits_consumed ?? verdict.credits_consumed ?? 0);
  const steps = new Set(records.filter((record) => Number.isFinite(record.step)).map((record) => record.step)).size;
  return {
    status: resultCode === 100 || end.status === 'passed' ? 'passed' : resultCode === 740 || end.status === 'failed' ? 'failed' : 'unknown',
    resultCode: Number.isFinite(resultCode) ? resultCode : null,
    durationMs: Number.isFinite(Number(end.duration)) ? Number(end.duration) * 1000 : null,
    steps,
    credits,
    verdict: Object.keys(verdict).length ? verdict : end,
  };
}

const stateLabels = {
  disabled: 'disabled', checked: 'checked', selected: 'selected', expanded: 'expanded',
  required: 'required', invalid: 'invalid', busy: 'busy', pressed: 'pressed',
};

export function axNodeToAnnouncement(node, { fallbackName = '', source = 'focus' } = {}) {
  const props = new Map((node?.properties ?? []).map((property) => [property.name, property.value?.value]));
  const role = node?.role?.value ?? '';
  const name = node?.name?.value || fallbackName || node?.value?.value || '';
  const states = [];
  for (const [key, label] of Object.entries(stateLabels)) {
    if (props.get(key) === true || props.get(key) === 'true') states.push(label);
  }
  const roleText = role === 'generic' && source === 'focus' ? 'clickable' : role;
  const text = [name, ...states, roleText].filter(Boolean).join(', ');
  return { text, role: roleText, name, states };
}
