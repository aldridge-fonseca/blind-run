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
  const flow = end.per_flow_metadata?.[0] ?? {};
  const resultCode = Number(end.result_code ?? flow.result_code ?? (exitCode === 0 && end.status === 'passed' ? 100 : NaN));
  const credits = Number(end.credits_consumed ?? flow.credits_consumed ?? 0);
  const steps = new Set(records.filter((record) => Number.isFinite(record.step) && record.status !== 'running').map((record) => record.step)).size;
  const status = end.status === 'passed' || resultCode === 100 ? 'passed' : end.status === 'failed' || (resultCode >= 400 && resultCode < 1000) ? 'failed' : 'unknown';
  return {
    status,
    resultCode: Number.isFinite(resultCode) ? resultCode : null,
    reasonCode: end.reason_code ?? flow.reason_code ?? null,
    durationMs: Number.isFinite(Number(end.duration)) ? Math.round(Number(end.duration) * 1000) : null,
    steps,
    credits: Math.round(credits * 1000) / 1000,
    verdict: end.verdict ?? null,
    reason: end.reason ?? flow.error_message ?? null,
    summary: end.summary ?? null,
    oneLiner: end.one_liner ?? end.verdict?.one_liner ?? null,
    testUrl: end.test_url ?? null,
  };
}

// Role names the way NVDA speaks them.
const roleWords = {
  button: 'button', link: 'link', textbox: 'edit', searchbox: 'search edit', checkbox: 'check box', radio: 'radio button',
  combobox: 'combo box', listbox: 'list', option: 'option', menuitem: 'menu item', tab: 'tab', switch: 'toggle button',
  spinbutton: 'spin button', slider: 'slider', gridcell: 'cell', cell: 'cell', row: 'row', heading: 'heading',
  dialog: 'dialog', alertdialog: 'alert dialog', img: 'graphic', image: 'graphic', listitem: 'list item', group: 'grouping',
  region: 'region', navigation: 'navigation landmark', main: 'main landmark', form: 'form', document: 'document',
  RootWebArea: 'document', WebArea: 'document',
};

/** Formats one Chrome AX node as an NVDA-style utterance, e.g. "Seat F14, $89, toggle button, not pressed". */
export function axNodeToAnnouncement(node, { tag = '' } = {}) {
  const props = new Map((node?.properties ?? []).map((property) => [property.name, property.value?.value]));
  const rawRole = node?.role?.value ?? '';
  const name = String(node?.name?.value ?? '').replace(/\s+/g, ' ').trim();
  const description = String(node?.description?.value ?? '').replace(/\s+/g, ' ').trim();
  const value = String(node?.value?.value ?? '').trim();
  let role = roleWords[rawRole] ?? (rawRole === 'generic' || rawRole === 'none' || !rawRole ? 'clickable' : rawRole);
  if (rawRole === 'heading' && props.get('level')) role = `heading level ${props.get('level')}`;
  const states = [];
  const truthy = (key) => props.get(key) === true || props.get(key) === 'true';
  if (props.has('pressed')) states.push(props.get('pressed') === 'true' || props.get('pressed') === true ? 'pressed' : props.get('pressed') === 'mixed' ? 'half pressed' : 'not pressed');
  if (props.has('checked')) states.push(props.get('checked') === 'true' || props.get('checked') === true ? 'checked' : props.get('checked') === 'mixed' ? 'half checked' : 'not checked');
  if (truthy('selected')) states.push('selected');
  if (props.has('expanded')) states.push(truthy('expanded') ? 'expanded' : 'collapsed');
  if (truthy('disabled')) states.push('unavailable');
  if (truthy('required')) states.push('required');
  if (props.get('invalid') && props.get('invalid') !== 'false') states.push('invalid entry');
  const isField = ['textbox', 'searchbox', 'combobox', 'spinbutton'].includes(rawRole);
  const parts = [name, role, ...states];
  if (isField) parts.push(value || 'blank');
  if (description && description !== name) parts.push(description);
  let text = parts.filter(Boolean).join(', ');
  // A container's name can be all of its text; keep captions and speech to a readable length.
  if (text.length > 180) text = `${text.slice(0, 160).replace(/\s+\S*$/, '')}…, ${role}`;
  return { text, role, name, states, ...(tag ? { tag } : {}) };
}
